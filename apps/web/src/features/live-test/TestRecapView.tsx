import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { ArrowLeft, CheckCircle2, GraduationCap, MessageSquare } from 'lucide-react';
import type {
  ErrorType,
  PostTestSummary,
  TestMode,
  TestRange,
  TestRating,
  TestStatus,
  TestType,
} from '@tahfeedh/shared';
import { supabase } from '../../lib/supabase';
import { LoggedErrorsList } from './LoggedErrorsList';
import { PostTestSummaryView } from './PostTestSummaryView';
import type { LoggedError } from './useTestSession';

interface TestRow {
  id: string;
  test_type: TestType;
  status: TestStatus;
  rating: TestRating | null;
  notes: string | null;
  ranges: TestRange[];
  started_at: string;
  ended_at: string | null;
  test_mode: TestMode;
  guest_tester_name: string | null;
  summary: PostTestSummary | null;
}

interface ErrorLogRow {
  id: string;
  signature: string;
  surah_number: number;
  ayah_number: number;
  word_position: number | null;
  word_position_end: number | null;
  error_type: ErrorType;
  teacher_note: string | null;
  related_surah: number | null;
  related_ayah: number | null;
  created_at: string;
}

export function TestRecapView({ testId }: { testId: string }) {
  const navigate = useNavigate();
  const [test, setTest] = useState<TestRow | null>(null);
  const [errors, setErrors] = useState<LoggedError[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setLoaded(false);

    Promise.all([
      supabase
        .from('test')
        .select(
          'id, test_type, status, rating, notes, ranges, started_at, ended_at, test_mode, guest_tester_name, summary',
        )
        .eq('id', testId)
        .single(),
      supabase
        .from('error_log')
        .select(
          'id, signature, surah_number, ayah_number, word_position, word_position_end, error_type, teacher_note, related_surah, related_ayah, created_at',
        )
        .eq('test_id', testId)
        .order('created_at', { ascending: true }),
    ]).then(([testRes, errorsRes]) => {
      if (cancelled) return;
      if (testRes.error || !testRes.data) {
        setLoadError(testRes.error?.message ?? 'test not found');
        setLoaded(true);
        return;
      }
      setTest(testRes.data as TestRow);
      setErrors(((errorsRes.data ?? []) as ErrorLogRow[]).map(toLoggedError));
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [testId]);

  const durationSec = useMemo(() => {
    if (!test?.started_at || !test?.ended_at) return null;
    return Math.max(
      0,
      Math.floor((new Date(test.ended_at).getTime() - new Date(test.started_at).getTime()) / 1000),
    );
  }, [test?.started_at, test?.ended_at]);

  const rangeLabel = useMemo(() => (test ? formatRanges(test.ranges) : ''), [test]);

  if (!loaded) {
    return (
      <Container py="md">
        <Stack gap="sm" align="center" mih={300} justify="center">
          <Loader color="parchment.0" />
          <Text c="parchment.0" size="sm">
            Loading recap {testId.slice(0, 8)}…
          </Text>
        </Stack>
      </Container>
    );
  }

  if (loadError || !test) {
    return (
      <Container py="md">
        <Stack gap="sm">
          <Text c="parchment.0" fw={700} fz="lg">
            Test recap
          </Text>
          <Alert color="brick" title="Failed to load test">
            {loadError ?? 'test not found'}
          </Alert>
          <Group>
            <Button variant="default" onClick={() => navigate({ to: '/tests' })}>
              Back to Tests
            </Button>
          </Group>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Stack gap={4}>
          <Anchor
            size="xs"
            c="parchment.0"
            onClick={() => navigate({ to: '/tests' })}
            style={{ opacity: 0.85 }}
          >
            <Group gap={4} wrap="nowrap">
              <ArrowLeft size={12} />
              <Text size="xs" tt="uppercase" fw={700} lts={0.8}>
                All tests
              </Text>
            </Group>
          </Anchor>
          <Group gap="xs" align="center" wrap="nowrap">
            <GraduationCap size={26} color="var(--mantine-color-parchment-0)" />
            <Title order={2} c="parchment.0">
              {test.test_type === 'newly_memorized' ? 'New lesson recap' : 'Revision recap'}
            </Title>
          </Group>
        </Stack>

        <Card withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
                  Range
                </Text>
                <Text size="sm" fw={600}>
                  {rangeLabel || '—'}
                </Text>
              </Stack>
              {test.rating && (
                <Badge color={ratingColor(test.rating)} variant="filled" size="lg">
                  {ratingLabel(test.rating)}
                </Badge>
              )}
            </Group>

            <Group gap="lg" mt={2}>
              <MetaField label="Completed">
                {test.ended_at
                  ? new Date(test.ended_at).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : '—'}
              </MetaField>
              {durationSec != null && (
                <MetaField label="Duration">
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatDuration(durationSec)}
                  </span>
                </MetaField>
              )}
              <MetaField label="Witness">
                {test.test_mode === 'guest_teacher'
                  ? test.guest_tester_name ?? 'Guest'
                  : 'Enrolled teacher'}
              </MetaField>
              <MetaField label="Errors logged">{errors.length}</MetaField>
            </Group>
          </Stack>
        </Card>

        {test.notes && (
          <Card withBorder radius="md" p="md">
            <Group gap={6} mb={4}>
              <MessageSquare size={14} color="var(--mantine-color-honey-7)" />
              <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
                Notes
              </Text>
            </Group>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {test.notes}
            </Text>
          </Card>
        )}

        <Stack gap="xs">
          <Group gap={6}>
            <CheckCircle2 size={16} color="var(--mantine-color-parchment-0)" />
            <Text size="xs" tt="uppercase" fw={700} c="parchment.0" lts={0.8} style={{ opacity: 0.85 }}>
              Post-test summary
            </Text>
          </Group>
          <Card withBorder radius="md" p="md">
            {test.summary ? (
              <PostTestSummaryView summary={test.summary} />
            ) : (
              <Text size="sm" c="dimmed" fs="italic">
                Post-test summary isn't stored for tests completed before this feature shipped. The
                errors below are still the full record of what was logged.
              </Text>
            )}
          </Card>
        </Stack>

        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={700} c="parchment.0" lts={0.8} style={{ opacity: 0.85 }}>
            Errors logged
          </Text>
          <Paper withBorder radius="md" p="md">
            <LoggedErrorsList
              errors={errors}
              emptyText="No errors were logged during this test."
            />
          </Paper>
        </Stack>
      </Stack>
    </Container>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.6}>
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {children}
      </Text>
    </Stack>
  );
}

function toLoggedError(row: ErrorLogRow): LoggedError {
  return {
    id: row.id,
    signature: row.signature,
    surah: row.surah_number,
    ayah: row.ayah_number,
    word_position: row.word_position,
    word_position_end: row.word_position_end,
    error_type: row.error_type,
    teacher_note: row.teacher_note,
    related_surah: row.related_surah,
    related_ayah: row.related_ayah,
    created_at: row.created_at,
  };
}

function formatRanges(ranges: TestRange[]): string {
  return ranges
    .map((r) => {
      switch (r.type) {
        case 'page':
          return r.start === r.end ? `page ${r.start}` : `pages ${r.start}–${r.end}`;
        case 'surah':
          return `surah ${r.surah}`;
        case 'ayah':
          return `${r.surah}:${r.start_ayah}–${r.end_ayah}`;
        case 'juz':
          return `juz ${r.juz}`;
        case 'hizb':
          return `hizb ${r.hizb}`;
        case 'rub':
          return `rub ${r.rub}`;
      }
    })
    .join(' · ');
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function ratingLabel(r: TestRating): string {
  switch (r) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'needs_work':
      return 'Needs work';
    case 'strong_pass':
      return 'Strong pass';
    case 'pass_needs_practice':
      return 'Pass · practice';
    case 'fail':
      return 'Fail';
  }
}

function ratingColor(r: TestRating): string {
  switch (r) {
    case 'excellent':
    case 'strong_pass':
      return 'sage.7';
    case 'good':
      return 'sage.5';
    case 'pass_needs_practice':
      return 'honey.5';
    case 'needs_work':
      return 'honey.7';
    case 'fail':
      return 'brick.6';
  }
}

import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { ClipboardList, GraduationCap, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { TestRange, TestRating, TestStatus, TestType } from '@tahfeedh/shared';
import { supabase } from '../lib/supabase';
import { TestCreationModal } from '../features/live-test/TestCreationModal';

interface RecentTestRow {
  id: string;
  test_type: TestType;
  status: TestStatus;
  rating: TestRating | null;
  ended_at: string | null;
  ranges: TestRange[];
}

const HISTORY_LIMIT = 15;
const SPARKLINE_DAYS = 30;

export const Route = createFileRoute('/_authed/tests/')({
  component: TestsPage,
});

function TestsPage() {
  const { user } = Route.useRouteContext();
  if (user.role === 'teacher') return <TeacherTestsHistory teacherId={user.id} />;
  return <StudentTestsLanding />;
}

function StudentTestsLanding() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [opened, setOpened] = useState(false);
  const [recent, setRecent] = useState<RecentTestRow[]>([]);
  const [thirtyDay, setThirtyDay] = useState<{ ended_at: string }[]>([]);
  const [openInProgress, setOpenInProgress] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - SPARKLINE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase
        .from('test')
        .select('id, test_type, status, rating, ended_at, ranges')
        .eq('status', 'in_progress')
        .limit(1),
      supabase
        .from('test')
        .select('id, test_type, status, rating, ended_at, ranges')
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(HISTORY_LIMIT),
      supabase
        .from('test')
        .select('ended_at')
        .eq('status', 'completed')
        .gte('ended_at', since)
        .order('ended_at', { ascending: false }),
    ]).then(([openRes, recentRes, thirtyRes]) => {
      if (cancelled) return;
      const open = openRes.data?.[0];
      if (open) setOpenInProgress(open.id);
      if (recentRes.data) setRecent(recentRes.data as RecentTestRow[]);
      if (thirtyRes.data) setThirtyDay(thirtyRes.data as { ended_at: string }[]);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const dailyCounts = useMemo(() => buildDailyCounts(thirtyDay), [thirtyDay]);
  const totalLast30 = useMemo(
    () => dailyCounts.reduce((sum, d) => sum + d.count, 0),
    [dailyCounts],
  );

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" c="parchment.0" fw={700} lts={0.8} style={{ opacity: 0.85 }}>
            Tests
          </Text>
          <Group gap="xs" align="center">
            <GraduationCap size={26} color="var(--mantine-color-parchment-0)" />
            <Title order={2} c="parchment.0">
              Witnessed tests
            </Title>
            <Badge variant="filled" color="sage.7">
              Phase D
            </Badge>
          </Group>
          <Text c="parchment.0" size="sm" style={{ opacity: 0.75 }}>
            الاختبارات · Witnessed tests are how a page moves from in-progress to memorized.
          </Text>
        </Stack>

        <Card withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group gap={6}>
              <Sparkles size={16} color="var(--mantine-color-honey-7)" />
              <Text fw={700}>
                {openInProgress ? 'You have a test in progress' : 'Begin a self-test'}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {openInProgress
                ? 'Resume your live test to keep logging errors, then end with a rating.'
                : 'Run a test from your device with someone listening — a teacher, parent, sibling, or friend can act as your witness.'}
            </Text>
            <Group>
              {openInProgress ? (
                <Button
                  color="sage"
                  onClick={() =>
                    navigate({ to: '/tests/$testId', params: { testId: openInProgress } })
                  }
                >
                  Resume test
                </Button>
              ) : (
                <Button color="sage" onClick={() => setOpened(true)}>
                  Begin test
                </Button>
              )}
            </Group>
          </Stack>
        </Card>

        {loaded && (totalLast30 > 0 || recent.length > 0) && (
          <Card withBorder radius="md" p="md">
            <Stack gap="xs">
              <Group justify="space-between" align="baseline">
                <Text size="xs" tt="uppercase" fw={700} c="dimmed" lts={0.8}>
                  Activity · last 30 days
                </Text>
                <Text size="xs" c="dimmed">
                  {totalLast30} {totalLast30 === 1 ? 'test' : 'tests'}
                </Text>
              </Group>
              <ActivitySparkline data={dailyCounts} />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {dailyCounts[0] ? formatShortDate(dailyCounts[0].date) : ''}
                </Text>
                <Text size="xs" c="dimmed">
                  Today
                </Text>
              </Group>
            </Stack>
          </Card>
        )}

        {loaded && recent.length > 0 && (
          <Stack gap="xs">
            <Text size="xs" tt="uppercase" fw={700} c="parchment.0" lts={0.8} style={{ opacity: 0.85 }}>
              Recent tests
            </Text>
            <Stack gap={8}>
              {recent.map((t) => (
                <TestHistoryRow
                  key={t.id}
                  test={t}
                  onClick={() => navigate({ to: '/tests/$testId/recap', params: { testId: t.id } })}
                />
              ))}
            </Stack>
          </Stack>
        )}

        {loaded && recent.length === 0 && !openInProgress && (
          <Card withBorder radius="md" p="md">
            <Text size="sm" c="dimmed">
              No completed tests yet. Your first witnessed test will appear here.
            </Text>
          </Card>
        )}
      </Stack>

      <TestCreationModal
        opened={opened}
        onClose={() => setOpened(false)}
        onCreated={(id) => navigate({ to: '/tests/$testId', params: { testId: id } })}
        studentId={user.id}
      />
    </Container>
  );
}

function TestHistoryRow({ test, onClick }: { test: RecentTestRow; onClick: () => void }) {
  const typeLabel = test.test_type === 'newly_memorized' ? 'New lesson' : 'Revision';
  const range = test.ranges?.length ? compactRangeLabel(test.ranges) : '—';
  const when = test.ended_at ? formatRelative(test.ended_at) : '—';

  return (
    <UnstyledButton onClick={onClick} style={{ width: '100%' }}>
      <Card
        withBorder
        radius="md"
        p="sm"
        style={{ cursor: 'pointer' }}
        styles={{
          root: { transition: 'transform 120ms ease, box-shadow 120ms ease' },
        }}
      >
        <Group justify="space-between" wrap="nowrap" align="center">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap={8} wrap="nowrap">
              <Badge size="sm" variant="light" color={test.test_type === 'newly_memorized' ? 'honey' : 'sage'}>
                {typeLabel}
              </Badge>
              <Text size="sm" fw={500} truncate>
                {range}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {when}
            </Text>
          </Stack>
          {test.rating && (
            <Badge color={ratingColor(test.rating)} variant="filled" size="sm">
              {ratingLabel(test.rating)}
            </Badge>
          )}
        </Group>
      </Card>
    </UnstyledButton>
  );
}

function ActivitySparkline({ data }: { data: { date: Date; count: number }[] }) {
  const W = 600;
  const H = 56;
  const gap = 3;
  const barWidth = (W - gap * (data.length - 1)) / data.length;
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: H, display: 'block' }}
      aria-label={`Tests per day for the last ${data.length} days`}
    >
      {data.map((d, i) => {
        const x = i * (barWidth + gap);
        const empty = d.count === 0;
        const h = empty ? 2 : Math.max(3, (d.count / maxCount) * (H - 4));
        const y = H - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={1.5}
            fill={empty ? 'var(--mantine-color-sage-1)' : 'var(--mantine-color-sage-7)'}
          >
            <title>{`${formatShortDate(d.date)} · ${d.count} ${d.count === 1 ? 'test' : 'tests'}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function buildDailyCounts(rows: { ended_at: string }[]): { date: Date; count: number }[] {
  const bucket = new Map<string, number>();
  for (const r of rows) {
    if (!r.ended_at) continue;
    const key = dayKey(new Date(r.ended_at));
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }
  const out: { date: Date; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = SPARKLINE_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ date: d, count: bucket.get(dayKey(d)) ?? 0 });
  }
  return out;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} ${day === 1 ? 'day' : 'days'} ago`;
  if (day < 30) {
    const wk = Math.round(day / 7);
    return `${wk} ${wk === 1 ? 'week' : 'weeks'} ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function compactRangeLabel(ranges: TestRange[]): string {
  return ranges
    .map((r) => {
      switch (r.type) {
        case 'page':
          return r.start === r.end ? `p. ${r.start}` : `p. ${r.start}–${r.end}`;
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

interface TeacherTestRow extends RecentTestRow {
  student_id: string;
}

interface TeacherHistoryResult {
  tests: TeacherTestRow[];
  studentNames: Map<string, string>;
}

const TEACHER_HISTORY_LIMIT = 30;

async function fetchTeacherTestHistory(teacherId: string): Promise<TeacherHistoryResult> {
  const { data, error } = await supabase
    .from('test')
    .select('id, test_type, status, rating, ended_at, ranges, student_id')
    .eq('teacher_id', teacherId)
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })
    .limit(TEACHER_HISTORY_LIMIT);
  if (error) throw error;
  const tests = (data ?? []) as TeacherTestRow[];

  const studentIds = Array.from(new Set(tests.map((t) => t.student_id)));
  const studentNames = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: users } = await supabase
      .from('app_user')
      .select('id, display_name')
      .in('id', studentIds);
    for (const u of (users ?? []) as Array<{ id: string; display_name: string | null }>) {
      if (u.display_name) studentNames.set(u.id, u.display_name);
    }
  }
  return { tests, studentNames };
}

function TeacherTestsHistory({ teacherId }: { teacherId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['teacher_tests_history', teacherId],
    queryFn: () => fetchTeacherTestHistory(teacherId),
    staleTime: 30_000,
  });

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" c="parchment.0" fw={700} lts={0.8} style={{ opacity: 0.85 }}>
            Tests
          </Text>
          <Group gap="xs" align="center">
            <ClipboardList size={26} color="var(--mantine-color-parchment-0)" />
            <Title order={2} c="parchment.0">
              Tests you administered
            </Title>
          </Group>
          <Text c="parchment.0" size="sm" style={{ opacity: 0.75 }}>
            Every witnessed test you ran with one of your students. Tap a row to see the recap.
          </Text>
        </Stack>

        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" color="sage.7" />
            <Text size="sm" c="parchment.0" style={{ opacity: 0.85 }}>
              Loading history…
            </Text>
          </Group>
        ) : !data || data.tests.length === 0 ? (
          <Card withBorder radius="md" p="lg">
            <Stack gap={6}>
              <Text fw={600}>No tests yet</Text>
              <Text size="sm" c="dimmed">
                Start a witnessed test from a student's drill-in page. Completed tests will appear
                here.
              </Text>
            </Stack>
          </Card>
        ) : (
          <Stack gap={8}>
            {data.tests.map((t) => (
              <TeacherHistoryRow
                key={t.id}
                test={t}
                studentName={data.studentNames.get(t.student_id) ?? 'Unnamed student'}
                onClick={() => navigate({ to: '/tests/$testId/recap', params: { testId: t.id } })}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function TeacherHistoryRow({
  test,
  studentName,
  onClick,
}: {
  test: TeacherTestRow;
  studentName: string;
  onClick: () => void;
}) {
  const typeLabel = test.test_type === 'newly_memorized' ? 'New lesson' : 'Revision';
  const range = test.ranges?.length ? compactRangeLabel(test.ranges) : '—';
  const when = test.ended_at ? formatRelative(test.ended_at) : '—';

  return (
    <UnstyledButton onClick={onClick} style={{ width: '100%' }}>
      <Card withBorder radius="md" p="sm" style={{ cursor: 'pointer' }}>
        <Group justify="space-between" wrap="nowrap" align="center">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap={8} wrap="nowrap" align="center">
              <GraduationCap size={14} color="var(--mantine-color-mihrab-9)" />
              <Text size="sm" fw={600} truncate>
                {studentName}
              </Text>
              <Badge size="xs" variant="light" color={test.test_type === 'newly_memorized' ? 'honey' : 'sage'}>
                {typeLabel}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {range} · {when}
            </Text>
          </Stack>
          {test.rating && (
            <Badge color={ratingColor(test.rating)} variant="filled" size="sm">
              {ratingLabel(test.rating)}
            </Badge>
          )}
        </Group>
      </Card>
    </UnstyledButton>
  );
}

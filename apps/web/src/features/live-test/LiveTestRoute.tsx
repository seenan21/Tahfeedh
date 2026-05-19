import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ActionIcon, Alert, Button, Center, Container, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LogErrorInput, PostTestSummary, TestRange, TestType } from '@tahfeedh/shared';
import { supabase } from '../../lib/supabase';
import { MushafPage } from '../../mushaf/MushafPage';
import { ErrorLogModal } from './ErrorLogModal';
import { ErrorLogPane } from './ErrorLogPane';
import { PostTestSummaryModal } from './PostTestSummaryModal';
import { useTestPages } from './useTestPages';
import { useTestSession } from './useTestSession';

interface TestRow {
  id: string;
  test_type: TestType;
  status: 'in_progress' | 'completed' | 'abandoned';
  ranges: TestRange[];
  test_mode: 'enrolled_teacher' | 'guest_teacher';
  guest_tester_name: string | null;
}

function rangeLabel(ranges: TestRange[]): string {
  return ranges
    .map((r) => {
      switch (r.type) {
        case 'page':
          return r.start === r.end ? `page ${r.start}` : `pages ${r.start}–${r.end}`;
        case 'surah':
          return `surah ${r.surah}`;
        case 'ayah':
          return `surah ${r.surah}:${r.start_ayah}–${r.end_ayah}`;
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

export function LiveTestRoute() {
  const navigate = useNavigate();
  const params = useParams({ from: '/_authed/tests/$testId' });
  const testId = params.testId;

  const [test, setTest] = useState<TestRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [modalLocation, setModalLocation] = useState<
    | { surah: number; ayah: number; word_position: number }
    | null
  >(null);
  const [summary, setSummary] = useState<PostTestSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const session = useTestSession(testId);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    supabase
      .from('test')
      .select('id, test_type, status, ranges, test_mode, guest_tester_name')
      .eq('id', testId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoadError(error?.message ?? 'test not found');
          return;
        }
        setTest(data as TestRow);
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const pages = useTestPages(test?.ranges);
  const currentPage = pages[pageIndex] ?? 1;

  const handleWordTap = (info: { surah: number; ayah: number; position: number }) => {
    setModalLocation({ surah: info.surah, ayah: info.ayah, word_position: info.position });
  };

  const handleSubmitError = async (input: LogErrorInput) => {
    await session.logError(input);
  };

  const handleEndTest = async (rating: import('@tahfeedh/shared').TestRating, notes?: string) => {
    const s = await session.finishTest(rating, notes);
    setSummary(s);
    setSummaryOpen(true);
  };

  const handleSummaryClose = () => {
    setSummaryOpen(false);
    navigate({ to: '/today' });
  };

  const rangeLabelStr = useMemo(() => (test ? rangeLabel(test.ranges) : ''), [test]);

  if (loadError) {
    return (
      <Container py="md">
        <Stack gap="sm">
          <Text c="parchment.0" fw={700} fz="lg">
            Live test
          </Text>
          <Alert color="brick" title="Failed to load test">
            {loadError}
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
  if (!test) {
    return (
      <Container py="md">
        <Stack gap="sm" align="center" mih={300} justify="center">
          <Loader color="parchment.0" />
          <Text c="parchment.0" size="sm">
            Loading test {testId.slice(0, 8)}…
          </Text>
        </Stack>
      </Container>
    );
  }
  if (test.status !== 'in_progress' && !summaryOpen) {
    return (
      <Container py="md">
        <Stack gap="sm">
          <Text c="parchment.0" fw={700} fz="lg">
            Live test
          </Text>
          <Alert>This test is already {test.status}.</Alert>
          <Group>
            <Button onClick={() => navigate({ to: '/today' })}>Back to Today</Button>
          </Group>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap={2} mb="md">
        <Text size="xs" tt="uppercase" c="parchment.0" fw={700} lts={0.8} style={{ opacity: 0.85 }}>
          Live test
        </Text>
        <Text c="parchment.0" fw={700} fz="lg">
          {test.test_type === 'newly_memorized' ? 'New lesson' : 'Revision'} · {rangeLabelStr}
        </Text>
      </Stack>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <Stack gap="sm">
          <Paper p="xs" radius="md" withBorder>
            <Group justify="space-between">
              <Group gap={6}>
                <ActionIcon
                  variant="subtle"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft size={16} />
                </ActionIcon>
                <Text size="sm" fw={600}>
                  Page {currentPage}
                </Text>
                <Text size="xs" c="dimmed">
                  ({pageIndex + 1}/{pages.length})
                </Text>
                <ActionIcon
                  variant="subtle"
                  disabled={pageIndex >= pages.length - 1}
                  onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
                >
                  <ChevronRight size={16} />
                </ActionIcon>
              </Group>
              <Text size="xs" c="dimmed">
                Tap a word to log an error
              </Text>
            </Group>
          </Paper>
          <MushafPage
            pageNumber={currentPage}
            onWordTap={handleWordTap}
            // No overlays during the live test — markers would distract from
            // recitation. Errors are shown in the right pane instead.
          />
        </Stack>

        <ErrorLogPane
          testType={test.test_type}
          guestTesterName={test.guest_tester_name}
          errors={session.errors}
          rangeLabel={rangeLabelStr}
          onEndTest={handleEndTest}
          submitting={session.submitting}
        />
      </div>

      <ErrorLogModal
        opened={modalLocation != null}
        onClose={() => setModalLocation(null)}
        location={modalLocation}
        onSubmit={handleSubmitError}
      />

      <PostTestSummaryModal
        opened={summaryOpen}
        onClose={handleSummaryClose}
        summary={summary}
      />
    </Container>
  );
}

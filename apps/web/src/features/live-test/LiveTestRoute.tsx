import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useRouteContext } from '@tanstack/react-router';
import { ActionIcon, Alert, Button, Center, Container, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LogErrorInput, PostTestSummary, TestRange, TestType } from '@tahfeedh/shared';
import { supabase } from '../../lib/supabase';
import { toastError } from '../../lib/toast';
import { MushafPage } from '../../mushaf/MushafPage';
import { loggedErrorsToStats } from '../../mushaf/getOverlayMarkers';
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
  started_at: string;
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
  const { user } = useRouteContext({ from: '/_authed/tests/$testId' });

  const [test, setTest] = useState<TestRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [modalLocation, setModalLocation] = useState<
    | { surah: number; ayah: number; word_position: number | null }
    | null
  >(null);
  const [summary, setSummary] = useState<PostTestSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [finishedDuration, setFinishedDuration] = useState<number | null>(null);

  const session = useTestSession(testId, user.id);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    supabase
      .from('test')
      .select('id, test_type, status, ranges, test_mode, guest_tester_name, started_at')
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

  const handleVerseNumberTap = (info: { surah: number; ayah: number }) => {
    // ADR 0035 — verse-end glyph (۝) tap anchors a verse-scope error.
    setModalLocation({ surah: info.surah, ayah: info.ayah, word_position: null });
  };

  const handleSubmitError = async (input: LogErrorInput) => {
    try {
      await session.logError(input);
    } catch (err) {
      toastError(err, 'Failed to log error');
      throw err;
    }
  };

  const handleEndTest = async (rating: import('@tahfeedh/shared').TestRating, notes?: string) => {
    try {
      const s = await session.finishTest(rating, notes);
      if (test?.started_at) {
        setFinishedDuration(Math.floor((Date.now() - new Date(test.started_at).getTime()) / 1000));
      }
      setSummary(s);
      setSummaryOpen(true);
    } catch (err) {
      toastError(err, 'Could not end the test');
      throw err;
    }
  };

  const handleSummaryClose = () => {
    setSummaryOpen(false);
    navigate({ to: '/today' });
  };

  const rangeLabelStr = useMemo(() => (test ? rangeLabel(test.ranges) : ''), [test]);

  // Live-test overlay: convert the running session's logged errors into the
  // stats-row shape getOverlayMarkers expects, so each tap immediately tints
  // the corresponding word on the mushaf as feedback to the witness.
  const liveOverlay = useMemo(() => loggedErrorsToStats(session.errors), [session.errors]);

  // Redirect completed/abandoned tests to the read-only recap route.
  // Must live in an effect — calling navigate during render is a side effect.
  useEffect(() => {
    if (test && test.status !== 'in_progress' && !summaryOpen) {
      navigate({ to: '/tests/$testId/recap', params: { testId }, replace: true });
    }
  }, [test, summaryOpen, navigate, testId]);

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
    // The redirect-to-recap effect above is running; render a loader spinner
    // while the navigation lands instead of flashing a stale alert.
    return (
      <Container py="md">
        <Stack gap="sm" align="center" mih={300} justify="center">
          <Loader color="parchment.0" />
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
        className="liveTestGrid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <style>{`
          @media (max-width: 900px) {
            .liveTestGrid { grid-template-columns: 1fr !important; }
          }
        `}</style>
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
            onVerseNumberTap={handleVerseNumberTap}
            overlays={liveOverlay}
            overlayMode="heatmap"
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
        durationSec={finishedDuration}
        loggedErrors={session.errors}
      />
    </Container>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  ActionIcon,
  Box,
  Group,
  NumberInput,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MemorizationStatus, NextNewLesson } from '@tahfeedh/shared';
import { homeRouteForRole } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { quranIndex } from '../data/quran-data';
import { MushafGrid } from '../mushaf/MushafGrid';
import { MushafPage } from '../mushaf/MushafPage';
import { PageDetailsPanel } from '../mushaf/PageDetailsPanel';
import classes from '../mushaf/MushafRoute.module.css';

export const Route = createFileRoute('/_authed/mushaf')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: MushafRoute,
});

interface MemorizedPageRow {
  page_number: number;
  status: MemorizationStatus;
}

const LAST_PAGE_KEY = 'tahfeedh:mushaf:lastPage';

async function fetchPages(studentId: string): Promise<MemorizedPageRow[]> {
  const { data, error } = await supabase
    .from('memorization_page')
    .select('page_number, status')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data as MemorizedPageRow[] | null) ?? [];
}

function readStoredPage(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LAST_PAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 604) return null;
  return Math.floor(n);
}

function MushafRoute() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'reader' | 'grid'>('reader');
  const [selectedPage, setSelectedPage] = useState<number>(() => readStoredPage() ?? 0);
  const [pendingJump, setPendingJump] = useState<number | string>('');

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['memorization_pages', user.id],
    queryFn: () => fetchPages(user.id),
    staleTime: 30_000,
  });

  const pageStatus = useMemo(() => {
    const m = new Map<number, MemorizationStatus>();
    for (const row of pagesData ?? []) m.set(row.page_number, row.status);
    return m;
  }, [pagesData]);

  // Determine the initial page once data is available, if we don't have one yet.
  useEffect(() => {
    if (selectedPage > 0) return;
    const cached = queryClient.getQueryData<NextNewLesson | null>(['next_new_lesson', user.id]);
    if (cached?.page_number) {
      setSelectedPage(cached.page_number);
      return;
    }
    // Last resort — page 1.
    setSelectedPage(1);
  }, [selectedPage, queryClient, user.id]);

  useEffect(() => {
    if (selectedPage > 0 && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_PAGE_KEY, String(selectedPage));
    }
  }, [selectedPage]);

  const currentJuz = useMemo(() => {
    if (selectedPage < 1) return null;
    for (const [juzStr, info] of Object.entries(quranIndex.juzs)) {
      const [start, end] = info.pages;
      if (selectedPage >= start && selectedPage <= end) return Number(juzStr);
    }
    return null;
  }, [selectedPage]);

  function goPrev() {
    setSelectedPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setSelectedPage((p) => Math.min(604, p + 1));
  }
  function applyJump() {
    const n = typeof pendingJump === 'number' ? pendingJump : Number(pendingJump);
    if (!Number.isFinite(n) || n < 1 || n > 604) return;
    setSelectedPage(Math.floor(n));
    setPendingJump('');
  }

  return (
    <Stack maw={1240} mx="auto" gap="md" py="md">
      {/* Hero strip */}
      <Stack gap={4}>
        <Text size="xs" tt="uppercase" c="parchment.0" fw={700} lts={0.8} style={{ opacity: 0.85 }}>
          My Mushaf
        </Text>
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Stack gap={0}>
            <Text
              component="h1"
              style={{
                fontFamily: 'Cairo, sans-serif',
                fontWeight: 700,
                fontSize: 32,
                lineHeight: 1.1,
                direction: 'rtl',
                color: 'var(--mantine-color-parchment-0)',
                margin: 0,
              }}
            >
              مصحفي
            </Text>
            <Text
              component="h2"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: 24,
                lineHeight: 1.1,
                color: 'var(--mantine-color-parchment-0)',
                margin: 0,
              }}
            >
              Read · Track · Review
            </Text>
          </Stack>
          <SegmentedControl
            value={viewMode}
            onChange={(v) => setViewMode(v as 'reader' | 'grid')}
            data={[
              { label: 'Reader', value: 'reader' },
              { label: 'Tracker', value: 'grid' },
            ]}
          />
        </Group>
      </Stack>

      {/* Reader toolbar */}
      {viewMode === 'reader' && (
        <Group justify="space-between" wrap="wrap" gap="sm" className={classes.toolbar}>
          <Group gap={6} align="center">
            <Tooltip label="Previous page" withArrow>
              <ActionIcon
                variant="default"
                radius="xl"
                size="lg"
                onClick={goPrev}
                disabled={selectedPage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </ActionIcon>
            </Tooltip>
            <Stack gap={0} align="center">
              <Text size="xs" c="dimmed" fw={600}>
                Page {selectedPage || '—'} / 604
              </Text>
              {currentJuz && (
                <Text size="xs" c="dimmed">
                  Juz {currentJuz}
                </Text>
              )}
            </Stack>
            <Tooltip label="Next page" withArrow>
              <ActionIcon
                variant="default"
                radius="xl"
                size="lg"
                onClick={goNext}
                disabled={selectedPage >= 604}
                aria-label="Next page"
              >
                <ChevronRight size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <Group gap="xs" align="center">
            <Text size="xs" c="dimmed">
              Jump to
            </Text>
            <NumberInput
              size="xs"
              w={88}
              min={1}
              max={604}
              value={pendingJump}
              onChange={(v) => setPendingJump(v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyJump();
              }}
              hideControls
              placeholder="1–604"
            />
          </Group>
        </Group>
      )}

      {/* Main canvas */}
      {viewMode === 'reader' ? (
        selectedPage > 0 ? (
          <Box className={classes.readerLayout}>
            <Box className={classes.mushafColumn}>
              <MushafPage pageNumber={selectedPage} />
            </Box>
            <Box className={classes.detailsColumn}>
              <PageDetailsPanel
                studentId={user.id}
                pageNumber={selectedPage}
                pageStatus={pageStatus}
              />
            </Box>
          </Box>
        ) : (
          <Skeleton height={480} radius="lg" />
        )
      ) : pagesLoading ? (
        <Stack gap="sm">
          <Skeleton height={80} radius="lg" />
          <Skeleton height={80} radius="lg" />
          <Skeleton height={80} radius="lg" />
        </Stack>
      ) : (
        <MushafGrid
          pageStatus={pageStatus}
          initialExpandedJuz={currentJuz}
          onPick={(p) => {
            setSelectedPage(p);
            setViewMode('reader');
          }}
        />
      )}
    </Stack>
  );
}

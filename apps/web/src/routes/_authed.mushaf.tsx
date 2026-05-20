import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  ActionIcon,
  Box,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ErrorLocationStatsRow, MemorizationStatus, NextNewLesson } from '@tahfeedh/shared';
import type { OverlayMode } from '../mushaf/MushafPage';
import type { OverlayMarker } from '../mushaf/getOverlayMarkers';
import { homeRouteForRole } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { CHAPTERS, chapter, quranIndex } from '../data/quran-data';
import { ErrorDetailModal } from '../mushaf/ErrorDetailModal';
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

async function fetchErrorStats(studentId: string): Promise<ErrorLocationStatsRow[]> {
  const { data, error } = await supabase
    .from('error_location_stats')
    .select(
      'id, student_id, signature, surah_number, ayah_number, word_position, error_type, ' +
        'occurrence_count, first_seen_at, last_seen_at, tests_since_last_occurrence, cleared, updated_at',
    )
    .eq('student_id', studentId)
    .eq('cleared', false);
  if (error) throw error;
  return (data as unknown as ErrorLocationStatsRow[] | null) ?? [];
}

// Per user pref: "Show errors" always starts ON each time the route mounts.
// The toggle is still a per-session control — flipping it off only lasts for
// the current visit; the next time you arrive at /mushaf, errors are on again.
function initialOverlayMode(): OverlayMode {
  return 'heatmap';
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

  const [overlayMode, setOverlayMode] = useState<OverlayMode>(() => initialOverlayMode());
  const [tappedMarker, setTappedMarker] = useState<OverlayMarker | null>(null);

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['memorization_pages', user.id],
    queryFn: () => fetchPages(user.id),
    staleTime: 30_000,
  });

  const { data: errorStats } = useQuery({
    queryKey: ['error_location_stats', user.id],
    queryFn: () => fetchErrorStats(user.id),
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

  // Drive the chapter Select value from the current page so prev/next/jump
  // navigation keeps the dropdown in sync. Uses the page's `surah_start` —
  // when a page straddles two surahs, the one beginning the page wins.
  const currentSurah = useMemo<number | null>(() => {
    if (selectedPage < 1) return null;
    return quranIndex.pages[String(selectedPage)]?.surah_start ?? null;
  }, [selectedPage]);

  // Built once: `{value, label}` rows for all 114 chapters. Including the id
  // in the searchable label means "2", "baqarah", and "البقرة" all match.
  const chapterOptions = useMemo(
    () =>
      CHAPTERS.map((c) => ({
        value: String(c.id),
        label: `${c.id}. ${c.name_simple} · ${c.name_arabic}`,
      })),
    [],
  );

  function handleChapterChange(value: string | null) {
    if (!value) return;
    const ch = chapter(Number(value));
    if (!ch) return;
    setSelectedPage(ch.pages[0]);
  }

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

      {/* Reader toolbar — three-column grid: chapter Select · page flipper · controls */}
      {viewMode === 'reader' && (
        <Box className={`${classes.toolbar} ${classes.toolbarGrid}`}>
          <Box className={classes.toolbarLeft}>
            <Select
              size="xs"
              w={260}
              searchable
              placeholder="Jump to surah…"
              value={currentSurah != null ? String(currentSurah) : null}
              onChange={handleChapterChange}
              data={chapterOptions}
              nothingFoundMessage="—"
              comboboxProps={{ withinPortal: true, shadow: 'md' }}
              styles={{
                input: {
                  background: 'rgba(255, 255, 193, 0.10)',
                  borderColor: 'rgba(255, 255, 193, 0.22)',
                  color: 'var(--mantine-color-parchment-0)',
                },
              }}
              aria-label="Jump to surah"
            />
          </Box>

          <Group className={classes.toolbarCenter} gap={6} align="center" wrap="nowrap">
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
              <Text size="xs" c="parchment.0" fw={600} style={{ opacity: 0.92 }}>
                Page {selectedPage || '—'} / 604
              </Text>
              {currentJuz && (
                <Text size="xs" c="parchment.0" style={{ opacity: 0.7 }}>
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

          <Group className={classes.toolbarRight} gap="md" align="center" wrap="nowrap">
            <Switch
              size="sm"
              label="Show errors"
              checked={overlayMode === 'heatmap'}
              onChange={(e) => setOverlayMode(e.currentTarget.checked ? 'heatmap' : 'none')}
              color="sage.5"
              styles={{
                label: {
                  fontSize: 12,
                  color: 'var(--mantine-color-parchment-0)',
                  opacity: 0.92,
                },
                track: { cursor: 'pointer' },
              }}
            />
            <Group gap="xs" align="center">
              <Text size="xs" c="parchment.0" style={{ opacity: 0.85 }}>
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
        </Box>
      )}

      {/* Main canvas */}
      {viewMode === 'reader' ? (
        selectedPage > 0 ? (
          <Box className={classes.readerLayout}>
            <Box className={classes.mushafColumn}>
              <MushafPage
                pageNumber={selectedPage}
                overlays={errorStats}
                overlayMode={overlayMode}
                onMarkerTap={(marker) => setTappedMarker(marker)}
                onVerseNumberTap={(info) =>
                  // ADR 0035 — verse-end tap with no marker still opens the
                  // drill-up modal so the user can see "anything ever logged
                  // on this ayah?" Synthetic marker with scope='verse'.
                  setTappedMarker({
                    scope: 'verse',
                    surah: info.surah,
                    ayah: info.ayah,
                    count: 0,
                    intensity: 0,
                    dominantType: 'tajweed',
                    color: 'transparent',
                    signatures: [],
                  })
                }
              />
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

      <ErrorDetailModal
        studentId={user.id}
        marker={tappedMarker}
        stats={errorStats ?? []}
        onClose={() => setTappedMarker(null)}
      />
    </Stack>
  );
}

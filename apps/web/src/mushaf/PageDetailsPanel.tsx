import { useMemo } from 'react';
import { Badge, Divider, Group, Skeleton, Stack, Text } from '@mantine/core';
import { Activity, ClipboardList, History } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { ErrorType, MemorizationStatus, TestRating, TestType } from '@tahfeedh/shared';
import { supabase } from '../lib/supabase';
import { chapter, quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';
import classes from './PageDetailsPanel.module.css';

interface PageDetailsPanelProps {
  studentId: string;
  pageNumber: number;
  pageStatus: Map<number, MemorizationStatus>;
}

interface MemorizationPageRow {
  status: MemorizationStatus;
  memorized_at: string | null;
  updated_at: string | null;
}

interface ReviewSummary {
  lastReviewedAt: string | null;
  oldestReviewedAt: string | null;
  ayahsCovered: number;
  totalAyahsOnPage: number;
}

interface PageSegment {
  surah: number;
  minAyah: number;
  maxAyah: number;
}

function pageSegments(pageNumber: number): PageSegment[] {
  const info = quranIndex.pages[String(pageNumber)];
  if (!info) return [];
  if (info.surah_start === info.surah_end) {
    return [{ surah: info.surah_start, minAyah: info.ayah_start, maxAyah: info.ayah_end }];
  }
  const out: PageSegment[] = [];
  const firstSurah = quranIndex.surahs[String(info.surah_start)];
  if (firstSurah) {
    out.push({
      surah: info.surah_start,
      minAyah: info.ayah_start,
      maxAyah: firstSurah.ayah_count,
    });
  }
  for (let s = info.surah_start + 1; s < info.surah_end; s++) {
    const mid = quranIndex.surahs[String(s)];
    if (!mid) continue;
    out.push({ surah: s, minAyah: 1, maxAyah: mid.ayah_count });
  }
  out.push({ surah: info.surah_end, minAyah: 1, maxAyah: info.ayah_end });
  return out;
}

function countAyahs(segments: PageSegment[]): number {
  let total = 0;
  for (const s of segments) total += s.maxAyah - s.minAyah + 1;
  return total;
}

async function fetchPageRow(
  studentId: string,
  pageNumber: number,
): Promise<MemorizationPageRow | null> {
  const { data, error } = await supabase
    .from('memorization_page')
    .select('status, memorized_at, updated_at')
    .eq('student_id', studentId)
    .eq('page_number', pageNumber)
    .maybeSingle();
  if (error) throw error;
  return data as MemorizationPageRow | null;
}

interface ErrorSummary {
  total: number;
  byType: Array<{ error_type: ErrorType; count: number }>;
}

interface RecentTestRow {
  id: string;
  test_type: TestType;
  rating: TestRating | null;
  ended_at: string | null;
}

async function fetchErrorSummary(
  studentId: string,
  pageNumber: number,
): Promise<ErrorSummary> {
  const segments = pageSegments(pageNumber);
  if (segments.length === 0) return { total: 0, byType: [] };

  const { data, error } = await supabase
    .from('error_location_stats')
    .select('surah_number, ayah_number, error_type, occurrence_count, cleared')
    .eq('student_id', studentId)
    .eq('cleared', false)
    .in(
      'surah_number',
      segments.map((s) => s.surah),
    );
  if (error) throw error;

  const onPage = (data ?? []).filter((r) => {
    const seg = segments.find((s) => s.surah === r.surah_number);
    if (!seg) return false;
    return r.ayah_number >= seg.minAyah && r.ayah_number <= seg.maxAyah;
  });

  let total = 0;
  const byTypeMap = new Map<ErrorType, number>();
  for (const r of onPage) {
    total += r.occurrence_count;
    byTypeMap.set(
      r.error_type as ErrorType,
      (byTypeMap.get(r.error_type as ErrorType) ?? 0) + r.occurrence_count,
    );
  }
  const byType = Array.from(byTypeMap.entries())
    .map(([error_type, count]) => ({ error_type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { total, byType };
}

async function fetchRecentTestsOnPage(
  studentId: string,
  pageNumber: number,
): Promise<RecentTestRow[]> {
  // Cheap filter: any completed test with a 'page' range containing this page,
  // or any range type that almost certainly overlaps. For the demo we keep it
  // simple — pull recent completed tests and let the caller see them.
  const { data, error } = await supabase
    .from('test')
    .select('id, test_type, rating, ended_at, ranges, student_id, status')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  const hits: RecentTestRow[] = [];
  for (const row of data ?? []) {
    const ranges = (row.ranges ?? []) as Array<{ type: string; start?: number; end?: number }>;
    const overlaps = ranges.some((r) => {
      if (r.type !== 'page') return false;
      return (r.start ?? 0) <= pageNumber && (r.end ?? 0) >= pageNumber;
    });
    if (overlaps) {
      hits.push({
        id: row.id,
        test_type: row.test_type as TestType,
        rating: row.rating as TestRating | null,
        ended_at: row.ended_at,
      });
    }
    if (hits.length >= 3) break;
  }
  return hits;
}

async function fetchReviewSummary(
  studentId: string,
  pageNumber: number,
): Promise<ReviewSummary> {
  const segments = pageSegments(pageNumber);
  const totalAyahsOnPage = countAyahs(segments);
  if (segments.length === 0) {
    return { lastReviewedAt: null, oldestReviewedAt: null, ayahsCovered: 0, totalAyahsOnPage: 0 };
  }

  const { data, error } = await supabase
    .from('ayah_review_state')
    .select('surah_number, ayah_number, last_reviewed_at')
    .eq('student_id', studentId)
    .in(
      'surah_number',
      segments.map((s) => s.surah),
    );
  if (error) throw error;

  const onPage = (data ?? []).filter((r) => {
    const seg = segments.find((s) => s.surah === r.surah_number);
    if (!seg) return false;
    return r.ayah_number >= seg.minAyah && r.ayah_number <= seg.maxAyah;
  });

  let lastReviewedAt: string | null = null;
  let oldestReviewedAt: string | null = null;
  for (const r of onPage) {
    if (!r.last_reviewed_at) continue;
    if (!lastReviewedAt || r.last_reviewed_at > lastReviewedAt) lastReviewedAt = r.last_reviewed_at;
    if (!oldestReviewedAt || r.last_reviewed_at < oldestReviewedAt)
      oldestReviewedAt = r.last_reviewed_at;
  }

  return {
    lastReviewedAt,
    oldestReviewedAt,
    ayahsCovered: onPage.length,
    totalAyahsOnPage,
  };
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon} mo ago`;
  const yr = Math.floor(mon / 12);
  return `${yr}y ago`;
}

const STATUS_BADGE: Record<MemorizationStatus | 'untouched', { color: string; label: string }> = {
  memorized: { color: 'sage.7', label: 'Memorized' },
  in_progress: { color: 'honey.4', label: 'In progress' },
  untouched: { color: 'gray.4', label: 'Untouched' },
};

export function PageDetailsPanel({ studentId, pageNumber, pageStatus }: PageDetailsPanelProps) {
  const cachedStatus = pageStatus.get(pageNumber) ?? 'untouched';

  const { data: row, isLoading: pageLoading } = useQuery({
    queryKey: ['memorization_page_row', studentId, pageNumber],
    queryFn: () => fetchPageRow(studentId, pageNumber),
    staleTime: 30_000,
  });

  const { data: review, isLoading: reviewLoading } = useQuery({
    queryKey: ['page_review_summary', studentId, pageNumber],
    queryFn: () => fetchReviewSummary(studentId, pageNumber),
    staleTime: 30_000,
  });

  const { data: errorSummary, isLoading: errorsLoading } = useQuery({
    queryKey: ['page_error_summary', studentId, pageNumber],
    queryFn: () => fetchErrorSummary(studentId, pageNumber),
    staleTime: 30_000,
  });

  const { data: recentTests, isLoading: testsLoading } = useQuery({
    queryKey: ['page_recent_tests', studentId, pageNumber],
    queryFn: () => fetchRecentTestsOnPage(studentId, pageNumber),
    staleTime: 30_000,
  });

  const pageInfo = quranIndex.pages[String(pageNumber)];
  const surahLabel = useMemo(() => {
    if (!pageInfo) return '';
    const a = chapter(pageInfo.surah_start);
    const b = chapter(pageInfo.surah_end);
    if (!a) return '';
    if (a.id === b?.id) return a.name_simple;
    return `${a.name_simple} – ${b?.name_simple ?? ''}`;
  }, [pageInfo]);

  const statusInfo = STATUS_BADGE[row?.status ?? cachedStatus];

  return (
    <Stack gap="md" className={classes.panel}>
      {/* Header */}
      <Stack gap={4}>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
          Page details
        </Text>
        <Group justify="space-between" align="baseline">
          <Text fw={600} fz="lg">
            Page {pageNumber}
          </Text>
          <Text
            component="span"
            style={{ fontFamily: 'Amiri, serif', direction: 'rtl' }}
            c="dimmed"
            size="sm"
          >
            {toArabicIndic(pageNumber)}
          </Text>
        </Group>
        {surahLabel && (
          <Text size="sm" c="dimmed">
            {surahLabel}
          </Text>
        )}
        {pageInfo && (
          <Text size="xs" c="dimmed">
            Ayahs {pageInfo.surah_start === pageInfo.surah_end ? `${pageInfo.surah_start}:` : ''}
            {pageInfo.surah_start === pageInfo.surah_end
              ? `${pageInfo.ayah_start}–${pageInfo.ayah_end}`
              : `${pageInfo.surah_start}:${pageInfo.ayah_start} → ${pageInfo.surah_end}:${pageInfo.ayah_end}`}
          </Text>
        )}
      </Stack>

      {/* Status block */}
      <Stack gap={6}>
        <Group gap="xs" align="center">
          <Badge color={statusInfo.color} variant="filled" radius="sm">
            {statusInfo.label}
          </Badge>
          {pageLoading && <Skeleton height={14} width={70} />}
        </Group>
        {row?.memorized_at && (
          <Text size="xs" c="dimmed">
            Memorized {formatRelative(row.memorized_at)}
          </Text>
        )}
      </Stack>

      <Divider />

      {/* Review freshness */}
      <Stack gap={6}>
        <Group gap={6} align="center">
          <Activity size={14} color="var(--mantine-color-mihrab-9)" strokeWidth={2} />
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Review freshness
          </Text>
        </Group>
        {reviewLoading ? (
          <Skeleton height={36} radius="sm" />
        ) : review ? (
          <Stack gap={2}>
            <Text size="sm" fw={500}>
              Last revised {formatRelative(review.lastReviewedAt)}
            </Text>
            <Text size="xs" c="dimmed">
              {review.ayahsCovered} of {review.totalAyahsOnPage} ayahs in the algorithm's input
            </Text>
          </Stack>
        ) : null}
      </Stack>

      <Divider />

      {/* Error summary */}
      <Stack gap={6}>
        <Group gap={6} align="center">
          <ClipboardList size={14} color="var(--mantine-color-mihrab-9)" strokeWidth={2} />
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Errors logged
          </Text>
        </Group>
        {errorsLoading ? (
          <Skeleton height={36} radius="sm" />
        ) : !errorSummary || errorSummary.total === 0 ? (
          <Text size="sm" c="dimmed">
            No errors yet.
          </Text>
        ) : (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {errorSummary.total} occurrence{errorSummary.total === 1 ? '' : 's'} across {errorSummary.byType.length} pattern{errorSummary.byType.length === 1 ? '' : 's'}
            </Text>
            <Group gap={4}>
              {errorSummary.byType.map((b) => (
                <Badge key={b.error_type} variant="light" color="brick" size="sm">
                  {b.error_type.replace('_', ' ')} · {b.count}
                </Badge>
              ))}
            </Group>
          </Stack>
        )}
      </Stack>

      <Divider />

      {/* Recent tests on this page */}
      <Stack gap={6}>
        <Group gap={6} align="center">
          <History size={14} color="var(--mantine-color-mihrab-9)" strokeWidth={2} />
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Recent tests on this page
          </Text>
        </Group>
        {testsLoading ? (
          <Skeleton height={36} radius="sm" />
        ) : !recentTests || recentTests.length === 0 ? (
          <Text size="sm" c="dimmed">
            No tests on this page yet.
          </Text>
        ) : (
          <Stack gap={3}>
            {recentTests.map((t) => (
              <Group key={t.id} justify="space-between">
                <Text size="xs">
                  {t.test_type === 'newly_memorized' ? 'New lesson' : 'Revision'} ·{' '}
                  {t.ended_at ? formatRelative(t.ended_at) : '—'}
                </Text>
                {t.rating && (
                  <Badge size="xs" variant="light">
                    {t.rating}
                  </Badge>
                )}
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

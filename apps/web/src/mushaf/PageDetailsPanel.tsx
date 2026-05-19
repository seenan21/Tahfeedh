import { useMemo } from 'react';
import { Badge, Divider, Group, Skeleton, Stack, Text } from '@mantine/core';
import { Activity, ClipboardList, History } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { MemorizationStatus } from '@tahfeedh/shared';
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
  mastered_at: string | null;
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
    .select('status, memorized_at, mastered_at, updated_at')
    .eq('student_id', studentId)
    .eq('page_number', pageNumber)
    .maybeSingle();
  if (error) throw error;
  return data as MemorizationPageRow | null;
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
  mastered: { color: 'sage.7', label: 'Mastered' },
  memorized: { color: 'sage.4', label: 'Memorized' },
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
        {row?.mastered_at && (
          <Text size="xs" c="dimmed">
            Mastered {formatRelative(row.mastered_at)}
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

      {/* Error summary — Phase D placeholder */}
      <Stack gap={6}>
        <Group gap={6} align="center">
          <ClipboardList size={14} color="var(--mantine-color-mihrab-9)" strokeWidth={2} />
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Errors logged
          </Text>
        </Group>
        <Text size="sm" c="dimmed">
          No errors yet.
        </Text>
        <Text size="xs" c="dimmed">
          The live test flow (Phase D) populates this list as you log mistakes.
        </Text>
      </Stack>

      <Divider />

      {/* Recent tests — Phase D placeholder */}
      <Stack gap={6}>
        <Group gap={6} align="center">
          <History size={14} color="var(--mantine-color-mihrab-9)" strokeWidth={2} />
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Recent tests on this page
          </Text>
        </Group>
        <Text size="sm" c="dimmed">
          No tests recorded yet.
        </Text>
        <Text size="xs" c="dimmed">
          Tests are the only way pages move through the queues. Begin one whenever a witness is ready.
        </Text>
      </Stack>
    </Stack>
  );
}

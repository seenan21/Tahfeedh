import { useState } from 'react';
import {
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Activity, BookOpenCheck, ClipboardCheck } from 'lucide-react';
import type { TestRating } from '@tahfeedh/shared';
import { supabase } from '../../lib/supabase';
import { quranIndex } from '../../data/quran-data';
import {
  cutoffIso,
  isPassingRating,
  summarize,
  windowDays,
  type ActivityWindow,
} from './lib/activityStats';

interface ActivityStatsCardProps {
  studentId: string;
}

interface ReviewedRow {
  surah_number: number;
  ayah_number: number;
  last_reviewed_at: string | null;
}
interface TestRow {
  rating: TestRating | null;
}

async function fetchPagesMemorized(studentId: string, sinceIso: string): Promise<number> {
  const { count, error } = await supabase
    .from('memorization_page')
    .select('memorized_at', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('memorized_at', sinceIso);
  if (error) throw error;
  return count ?? 0;
}

async function fetchPagesReviewed(studentId: string, sinceIso: string): Promise<number> {
  // Pull ayah_review_state rows updated in window; map ayahs → distinct pages
  // via static quranIndex (no surah-level RPC needed).
  const { data, error } = await supabase
    .from('ayah_review_state')
    .select('surah_number, ayah_number, last_reviewed_at')
    .eq('student_id', studentId)
    .gte('last_reviewed_at', sinceIso);
  if (error) throw error;
  const rows = (data as ReviewedRow[] | null) ?? [];
  const distinctPages = new Set<number>();
  for (const r of rows) {
    if (!r.last_reviewed_at) continue;
    const p = pageForAyah(r.surah_number, r.ayah_number);
    if (p != null) distinctPages.add(p);
  }
  return distinctPages.size;
}

async function fetchTestsInWindow(
  studentId: string,
  sinceIso: string,
): Promise<{ total: number; passed: number }> {
  const { data, error } = await supabase
    .from('test')
    .select('rating')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .gte('ended_at', sinceIso);
  if (error) throw error;
  const rows = (data as TestRow[] | null) ?? [];
  let passed = 0;
  for (const t of rows) if (isPassingRating(t.rating)) passed += 1;
  return { total: rows.length, passed };
}

function pageForAyah(surah: number, ayah: number): number | null {
  // O(604) scan once per ayah; for the rolling stats this is fine — 7d window
  // generally produces tens-to-hundreds of ayah rows, not thousands.
  for (let p = 1; p <= quranIndex.total_pages; p++) {
    const info = quranIndex.pages[String(p)];
    if (!info) continue;
    if (surah < info.surah_start || surah > info.surah_end) continue;
    if (surah === info.surah_start && ayah < info.ayah_start) continue;
    if (surah === info.surah_end && ayah > info.ayah_end) continue;
    return p;
  }
  return null;
}

export function ActivityStatsCard({ studentId }: ActivityStatsCardProps) {
  const [window, setWindow] = useState<ActivityWindow>('7d');
  const since = cutoffIso(window);

  const pagesMemorizedQuery = useQuery({
    queryKey: ['activity_pages_memorized', studentId, window],
    queryFn: () => fetchPagesMemorized(studentId, since),
    staleTime: 30_000,
  });
  const pagesReviewedQuery = useQuery({
    queryKey: ['activity_pages_reviewed', studentId, window],
    queryFn: () => fetchPagesReviewed(studentId, since),
    staleTime: 30_000,
  });
  const testsQuery = useQuery({
    queryKey: ['activity_tests', studentId, window],
    queryFn: () => fetchTestsInWindow(studentId, since),
    staleTime: 30_000,
  });

  const loading =
    pagesMemorizedQuery.isLoading ||
    pagesReviewedQuery.isLoading ||
    testsQuery.isLoading;

  const stats = summarize({
    pagesMemorized: pagesMemorizedQuery.data ?? 0,
    pagesReviewed: pagesReviewedQuery.data ?? 0,
    testsCompleted: testsQuery.data?.total ?? 0,
    testsPassed: testsQuery.data?.passed ?? 0,
  });

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Group gap={8} align="center">
          <Activity size={16} color="var(--mantine-color-sage-7)" strokeWidth={2.2} />
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Activity · last {windowDays(window)}d
          </Text>
        </Group>
        <SegmentedControl
          size="xs"
          value={window}
          onChange={(v) => setWindow(v as ActivityWindow)}
          data={[
            { label: '7d', value: '7d' },
            { label: '30d', value: '30d' },
          ]}
        />
      </Group>

      {loading ? (
        <Stack gap="sm">
          <Skeleton height={56} radius="md" />
          <Skeleton height={56} radius="md" />
          <Skeleton height={56} radius="md" />
        </Stack>
      ) : (
        <Stack gap="sm">
          <StatRow
            icon={<BookOpenCheck size={18} color="var(--mantine-color-sage-7)" />}
            label="Pages memorized"
            value={String(stats.pagesMemorized)}
            sub={stats.pagesMemorized === 1 ? 'new page' : 'new pages'}
          />
          <StatRow
            icon={<Activity size={18} color="var(--mantine-color-honey-4)" />}
            label="Pages reviewed"
            value={String(stats.pagesReviewed)}
            sub="distinct pages touched"
          />
          <StatRow
            icon={<ClipboardCheck size={18} color="var(--mantine-color-mihrab-9)" />}
            label="Tests taken"
            value={String(stats.testsCompleted)}
            sub={
              stats.testsCompleted === 0
                ? 'no tests yet'
                : `${Math.round(stats.passRate * 100)}% pass rate`
            }
          />
        </Stack>
      )}
    </Stack>
  );
}

function StatRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Group
      justify="space-between"
      align="center"
      p="sm"
      wrap="nowrap"
      style={{
        borderRadius: 12,
        background: 'rgba(255,255,255,0.55)',
        border: '1px solid rgba(21,53,30,0.06)',
      }}
    >
      <Group gap={10} align="center">
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--mantine-color-parchment-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(21,53,30,0.06)',
          }}
        >
          {icon}
        </div>
        <Stack gap={0}>
          <Text size="sm" fw={600} lh={1.2}>
            {label}
          </Text>
          <Text size="xs" c="dimmed">
            {sub}
          </Text>
        </Stack>
      </Group>
      <Text fw={700} fz="xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
    </Group>
  );
}

import { useMemo } from 'react';
import { Group, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import { Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { quranIndex } from '../../data/quran-data';
import {
  BAND_COLOR,
  BAND_LABEL,
  computeRevisionHealth,
  type AyahReviewRow,
  type JuzRevisionHealth,
  type MemorizedPageRow,
  type StalenessBand,
} from './lib/revisionHealth';

interface RevisionHealthGridProps {
  studentId: string;
}

async function fetchPages(studentId: string): Promise<MemorizedPageRow[]> {
  const { data, error } = await supabase
    .from('memorization_page')
    .select('page_number, status')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data as MemorizedPageRow[] | null) ?? [];
}

async function fetchReviewState(studentId: string): Promise<AyahReviewRow[]> {
  const { data, error } = await supabase
    .from('ayah_review_state')
    .select('surah_number, ayah_number, last_reviewed_at')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data as AyahReviewRow[] | null) ?? [];
}

export function RevisionHealthGrid({ studentId }: RevisionHealthGridProps) {
  const { data: pages, isLoading: pagesLoading } = useQuery({
    queryKey: ['memorization_pages', studentId],
    queryFn: () => fetchPages(studentId),
    staleTime: 30_000,
  });
  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['revision_health_reviews', studentId],
    queryFn: () => fetchReviewState(studentId),
    staleTime: 30_000,
  });

  const health = useMemo(() => {
    if (!pages || !reviews) return null;
    return computeRevisionHealth({
      ayahReviewRows: reviews,
      memorizedPageRows: pages,
      quranIndex,
    });
  }, [pages, reviews]);

  const loading = pagesLoading || reviewsLoading || !health;

  const bandCounts = useMemo(() => {
    const init: Record<StalenessBand, number> = {
      fresh: 0,
      aging: 0,
      stale: 0,
      overdue: 0,
      never: 0,
      untouched: 0,
    };
    if (!health) return init;
    for (const j of health) init[j.band] += 1;
    return init;
  }, [health]);

  return (
    <Stack gap="md">
      <Group gap={8} align="center">
        <Activity size={16} color="var(--mantine-color-sage-7)" strokeWidth={2.2} />
        <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
          Revision health · by juz
        </Text>
      </Group>

      {loading ? (
        <Skeleton height={88} radius="md" />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(30, 1fr)',
              gap: 4,
            }}
          >
            {health!.map((j) => (
              <JuzCell key={j.juzNumber} info={j} />
            ))}
          </div>

          <Group gap="md" mt={4} wrap="wrap">
            <LegendDot color={BAND_COLOR.fresh.bg} label={`Fresh ${bandCounts.fresh}`} />
            <LegendDot color={BAND_COLOR.aging.bg} label={`Aging ${bandCounts.aging}`} />
            <LegendDot color={BAND_COLOR.stale.bg} label={`Stale ${bandCounts.stale}`} />
            <LegendDot color={BAND_COLOR.overdue.bg} label={`Overdue ${bandCounts.overdue}`} />
            <LegendDot color={BAND_COLOR.never.bg} label={`Never ${bandCounts.never}`} />
            <LegendDot color={BAND_COLOR.untouched.bg} label={`Untouched ${bandCounts.untouched}`} />
          </Group>
        </>
      )}
    </Stack>
  );
}

function JuzCell({ info }: { info: JuzRevisionHealth }) {
  const c = BAND_COLOR[info.band];
  const subline = info.band === 'untouched'
    ? 'no memorized pages'
    : info.band === 'never'
    ? 'memorized but never tested'
    : info.daysSinceStalest === 0
    ? 'reviewed today'
    : info.daysSinceStalest === 1
    ? '1d ago'
    : `${info.daysSinceStalest}d ago`;

  return (
    <Tooltip
      withArrow
      openDelay={150}
      position="top"
      label={
        <Stack gap={0}>
          <Text size="xs" fw={600}>
            Juz {info.juzNumber} — {BAND_LABEL[info.band]}
          </Text>
          <Text size="xs" c="dimmed">
            {info.memorizedPages}/{info.totalPages} pages memorized · stalest {subline}
          </Text>
        </Stack>
      }
    >
      <div
        style={{
          aspectRatio: '1 / 1.4',
          borderRadius: 4,
          background: c.bg,
          color: c.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 600,
          boxShadow:
            info.band === 'untouched'
              ? 'inset 0 0 0 1px rgba(21,53,30,0.06)'
              : '0 1px 2px rgba(21,53,30,0.18)',
          transition: 'transform 180ms cubic-bezier(0.4,0,0.2,1)',
          cursor: 'default',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = '';
        }}
      >
        {info.juzNumber}
      </div>
    </Tooltip>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} align="center">
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: color,
          boxShadow: 'inset 0 0 0 1px rgba(21,53,30,0.08)',
        }}
      />
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Group>
  );
}

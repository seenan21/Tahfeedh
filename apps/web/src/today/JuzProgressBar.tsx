import { Group, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';

interface JuzProgressBarProps {
  studentId: string;
}

interface MemorizedPageRow {
  page_number: number;
  status: 'in_progress' | 'memorized';
}

type JuzStatus = 'memorized' | 'in_progress' | 'untouched';

async function fetchPages(studentId: string): Promise<MemorizedPageRow[]> {
  const { data, error } = await supabase
    .from('memorization_page')
    .select('page_number, status')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data as MemorizedPageRow[] | null) ?? [];
}

interface JuzInfo {
  status: JuzStatus;
  pagesLeft: number;
}

function deriveJuzStatuses(rows: MemorizedPageRow[]): Map<number, JuzInfo> {
  const result = new Map<number, JuzInfo>();
  for (let j = 1; j <= 30; j++) {
    const info = quranIndex.juzs[String(j)];
    if (!info) {
      result.set(j, { status: 'untouched', pagesLeft: 0 });
      continue;
    }
    const [start, end] = info.pages;
    const juzLen = end - start + 1;
    let memorized = 0;
    let inProgress = 0;
    for (const r of rows) {
      if (r.page_number < start || r.page_number > end) continue;
      if (r.status === 'memorized') memorized += 1;
      else if (r.status === 'in_progress') inProgress += 1;
    }
    const filled = memorized + inProgress;
    let status: JuzStatus;
    if (memorized >= juzLen) status = 'memorized';
    else if (filled > 0) status = 'in_progress';
    else status = 'untouched';
    const pagesLeft = Math.max(0, juzLen - memorized);
    result.set(j, { status, pagesLeft });
  }
  return result;
}

const STATUS_COLORS: Record<JuzStatus, { bg: string; fg: string }> = {
  memorized:   { bg: 'var(--mantine-color-sage-7)',   fg: 'var(--mantine-color-parchment-0)' },
  in_progress: { bg: 'var(--mantine-color-honey-4)',  fg: 'var(--mantine-color-mihrab-9)' },
  untouched:   { bg: 'rgba(255,255,255,0.65)',        fg: 'rgba(21,53,30,0.45)' },
};

const STATUS_LABEL: Record<JuzStatus, string> = {
  memorized:   'memorized',
  in_progress: 'in progress',
  untouched:   'untouched',
};

export function JuzProgressBar({ studentId }: JuzProgressBarProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['memorization_pages', studentId],
    queryFn: () => fetchPages(studentId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <Skeleton height={72} radius="md" />;
  }

  const rows = data ?? [];
  const statuses = deriveJuzStatuses(rows);
  const counts: Record<JuzStatus, number> = {
    memorized: 0, in_progress: 0, untouched: 0,
  };
  for (const v of statuses.values()) counts[v.status] += 1;

  const completed = counts.memorized;

  return (
    <Stack gap={10}>
      <Group justify="space-between" align="baseline">
        <Group gap={6} align="baseline">
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Hifz progress
          </Text>
          <Text size="xs" c="dimmed">·</Text>
          <Text size="xs" c="dimmed">{completed} of 30 juz</Text>
        </Group>
        <Text
          component="span"
          fw={700}
          style={{ fontFamily: 'Amiri, serif', direction: 'rtl', fontSize: 18 }}
        >
          {toArabicIndic(completed)} / {toArabicIndic(30)}
        </Text>
      </Group>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(30, 1fr)',
          gap: 4,
        }}
      >
        {Array.from({ length: 30 }, (_, i) => {
          const juz = i + 1;
          const info = statuses.get(juz) ?? { status: 'untouched' as JuzStatus, pagesLeft: 0 };
          const c = STATUS_COLORS[info.status];
          const isIncomplete = info.status === 'in_progress' || info.status === 'untouched';
          return (
            <Tooltip
              key={juz}
              label={
                isIncomplete
                  ? `Juz ${juz} — ${STATUS_LABEL[info.status]} · ${info.pagesLeft} page${info.pagesLeft === 1 ? '' : 's'} left`
                  : `Juz ${juz} — ${STATUS_LABEL[info.status]}`
              }
              position="top"
              withArrow
              openDelay={150}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
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
                      info.status === 'untouched'
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
                  {juz}
                </div>
                {isIncomplete ? (
                  <Text
                    size="9px"
                    c="dimmed"
                    ta="center"
                    fw={600}
                    style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
                  >
                    {info.pagesLeft}
                  </Text>
                ) : (
                  <Text size="9px" ta="center" style={{ lineHeight: 1, opacity: 0 }}>
                    &nbsp;
                  </Text>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>

      <Group gap="md" mt={4}>
        <LegendDot color={STATUS_COLORS.memorized.bg} label={`Memorized ${counts.memorized}`} />
        <LegendDot color={STATUS_COLORS.in_progress.bg} label={`In progress ${counts.in_progress}`} />
        <LegendDot color={STATUS_COLORS.untouched.bg} label={`Untouched ${counts.untouched}`} />
      </Group>
    </Stack>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} align="center">
      <span
        style={{
          width: 10, height: 10, borderRadius: 3, background: color,
          boxShadow: 'inset 0 0 0 1px rgba(21,53,30,0.08)',
        }}
      />
      <Text size="xs" c="dimmed">{label}</Text>
    </Group>
  );
}

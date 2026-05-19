import { Stack, Group, Text, Tooltip } from '@mantine/core';
import type { MemorizationStatus } from '@tahfeedh/shared';
import { metadata, quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';
import classes from './MushafGrid.module.css';

export type GridStatus = MemorizationStatus | 'untouched';

interface MushafGridProps {
  pageStatus: Map<number, MemorizationStatus>;
  onPick: (pageNumber: number) => void;
}

const COLORS: Record<GridStatus, { bg: string; fg: string; border: string }> = {
  mastered: {
    bg: 'var(--mantine-color-sage-7)',
    fg: 'var(--mantine-color-parchment-0)',
    border: 'transparent',
  },
  memorized: {
    bg: 'var(--mantine-color-sage-4)',
    fg: 'var(--mantine-color-mihrab-9)',
    border: 'transparent',
  },
  in_progress: {
    bg: 'var(--mantine-color-honey-4)',
    fg: 'var(--mantine-color-mihrab-9)',
    border: 'transparent',
  },
  untouched: {
    bg: 'rgba(255,255,255,0.85)',
    fg: 'rgba(21,53,30,0.55)',
    border: 'rgba(21,53,30,0.10)',
  },
};

const STATUS_LABEL: Record<GridStatus, string> = {
  mastered: 'mastered',
  memorized: 'memorized',
  in_progress: 'in progress',
  untouched: 'untouched',
};

export function MushafGrid({ pageStatus, onPick }: MushafGridProps) {
  return (
    <Stack gap="xl">
      {metadata.juzs.map((juz) => {
        const info = quranIndex.juzs[String(juz.juz_number)];
        if (!info) return null;
        const [start, end] = info.pages;
        const pages: number[] = [];
        for (let p = start; p <= end; p++) pages.push(p);

        return (
          <section key={juz.juz_number} className={classes.juzSection}>
            <Group justify="space-between" align="baseline" mb={8}>
              <Group gap={10} align="baseline">
                <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
                  Juz {juz.juz_number}
                </Text>
                <Text size="xs" c="dimmed">
                  pages {start}–{end}
                </Text>
              </Group>
              <Text
                component="span"
                style={{ fontFamily: 'Amiri, serif', direction: 'rtl' }}
                c="dimmed"
                size="sm"
              >
                {toArabicIndic(juz.juz_number)}
              </Text>
            </Group>

            <div className={classes.pageGrid}>
              {pages.map((p) => {
                const status: GridStatus = pageStatus.get(p) ?? 'untouched';
                const colors = COLORS[status];
                return (
                  <Tooltip
                    key={p}
                    label={`Page ${p} — ${STATUS_LABEL[status]}`}
                    openDelay={150}
                    withArrow
                  >
                    <button
                      type="button"
                      className={classes.cell}
                      onClick={() => onPick(p)}
                      style={{
                        background: colors.bg,
                        color: colors.fg,
                        boxShadow:
                          status === 'untouched'
                            ? `inset 0 0 0 1px ${colors.border}`
                            : '0 1px 2px rgba(21,53,30,0.18)',
                      }}
                      aria-label={`Page ${p} ${STATUS_LABEL[status]}`}
                    >
                      {p}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </section>
        );
      })}
    </Stack>
  );
}

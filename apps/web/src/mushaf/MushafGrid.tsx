import { useState } from 'react';
import { Accordion, Group, Stack, Text, Tooltip } from '@mantine/core';
import { ChevronRight } from 'lucide-react';
import type { MemorizationStatus } from '@tahfeedh/shared';
import { metadata, quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';
import classes from './MushafGrid.module.css';

export type GridStatus = MemorizationStatus | 'untouched';

interface MushafGridProps {
  pageStatus: Map<number, MemorizationStatus>;
  onPick: (pageNumber: number) => void;
  /** When provided, that juz starts expanded. Defaults to all collapsed. */
  initialExpandedJuz?: number | null;
}

const COLORS: Record<GridStatus, { bg: string; fg: string; border: string }> = {
  memorized: {
    bg: 'var(--mantine-color-sage-7)',
    fg: 'var(--mantine-color-parchment-0)',
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
  memorized: 'memorized',
  in_progress: 'in progress',
  untouched: 'untouched',
};

interface JuzSummary {
  total: number;
  memorized: number;
  inProgress: number;
  untouched: number;
}

function summarizeJuz(
  start: number,
  end: number,
  pageStatus: Map<number, MemorizationStatus>,
): JuzSummary {
  const s: JuzSummary = {
    total: end - start + 1,
    memorized: 0,
    inProgress: 0,
    untouched: 0,
  };
  for (let p = start; p <= end; p++) {
    const st = pageStatus.get(p);
    if (st === 'memorized') s.memorized += 1;
    else if (st === 'in_progress') s.inProgress += 1;
    else s.untouched += 1;
  }
  return s;
}

export function MushafGrid({
  pageStatus,
  onPick,
  initialExpandedJuz = null,
}: MushafGridProps) {
  const [opened, setOpened] = useState<string | null>(
    initialExpandedJuz != null ? `juz-${initialExpandedJuz}` : null,
  );

  return (
    <Accordion
      value={opened}
      onChange={setOpened}
      variant="separated"
      radius="lg"
      chevron={<ChevronRight size={16} />}
      classNames={{ chevron: classes.chevron, item: classes.accordionItem }}
    >
      {metadata.juzs.map((juz) => {
        const info = quranIndex.juzs[String(juz.juz_number)];
        if (!info) return null;
        const [start, end] = info.pages;
        const summary = summarizeJuz(start, end, pageStatus);
        const value = `juz-${juz.juz_number}`;
        const pages: number[] = [];
        for (let p = start; p <= end; p++) pages.push(p);

        return (
          <Accordion.Item key={juz.juz_number} value={value}>
            <Accordion.Control>
              <JuzStrip juzNumber={juz.juz_number} start={start} end={end} summary={summary} />
            </Accordion.Control>
            <Accordion.Panel>
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
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}

function JuzStrip({
  juzNumber,
  start,
  end,
  summary,
}: {
  juzNumber: number;
  start: number;
  end: number;
  summary: JuzSummary;
}) {
  const completed = summary.memorized;
  return (
    <Stack gap={6}>
      <Group justify="space-between" align="baseline" wrap="nowrap">
        <Group gap={10} align="baseline">
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Juz {juzNumber}
          </Text>
          <Text size="xs" c="dimmed">
            pages {start}–{end}
          </Text>
        </Group>
        <Group gap={6} align="baseline">
          <Text size="xs" fw={600} c="mihrab.9">
            {completed} / {summary.total}
          </Text>
          <Text component="span" style={{ fontFamily: 'Amiri, serif' }} c="dimmed" size="sm">
            {toArabicIndic(juzNumber)}
          </Text>
        </Group>
      </Group>

      {/* Stacked progress bar — one segment per status, widths proportional. */}
      <div className={classes.progressBar} aria-hidden>
        {summary.memorized > 0 && (
          <span
            className={classes.progressSeg}
            style={{
              flex: summary.memorized,
              background: COLORS.memorized.bg,
            }}
          />
        )}
        {summary.inProgress > 0 && (
          <span
            className={classes.progressSeg}
            style={{
              flex: summary.inProgress,
              background: COLORS.in_progress.bg,
            }}
          />
        )}
        {summary.untouched > 0 && (
          <span
            className={classes.progressSeg}
            style={{
              flex: summary.untouched,
              background: COLORS.untouched.bg,
              boxShadow: `inset 0 0 0 1px ${COLORS.untouched.border}`,
            }}
          />
        )}
      </div>

      <Group gap="md">
        {summary.memorized > 0 && (
          <CountChip color={COLORS.memorized.bg} label={`${summary.memorized} memorized`} />
        )}
        {summary.inProgress > 0 && (
          <CountChip color={COLORS.in_progress.bg} label={`${summary.inProgress} in progress`} />
        )}
        {summary.memorized === 0 && summary.inProgress === 0 && (
          <Text size="xs" c="dimmed">
            untouched
          </Text>
        )}
      </Group>
    </Stack>
  );
}

function CountChip({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} align="center">
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
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

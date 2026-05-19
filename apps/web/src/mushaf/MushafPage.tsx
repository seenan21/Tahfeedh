import { useEffect, useMemo, useState } from 'react';
import { Box, Center, Loader, Stack, Text } from '@mantine/core';
import type { MushafLine, MushafPageData, MushafWord } from '@tahfeedh/shared';
import { chapter, quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';
import classes from './MushafPage.module.css';

/**
 * Overlay descriptor — placeholder shape used by the renderer's overlay props.
 * Real overlay data ships in Phase D (post-test pipeline). For now MushafPage
 * accepts the props so call-sites are forward-compatible.
 */
export interface ErrorOverlay {
  surah: number;
  ayah: number;
  word_position?: number;
  intensity?: number;
  error_type?: string;
}

export type OverlayMode = 'none' | 'simple' | 'heatmap' | 'colored';

export interface MushafPageProps {
  pageNumber: number;
  overlays?: ErrorOverlay[];
  overlayMode?: OverlayMode;
  /** Tap on any word — fires before onVerseTap. */
  onWordTap?: (info: { surah: number; ayah: number; position: number; pageNumber: number }) => void;
  /** Tap on any word, but only the verse coordinates. Convenience for callers
   * that need verse-level resolution (e.g. error logging modal). */
  onVerseTap?: (info: { surah: number; ayah: number; pageNumber: number }) => void;
  /** Optional content slotted above the 15 lines (header). When undefined the
   * component renders its own bilingual page header. */
  header?: React.ReactNode;
  /** Compact mode shrinks the line-height / font-size for grid drill-down peeks. */
  compact?: boolean;
}

interface PageJsonModule {
  default: MushafPageData;
}

async function loadPage(pageNumber: number): Promise<MushafPageData> {
  // Vite resolves this glob at build time so unused page JSONs don't get
  // pulled into the initial bundle.
  const mod = (await import(`../data/pages/${pageNumber}.json`)) as PageJsonModule;
  return mod.default;
}

export function MushafPage({
  pageNumber,
  // overlays — accepted but not yet rendered; real data lands in Phase D.
  overlayMode = 'none',
  onWordTap,
  onVerseTap,
  header,
  compact = false,
}: MushafPageProps) {
  const [data, setData] = useState<MushafPageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    loadPage(pageNumber)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'failed to load page');
      });
    return () => {
      cancelled = true;
    };
  }, [pageNumber]);

  const pageInfo = quranIndex.pages[String(pageNumber)];

  const headerNode = useMemo(() => {
    if (header !== undefined) return header;
    if (!pageInfo) return null;
    const startSurah = chapter(pageInfo.surah_start);
    const endSurah = chapter(pageInfo.surah_end);
    const surahLabel =
      startSurah && endSurah && startSurah.id !== endSurah.id
        ? `${startSurah.name_simple} – ${endSurah.name_simple}`
        : (startSurah?.name_simple ?? '');
    return (
      <div className={classes.header}>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
          Page {pageNumber}
          {surahLabel ? ` · ${surahLabel}` : ''}
        </Text>
        <Text
          component="span"
          fw={700}
          style={{ fontFamily: 'Amiri, serif', direction: 'rtl', fontSize: 16 }}
          c="dimmed"
        >
          {toArabicIndic(pageNumber)}
        </Text>
      </div>
    );
  }, [header, pageNumber, pageInfo]);

  if (error) {
    return (
      <Center mih={200} px="md">
        <Text c="brick.7" size="sm">
          Could not load page {pageNumber}: {error}
        </Text>
      </Center>
    );
  }

  if (!data) {
    return (
      <Center mih={400} role="status" aria-label={`Loading page ${pageNumber}`}>
        <Stack gap="xs" align="center">
          <Loader size="sm" color="sage.7" />
          <Text size="xs" c="dimmed">
            Loading page {toArabicIndic(pageNumber)}
          </Text>
        </Stack>
      </Center>
    );
  }

  const fontFamily = `'QPC V2 P${pageNumber}'`;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-mushaf-word]');
    if (!target) return;
    const surah = Number(target.dataset.surah);
    const ayah = Number(target.dataset.ayah);
    const position = Number(target.dataset.position);
    if (!surah || !ayah || !position) return;
    onWordTap?.({ surah, ayah, position, pageNumber });
    onVerseTap?.({ surah, ayah, pageNumber });
  }

  return (
    <div className={compact ? classes.shellCompact : classes.shell}>
      {headerNode}
      <div
        className="mushaf-page"
        data-overlay-mode={overlayMode}
        onClick={handleClick}
      >
        {data.lines.map((line) => (
          <LineRow
            key={line.line_number}
            line={line}
            fontFamily={fontFamily}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

function LineRow({
  line,
  fontFamily,
  compact,
}: {
  line: MushafLine;
  fontFamily: string;
  compact: boolean;
}) {
  const justify =
    line.line_type === 'surah_name' || line.line_type === 'basmallah' || line.is_centered
      ? 'center'
      : 'space-between';

  if (line.line_type === 'surah_name') {
    const surah = line.surah_number != null ? chapter(line.surah_number) : null;
    return (
      <div className={compact ? classes.surahHeaderCompact : classes.surahHeader}>
        <Box className={classes.surahHeaderInner}>
          <Text
            component="span"
            style={{
              fontFamily: 'Amiri, serif',
              direction: 'rtl',
              fontSize: compact ? 16 : 22,
              fontWeight: 700,
              color: 'var(--mantine-color-mihrab-9)',
            }}
          >
            سورة {surah?.name_arabic ?? ''}
          </Text>
        </Box>
      </div>
    );
  }

  return (
    <div
      className={compact ? classes.lineCompact : classes.line}
      style={{ justifyContent: justify, fontFamily }}
    >
      {line.words.map((w) => (
        <WordSpan key={w.id} word={w} />
      ))}
    </div>
  );
}

function WordSpan({ word }: { word: MushafWord }) {
  return (
    <span
      className="mushaf-word"
      data-mushaf-word=""
      data-surah={word.surah}
      data-ayah={word.ayah}
      data-position={word.position}
      data-char-type={word.char_type}
    >
      {word.code_v2}
    </span>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Box, Center, Loader, Stack, Text } from '@mantine/core';
import type { ErrorLocationStatsRow, MushafLine, MushafPageData, MushafWord } from '@tahfeedh/shared';
import { chapter, quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';
import {
  getOverlayMarkers,
  markerKeyForVerse,
  markerKeyForWord,
  markerKey,
  type OverlayMarker,
} from './getOverlayMarkers';
import classes from './MushafPage.module.css';

/**
 * Two-mode overlay:
 *   'none'    — no markers (clean read)
 *   'heatmap' — recency-weighted intensity color + count badge per location
 *
 * The per-error-type palette (defined in getOverlayMarkers.ts as
 * ERROR_TYPE_COLOR) is reserved for the error log pane / detail modal — the
 * mushaf marker color itself is always intensity-based, not type-based.
 */
export type OverlayMode = 'none' | 'heatmap';

export interface MushafPageProps {
  pageNumber: number;
  /** Aggregated stats rows used by `getOverlayMarkers`. ADR 0011. */
  overlays?: ErrorLocationStatsRow[];
  overlayMode?: OverlayMode;
  /** Optional click handler fired when a rendered marker is tapped. Receives
   * the marker plus the originating MouseEvent for popover positioning. */
  onMarkerTap?: (marker: OverlayMarker, event: React.MouseEvent) => void;
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
  overlays,
  overlayMode = 'none',
  onMarkerTap,
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

  // Preload the page-scoped QPC V2 font so glyphs land before lines paint —
  // avoids the FOIT/FOUT swap that makes layout look broken on first render.
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.href = `/fonts/v2/p${pageNumber}.woff2`;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
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

  // Must run on every render (no early-return before hooks) — React error #310.
  const markerMap = useMemo<Map<string, OverlayMarker>>(() => {
    const m = new Map<string, OverlayMarker>();
    if (!overlays || overlays.length === 0 || overlayMode === 'none') return m;
    for (const mk of getOverlayMarkers(pageNumber, overlays, overlayMode, quranIndex)) {
      m.set(markerKey(mk), mk);
    }
    return m;
  }, [overlays, overlayMode, pageNumber]);

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
    const charType = target.dataset.charType ?? 'word';
    if (!surah || !ayah || !position) return;

    if (onMarkerTap) {
      const key = charType === 'end'
        ? markerKeyForVerse(surah, ayah)
        : markerKeyForWord(surah, ayah, position);
      const marker = markerMap.get(key);
      if (marker) {
        onMarkerTap(marker, e);
        return;
      }
    }

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
            markerMap={markerMap}
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
  markerMap,
}: {
  line: MushafLine;
  fontFamily: string;
  compact: boolean;
  markerMap: Map<string, OverlayMarker>;
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
      {line.words.map((w) => {
        const key = w.char_type === 'end'
          ? markerKeyForVerse(w.surah, w.ayah)
          : markerKeyForWord(w.surah, w.ayah, w.position);
        return <WordSpan key={w.id} word={w} marker={markerMap.get(key)} />;
      })}
    </div>
  );
}

function WordSpan({ word, marker }: { word: MushafWord; marker?: OverlayMarker }) {
  const hasMarker = marker != null;
  const badge = hasMarker && marker!.count > 1 ? (marker!.count > 5 ? '5+' : String(marker!.count)) : null;
  return (
    <span
      className={hasMarker ? `mushaf-word ${classes.wordMarked}` : 'mushaf-word'}
      data-mushaf-word=""
      data-surah={word.surah}
      data-ayah={word.ayah}
      data-position={word.position}
      data-char-type={word.char_type}
      style={hasMarker ? ({ '--marker-color': marker!.color } as React.CSSProperties) : undefined}
    >
      {word.code_v2}
      {badge ? <sup className={classes.wordMarkerBadge}>{badge}</sup> : null}
    </span>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Box, Loader, Text } from '@mantine/core';
import type {
  ErrorLocationStatsRow,
  MushafPageData,
  MushafWord,
  QuranIndex,
} from '@tahfeedh/shared';
import { quranIndex } from '../data/quran-data';
import {
  getOverlayMarkers,
  markerKeyForVerse,
  markerKeyForWord,
  type OverlayMarker,
} from './getOverlayMarkers';
import { WordSpan } from './WordSpan';
import classes from './MushafPage.module.css';

interface PageJsonModule {
  default: MushafPageData;
}

async function loadPage(pageNumber: number): Promise<MushafPageData> {
  const mod = (await import(`../data/pages/${pageNumber}.json`)) as PageJsonModule;
  return mod.default;
}

function startPageOf(surah: number, ayah: number, idx: QuranIndex): number | null {
  const s = idx.surahs[String(surah)];
  if (!s) return null;
  const hit = s.first_ayah_page_map[String(ayah)];
  if (typeof hit === 'number') return hit;
  // Fallback: render from the surah's start page.
  return s.start_page;
}

/**
 * Renders just one verse's words inside a Mushaf-styled strip. Uses the same
 * per-page QPC V2 font and the same WordSpan tint classes as MushafPage, so
 * the verse looks identical to its slice on the full page. Verses that span
 * two pages (rare — Baqarah 282 etc.) load both page JSONs and concatenate.
 */
export function VerseStrip({
  surah,
  ayah,
  overlays,
}: {
  surah: number;
  ayah: number;
  overlays: ErrorLocationStatsRow[];
}) {
  const startPage = useMemo(() => startPageOf(surah, ayah, quranIndex), [surah, ayah]);
  // A verse rarely spans more than 2 pages; load up to 2 contiguous pages and
  // concatenate the words that belong to this ayah.
  const pageNumbers = useMemo(() => {
    if (!startPage) return [];
    return [startPage, startPage + 1].filter((p) => p >= 1 && p <= 604);
  }, [startPage]);

  const [pages, setPages] = useState<Record<number, MushafPageData>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPages({});
    setLoadError(null);
    Promise.all(pageNumbers.map((p) => loadPage(p).then((d) => [p, d] as const)))
      .then((entries) => {
        if (cancelled) return;
        setPages(Object.fromEntries(entries));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'failed to load page');
      });
    return () => {
      cancelled = true;
    };
  }, [pageNumbers.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload the start-page font.
  useEffect(() => {
    if (!startPage) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.href = `/fonts/v2/p${startPage}.woff2`;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [startPage]);

  // Build word list for the target verse, grouped by which page they came from
  // so we can apply the correct font-family per group.
  const segments = useMemo(() => {
    const out: Array<{ page: number; words: MushafWord[] }> = [];
    for (const p of pageNumbers) {
      const data = pages[p];
      if (!data) continue;
      const words: MushafWord[] = [];
      for (const line of data.lines) {
        for (const w of line.words) {
          if (w.surah === surah && w.ayah === ayah) words.push(w);
        }
      }
      if (words.length > 0) out.push({ page: p, words });
    }
    return out;
  }, [pages, pageNumbers, surah, ayah]);

  // Marker map across all loaded pages, scoped to this verse's keys only.
  const markerMap = useMemo<Map<string, OverlayMarker>>(() => {
    const m = new Map<string, OverlayMarker>();
    for (const p of pageNumbers) {
      for (const mk of getOverlayMarkers(p, overlays, 'heatmap', quranIndex)) {
        if (mk.surah !== surah || mk.ayah !== ayah) continue;
        const key =
          mk.scope === 'verse'
            ? markerKeyForVerse(mk.surah, mk.ayah)
            : markerKeyForWord(mk.surah, mk.ayah, mk.wordPosition!);
        m.set(key, mk);
      }
    }
    return m;
  }, [overlays, pageNumbers, surah, ayah]);

  if (loadError) {
    return (
      <Box p="sm">
        <Text c="brick.7" size="xs">
          Could not load verse: {loadError}
        </Text>
      </Box>
    );
  }

  if (segments.length === 0) {
    return (
      <Box p="sm" ta="center">
        <Loader size="xs" color="sage.7" />
      </Box>
    );
  }

  return (
    <Box
      style={{
        background: 'var(--mantine-color-parchment-0)',
        border: '1px solid rgba(21,53,30,0.08)',
        borderRadius: 12,
        padding: '14px 18px',
      }}
    >
      <div className="mushaf-page" data-overlay-mode="heatmap">
        {segments.map(({ page, words }) => (
          <div
            key={page}
            className={classes.line}
            style={{
              fontFamily: `'QPC V2 P${page}'`,
              justifyContent: 'center',
              flexWrap: 'wrap',
              minHeight: 0,
              padding: '2px 0',
            }}
          >
            {words.map((w) => {
              const isVerseEnd = w.char_type === 'end';
              const ownKey = isVerseEnd
                ? markerKeyForVerse(w.surah, w.ayah)
                : markerKeyForWord(w.surah, w.ayah, w.position);
              const own = markerMap.get(ownKey);
              const verseBand =
                !isVerseEnd && !own
                  ? markerMap.get(markerKeyForVerse(w.surah, w.ayah))
                  : undefined;
              return <WordSpan key={w.id} word={w} marker={own} verseBand={verseBand} />;
            })}
          </div>
        ))}
      </div>
    </Box>
  );
}

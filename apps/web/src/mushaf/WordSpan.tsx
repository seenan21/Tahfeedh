import type { MushafWord } from '@tahfeedh/shared';
import type { OverlayMarker } from './getOverlayMarkers';
import classes from './MushafPage.module.css';

/**
 * A single mushaf word glyph + (optional) overlay marker tint + count badge.
 * Used by both `MushafPage` (full page render) and `VerseStrip` (per-verse
 * preview inside the verse-detail modal). Extracted so both surfaces share
 * the same marker visuals byte-for-byte.
 */
export function WordSpan({
  word,
  marker,
  verseBand,
}: {
  word: MushafWord;
  marker?: OverlayMarker;
  verseBand?: OverlayMarker;
}) {
  const hasMarker = marker != null;
  const hasBand = !hasMarker && verseBand != null;
  const badge =
    hasMarker && marker!.count > 1 ? (marker!.count > 5 ? '5+' : String(marker!.count)) : null;
  const className = hasMarker
    ? `mushaf-word ${classes.wordMarked}`
    : hasBand
      ? `mushaf-word ${classes.wordVerseBand}`
      : 'mushaf-word';
  const style: React.CSSProperties | undefined = hasMarker
    ? ({ '--marker-color': marker!.color } as React.CSSProperties)
    : hasBand
      ? ({ '--marker-color': verseBand!.color } as React.CSSProperties)
      : undefined;
  return (
    <span
      className={className}
      data-mushaf-word=""
      data-surah={word.surah}
      data-ayah={word.ayah}
      data-position={word.position}
      data-char-type={word.char_type}
      style={style}
    >
      {word.code_v2}
      {badge ? <sup className={classes.wordMarkerBadge}>{badge}</sup> : null}
    </span>
  );
}

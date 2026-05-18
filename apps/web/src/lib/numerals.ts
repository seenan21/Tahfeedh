const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Convert a non-negative integer to Arabic-Indic numerals.
 * Used per DESIGN-SYSTEM §8: "Quranic numerals (juz, hizb, surah, ayah,
 * page numbers within Arabic strings) use Arabic-Indic." UI counts (streak
 * days, error counts) stay in Western digits.
 */
export function toArabicIndic(n: number): string {
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(Math.trunc(n)).toString();
  let out = '';
  for (const ch of digits) {
    const d = Number(ch);
    out += AR_DIGITS[d] ?? ch;
  }
  return sign + out;
}

/**
 * Turkish-aware string utilities.
 *
 * Standard JS .toLowerCase() / .toUpperCase() break Turkish casing rules:
 *   İ ↔ i   (dotted)
 *   I ↔ ı   (dotless)
 *   Ş ↔ ş, Ç ↔ ç, Ğ ↔ ğ, Ö ↔ ö, Ü ↔ ü
 */

export function trLower(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

export function trUpper(s: string): string {
  return s.toLocaleUpperCase("tr-TR");
}

/** Case-insensitive Turkish string comparison */
export function trEquals(a: string, b: string): boolean {
  return trLower(a) === trLower(b);
}

/** Case-insensitive Turkish includes */
export function trIncludes(haystack: string, needle: string): boolean {
  return trLower(haystack).includes(trLower(needle));
}

/** Case-insensitive Turkish startsWith */
export function trStartsWith(str: string, prefix: string): boolean {
  return trLower(str).startsWith(trLower(prefix));
}

/**
 * Strip Turkish diacritics so "Arpacı" → "arpaci", "Şevval" → "sevval".
 * Useful for fuzzy matching where the user may or may not type special chars.
 */
const TR_DIACRITICS: Record<string, string> = {
  ç: "c", Ç: "c",
  ğ: "g", Ğ: "g",
  ı: "i", I: "i",   // dotless ı → i, dotless uppercase I → i
  İ: "i", i: "i",   // dotted İ → i
  ö: "o", Ö: "o",
  ş: "s", Ş: "s",
  ü: "u", Ü: "u",
};

export function trStripDiacritics(s: string): string {
  return trLower(s).replace(/[çÇğĞıIİiöÖşŞüÜ]/g, (ch) => TR_DIACRITICS[ch] || ch);
}

/** Fuzzy Turkish includes — ignores diacritics and case */
export function trFuzzyIncludes(haystack: string, needle: string): boolean {
  return trStripDiacritics(haystack).includes(trStripDiacritics(needle));
}

/** Fuzzy Turkish startsWith — ignores diacritics and case */
export function trFuzzyStartsWith(str: string, prefix: string): boolean {
  return trStripDiacritics(str).startsWith(trStripDiacritics(prefix));
}

/**
 * Parse Cursor hook stdin. Cursor may prepend UTF-8 BOM or rare leading junk.
 * @param {string} raw
 * @returns {unknown | null} null if empty after strip
 */
export function parseHookStdinJson(raw) {
  let s = String(raw ?? "").replace(/^\uFEFF/, "");
  s = s.trim();
  if (!s) return null;
  const start = s.search(/[\[{]/);
  if (start > 0) s = s.slice(start);
  return JSON.parse(s);
}

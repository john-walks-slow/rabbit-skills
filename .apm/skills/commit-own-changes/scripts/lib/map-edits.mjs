/**
 * Map afterFileEdit edits[] onto line ranges in post-edit file text.
 *
 * @typedef {{ oldStart: number, oldEnd: number, newStart: number, newEnd: number, ambiguous?: boolean, skipped?: boolean, reason?: string }} MappedEdit
 */

/**
 * Normalize line endings to LF. Cursor edit payloads use LF; on-disk files
 * may be CRLF when `core.autocrlf=true` (Windows default). Comparing LF to
 * CRLF byte-for-byte always misses, so we normalize both sides before search.
 * Line counts are preserved (one logical line == one "\n" either way), so
 * computed line numbers stay valid against `git diff -U0`.
 * @param {string} s
 */
export function normalizeEol(s) {
  if (typeof s !== "string" || s === "") return s;
  // CRLF first, then lone CR (old Mac). Order matters: \r\n must collapse before
  // the lone \r pass would split it into a stray \n.
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Count lines like `wc -l` for trailing-newline files, else last partial line counts.
 * empty => 0; "a" => 1; "a\\n" => 1; "a\\nb\\n" => 2.
 * @param {string} s
 */
export function lineCount(s) {
  if (s === "") return 0;
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n += 1;
  }
  if (!s.endsWith("\n")) n += 1;
  return n;
}

/**
 * Offset (0-based) → 1-based line number.
 * @param {string} text
 * @param {number} offset
 */
export function offsetToLine(text, offset) {
  let line = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

/**
 * @param {string} text post-edit file content
 * @param {{ old_string?: string, new_string?: string }} edit
 * @returns {MappedEdit}
 */
export function mapOneEdit(text, edit) {
  const oldStr = normalizeEol(edit.old_string ?? "");
  const newStr = normalizeEol(edit.new_string ?? "");
  // Normalize the file body so LF edit payload matches CRLF on-disk text.
  // All offset/line math below runs against the normalized text, so computed
  // line numbers are identical to what `git diff -U0` would report.
  const textNorm = normalizeEol(text);
  const oldLines = lineCount(oldStr);

  if (newStr !== "") {
    const first = textNorm.indexOf(newStr);
    if (first < 0) {
      return {
        oldStart: 0,
        oldEnd: 0,
        newStart: 0,
        newEnd: 0,
        skipped: true,
        reason: "map_miss",
      };
    }
    const second = textNorm.indexOf(newStr, first + 1);
    const ambiguous = second >= 0;
    const newStart = offsetToLine(textNorm, first);
    const newEnd = offsetToLine(
      textNorm,
      first + newStr.length - (newStr.length > 0 ? 1 : 0),
    );
    // When old is empty (pure insert), old range length 0: use newStart-1 as anchor (line before insert)
    // Plan: delete keys [oldStart, oldEnd]; for pure insert old length 0.
    // We approximate oldStart/oldEnd so delta works:
    //   pure insert at newStart: oldLines=0 → oldStart=newStart, oldEnd=newStart-1 (empty)
    //   replace: old occupies same region conceptually before shift
    let oldStart;
    let oldEnd;
    if (oldLines === 0) {
      oldStart = newStart;
      oldEnd = newStart - 1; // empty range
    } else {
      // After replace, new block starts at newStart; old block was same start
      oldStart = newStart;
      oldEnd = newStart + oldLines - 1;
    }
    return { oldStart, oldEnd, newStart, newEnd, ambiguous };
  }

  // Pure delete without preText: cannot locate row in post-edit text → skip.
  // Callers with pre-edit content should use mapDeleteWithPreText / applyEditsToLedger.preText.
  if (oldStr !== "") {
    return {
      oldStart: 0,
      oldEnd: 0,
      newStart: 0,
      newEnd: 0,
      skipped: true,
      reason: "map_miss_delete",
    };
  }

  return {
    oldStart: 0,
    oldEnd: 0,
    newStart: 0,
    newEnd: 0,
    skipped: true,
    reason: "empty_edit",
  };
}

/**
 * Map delete with known preText (for tests / enhanced path).
 * @param {string} preText
 * @param {string} postText
 * @param {string} oldStr
 * @returns {MappedEdit}
 */
export function mapDeleteWithPreText(preText, postText, oldStr) {
  const oldNorm = normalizeEol(oldStr);
  const preNorm = normalizeEol(preText);
  if (!oldNorm) {
    return {
      oldStart: 0,
      oldEnd: 0,
      newStart: 0,
      newEnd: 0,
      skipped: true,
      reason: "empty_edit",
    };
  }
  const first = preNorm.indexOf(oldNorm);
  if (first < 0) {
    return {
      oldStart: 0,
      oldEnd: 0,
      newStart: 0,
      newEnd: 0,
      skipped: true,
      reason: "map_miss_delete",
    };
  }
  const ambiguous = preNorm.indexOf(oldNorm, first + 1) >= 0;
  const oldStart = offsetToLine(preNorm, first);
  const oldEnd = offsetToLine(preNorm, first + oldNorm.length - 1);
  // After delete, new empty range sits at oldStart (cursor line)
  const newStart = oldStart;
  const newEnd = oldStart - 1; // empty
  void postText;
  return { oldStart, oldEnd, newStart, newEnd, ambiguous };
}

/**
 * @param {string} text
 * @param {Array<{ old_string?: string, new_string?: string }>} edits
 * @returns {MappedEdit[]}
 */
export function mapEdits(text, edits) {
  return edits.map((e) => mapOneEdit(text, e));
}

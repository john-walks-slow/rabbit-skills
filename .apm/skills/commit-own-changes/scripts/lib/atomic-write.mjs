import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Atomic JSON write via tmp + rename (Windows: replace existing target).
 * @param {string} filePath
 * @param {unknown} data
 */
export function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = path.join(
    path.dirname(filePath),
    `.fsx-own.tmp.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}`,
  );
  const body = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(tmp, body, "utf8");
  try {
    fs.renameSync(tmp, filePath);
  } catch (err) {
    const code = /** @type {NodeJS.ErrnoException} */ (err).code;
    // Windows cannot rename over an existing file
    if (code === "EEXIST" || code === "EPERM" || code === "EACCES") {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
      fs.renameSync(tmp, filePath);
      return;
    }
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
    throw err;
  }
}

/**
 * @param {string} filePath
 * @param {unknown} fallback
 * @returns {unknown}
 */
export function readJsonSafe(filePath, fallback = null) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

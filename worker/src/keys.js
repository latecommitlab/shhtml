// Object-key rules shared by upload validation and static serving.
// Pure functions; unit tested in test/keys.test.js.

// A publishable key: one or more path segments, each starting with a letter
// or digit. Dotfiles are reserved for the worker (the .shh marker), so
// clients cannot upload them and viewers cannot fetch them.
const SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i;

export function isValidUploadKey(key) {
  if (typeof key !== "string" || key.length === 0 || key.length > 512) return false;
  if (key.includes("//") || key.startsWith("/") || key.endsWith("/")) return false;
  const segments = key.split("/");
  return segments.every((s) => SEGMENT.test(s) && s !== "." && s !== "..");
}

export function isValidPrefix(prefix) {
  return isValidUploadKey(prefix);
}

export function isHiddenKey(key) {
  return key.split("/").some((s) => s.startsWith("."));
}

// Maps a request path on the static host to the R2 keys to try, in order.
// "/finance"        -> ["finance", "finance/index.html"]
// "/finance/"       -> ["finance/index.html"]
// "/finance/a.css"  -> ["finance/a.css"]
// "/"               -> ["index.html"]
export function candidateKeys(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return [];
  }
  path = path.replace(/^\/+/, "");
  if (path === "") return ["index.html"];
  if (path.includes("\\") || path.split("/").some((s) => s === "." || s === "..")) return [];
  if (isHiddenKey(path)) return [];
  if (path.endsWith("/")) return [`${path}index.html`];
  const last = path.split("/").pop();
  if (last.includes(".")) return [path];
  return [path, `${path}/index.html`];
}

export function contentDispositionSafe(key) {
  return key.split("/").pop().replace(/[^\w.-]/g, "_");
}

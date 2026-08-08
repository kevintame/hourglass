import path from "node:path";

function missing(name: string): never {
  throw new Error(`${name} is not set — add it to the environment file (see .env.example)`);
}

// Browsers discard a `Secure` cookie that arrives over plain HTTP, so this must track the
// real scheme the app is served on, not whether the build is a production one.
export function servedOverHttps(url: string | undefined) {
  if (!url?.trim()) return false;
  try { return new URL(url.trim()).protocol === "https:"; } catch { return false; }
}

export function appUrl() {
  const value = process.env.APP_URL?.trim();
  if (!value && process.env.NODE_ENV === "production") missing("APP_URL");
  return value;
}

export function uploadDirectory() {
  const value = process.env.UPLOAD_DIR?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") missing("UPLOAD_DIR");
  return path.join(process.cwd(), "data", "uploads");
}

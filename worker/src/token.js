// Upload token: a compact HS256 JWT minted by /auth and required by every
// write endpoint. Contains only { email, iat, exp }. Forging one requires
// SIGNING_SECRET, which lives in Cloudflare's encrypted secret store.

const encoder = new TextEncoder();

export function base64url(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  return atob(padded);
}

export function base64urlToBytes(str) {
  const binary = base64urlDecode(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function mintToken(email, ttlDays, secret, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ email, iat, exp: iat + ttlDays * 86400 }));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`)));
  return `${header}.${body}.${base64url(sig)}`;
}

// Returns the payload when the token is genuine and unexpired, else null.
export async function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;

  let key;
  try {
    key = await hmacKey(secret);
  } catch {
    return null;
  }

  let valid = false;
  try {
    // crypto.subtle.verify is constant-time; never compare signatures with ===
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(sig),
      encoder.encode(`${header}.${body}`),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(body));
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(now / 1000)) return null;
  if (typeof payload.email !== "string" || !payload.email) return null;
  return payload;
}

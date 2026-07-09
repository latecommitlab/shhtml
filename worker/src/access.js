// Validation of the JWT Cloudflare Access attaches after a user passes the
// login wall (Cf-Access-Jwt-Assertion header). Access already enforced the
// policy at the edge; verifying the JWT again inside the worker is defense in
// depth, and is where we read the user's email.
//
// verifyAccessJwt is pure with respect to the key set, so tests can feed it a
// local JWKS. fetchAccessJwks does the one network call.

import { base64urlDecode, base64urlToBytes } from "./token.js";

export async function fetchAccessJwks(teamDomain) {
  const res = await fetch(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs fetch failed: ${res.status}`);
  return res.json();
}

// Returns { email } when the JWT is genuine, else null.
// Requires aud and issuer to match. Both come from the instance config.
export async function verifyAccessJwt(jwt, { jwks, aud, teamDomain, now = Date.now() }) {
  if (typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header, payload;
  try {
    header = JSON.parse(base64urlDecode(headerB64));
    payload = JSON.parse(base64urlDecode(payloadB64));
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(now / 1000)) return null;

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud || !audiences.includes(aud)) return null;

  if (payload.iss !== `https://${teamDomain}.cloudflareaccess.com`) return null;

  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  let key;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64urlToBytes(sigB64),
    data,
  );
  if (!valid) return null;

  if (typeof payload.email !== "string" || !payload.email) return null;
  return { email: payload.email };
}

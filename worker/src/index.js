// shhtml worker. One worker, two hostnames:
//
//   PUBLISH_HOST  write API. /auth sits behind Cloudflare Access (enforced at
//                 the edge before this code runs); every other route requires
//                 the HMAC upload token that /auth mints.
//   STATIC_HOST   read side. Serves the R2 bucket. Whether a viewer can reach
//                 it at all is decided by the Access application(s) you put in
//                 front of the hostname; this code only serves files.
//
// Environment (set in wrangler.toml / secrets):
//   BUCKET             R2 binding
//   SIGNING_SECRET     secret; HMAC key for upload tokens
//   ACCESS_TEAM_DOMAIN your Zero Trust team, e.g. "example" for example.cloudflareaccess.com
//   ACCESS_AUD         audience tag of the publish Access application
//   PUBLISH_HOST       e.g. publish.example.com
//   STATIC_HOST        e.g. static.example.com
//   TOKEN_TTL_DAYS     optional, default 30

import { mintToken, verifyToken } from "./token.js";
import { fetchAccessJwks, verifyAccessJwt } from "./access.js";
import { isValidUploadKey, isValidPrefix, candidateKeys } from "./keys.js";
import { authPage, notFoundPage } from "./pages.js";

const MARKER = ".shh";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.hostname === env.PUBLISH_HOST) return publishApi(request, url, env);
      if (url.hostname === env.STATIC_HOST) return serveStatic(request, url, env);
      return json({ error: "unknown host" }, 421);
    } catch (err) {
      console.error(err.stack || String(err));
      return json({ error: "internal error" }, 500);
    }
  },
};

// ---------------------------------------------------------------- publish API

async function publishApi(request, url, env) {
  const { pathname } = url;

  if (pathname === "/auth" && request.method === "GET") return handleAuth(request, url, env);
  if (pathname === "/whoami" && request.method === "GET") return handleWhoami(request, env);
  if (pathname.startsWith("/upload/") && request.method === "PUT") return handleUpload(request, url, env);
  if (pathname.startsWith("/check/") && request.method === "GET") return handleCheck(request, url, env);
  if (pathname.startsWith("/finalize/") && request.method === "POST") return handleFinalize(request, url, env);

  return json({ error: "not found" }, 404);
}

async function handleAuth(request, url, env) {
  // Access has already authenticated this request at the edge. Verify its JWT
  // anyway and take the user's email from it.
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return json({ error: "no Access JWT; is Cloudflare Access configured for /auth?" }, 401);

  const jwks = await fetchAccessJwks(env.ACCESS_TEAM_DOMAIN);
  const identity = await verifyAccessJwt(jwt, {
    jwks,
    aud: env.ACCESS_AUD,
    teamDomain: env.ACCESS_TEAM_DOMAIN,
  });
  if (!identity) return json({ error: "Access JWT rejected" }, 403);

  const ttl = clampTtl(env.TOKEN_TTL_DAYS);
  const token = await mintToken(identity.email, ttl, env.SIGNING_SECRET);

  const callback = url.searchParams.get("callback");
  if (callback) {
    let target;
    try {
      target = new URL(callback);
    } catch {
      return json({ error: "bad callback URL" }, 400);
    }
    // The callback is a loopback server started by the CLI. Refuse anything else.
    if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") {
      return json({ error: "callback must be a loopback address" }, 400);
    }
    target.searchParams.set("token", token);
    target.searchParams.set("email", identity.email);
    return Response.redirect(target.toString(), 302);
  }

  return new Response(authPage(token, identity.email), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function handleWhoami(request, env) {
  const identity = await requireUploadToken(request, env);
  if (identity instanceof Response) return identity;
  return json({ email: identity.email, exp: identity.exp });
}

async function handleUpload(request, url, env) {
  const identity = await requireUploadToken(request, env);
  if (identity instanceof Response) return identity;

  const key = decodePath(url.pathname.slice("/upload/".length));
  if (key === null || !isValidUploadKey(key)) {
    return json({ error: "invalid key; segments must start with a letter or digit" }, 400);
  }

  const contentType = request.headers.get("Content-Type") || "application/octet-stream";
  await env.BUCKET.put(key, request.body, {
    httpMetadata: { contentType },
    customMetadata: { uploadedBy: identity.email, uploadedAt: new Date().toISOString() },
  });
  return json({ ok: true, key });
}

// Collision probe. Authenticated: which paths exist is publisher information.
async function handleCheck(request, url, env) {
  const identity = await requireUploadToken(request, env);
  if (identity instanceof Response) return identity;

  const prefix = decodePath(url.pathname.slice("/check/".length));
  if (prefix === null || !isValidPrefix(prefix)) return json({ error: "invalid prefix" }, 400);

  const marker = await env.BUCKET.get(`${prefix}/${MARKER}`);
  if (!marker) return json({ exists: false }, 404);
  let meta = {};
  try {
    meta = await marker.json();
  } catch {
    // marker unreadable; report existence only
  }
  return json({ exists: true, publishedBy: meta.publishedBy, publishedAt: meta.publishedAt });
}

// Called once after a successful publish; writes the marker the CLI's
// collision check looks for. Server-side so clients can never forge dotfiles.
async function handleFinalize(request, url, env) {
  const identity = await requireUploadToken(request, env);
  if (identity instanceof Response) return identity;

  const prefix = decodePath(url.pathname.slice("/finalize/".length));
  if (prefix === null || !isValidPrefix(prefix)) return json({ error: "invalid prefix" }, 400);

  const body = JSON.stringify({ publishedBy: identity.email, publishedAt: new Date().toISOString() });
  await env.BUCKET.put(`${prefix}/${MARKER}`, body, {
    httpMetadata: { contentType: "application/json" },
  });
  return json({ ok: true });
}

async function requireUploadToken(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "missing bearer token" }, 401);
  const payload = await verifyToken(auth.slice(7), env.SIGNING_SECRET);
  if (!payload) return json({ error: "invalid or expired token" }, 403);
  return payload;
}

// ---------------------------------------------------------------- static host

async function serveStatic(request, url, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method not allowed" }, 405);
  }

  for (const key of candidateKeys(url.pathname)) {
    const object = await env.BUCKET.get(key);
    if (!object) continue;

    const contentType = object.httpMetadata?.contentType || "application/octet-stream";
    const headers = new Headers({
      "Content-Type": contentType,
      "ETag": object.httpEtag,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      // HTML revalidates on every view so republished pages show up
      // immediately; assets cache for an hour.
      "Cache-Control": contentType.startsWith("text/html") ? "no-cache" : "public, max-age=3600",
    });

    if (request.method === "HEAD") return new Response(null, { headers });
    return new Response(object.body, { headers });
  }

  return new Response(notFoundPage(), {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}

// ---------------------------------------------------------------- helpers

function decodePath(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function clampTtl(value) {
  const n = parseInt(value || "30", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 90);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// verifyAccessJwt is tested against a locally generated RSA key pair acting
// as the Cloudflare Access JWKS, so no network is involved.

import test from "node:test";
import assert from "node:assert/strict";
import { verifyAccessJwt } from "../src/access.js";
import { base64url } from "../src/token.js";

const TEAM = "example";
const AUD = "aud-tag-1234";

let jwks, privateKey;

async function setup() {
  if (jwks) return;
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  privateKey = pair.privateKey;
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  jwks = { keys: [{ ...jwk, kid: "test-kid", alg: "RS256", use: "sig" }] };
}

async function signJwt(payload, kid = "test-kid") {
  const h = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
  const b = base64url(JSON.stringify(payload));
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${h}.${b}`)),
  );
  return `${h}.${b}.${base64url(sig)}`;
}

function goodPayload(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    email: "user@example.com",
    aud: [AUD],
    iss: `https://${TEAM}.cloudflareaccess.com`,
    iat: now,
    exp: now + 300,
    ...overrides,
  };
}

const opts = () => ({ jwks, aud: AUD, teamDomain: TEAM });

test("valid Access JWT passes and yields the email", async () => {
  await setup();
  const jwt = await signJwt(goodPayload());
  assert.deepEqual(await verifyAccessJwt(jwt, opts()), { email: "user@example.com" });
});

test("wrong audience is rejected", async () => {
  await setup();
  const jwt = await signJwt(goodPayload({ aud: ["someone-else"] }));
  assert.equal(await verifyAccessJwt(jwt, opts()), null);
});

test("missing audience config is rejected even if JWT is genuine", async () => {
  await setup();
  const jwt = await signJwt(goodPayload());
  assert.equal(await verifyAccessJwt(jwt, { ...opts(), aud: "" }), null);
});

test("wrong issuer is rejected", async () => {
  await setup();
  const jwt = await signJwt(goodPayload({ iss: "https://evil.cloudflareaccess.com" }));
  assert.equal(await verifyAccessJwt(jwt, opts()), null);
});

test("expired JWT is rejected", async () => {
  await setup();
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(goodPayload({ exp: now - 10 }));
  assert.equal(await verifyAccessJwt(jwt, opts()), null);
});

test("unknown kid is rejected", async () => {
  await setup();
  const jwt = await signJwt(goodPayload(), "other-kid");
  assert.equal(await verifyAccessJwt(jwt, opts()), null);
});

test("tampered payload is rejected", async () => {
  await setup();
  const jwt = await signJwt(goodPayload());
  const [h, , s] = jwt.split(".");
  const forged = base64url(JSON.stringify(goodPayload({ email: "evil@example.com" })));
  assert.equal(await verifyAccessJwt(`${h}.${forged}.${s}`, opts()), null);
});

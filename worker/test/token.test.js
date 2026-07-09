import test from "node:test";
import assert from "node:assert/strict";
import { mintToken, verifyToken, base64url } from "../src/token.js";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";

test("round trip: minted token verifies and carries the email", async () => {
  const token = await mintToken("a@example.com", 30, SECRET);
  const payload = await verifyToken(token, SECRET);
  assert.ok(payload);
  assert.equal(payload.email, "a@example.com");
  assert.ok(payload.exp > payload.iat);
});

test("wrong secret is rejected", async () => {
  const token = await mintToken("a@example.com", 30, SECRET);
  assert.equal(await verifyToken(token, "some-other-secret"), null);
});

test("tampered payload is rejected", async () => {
  const token = await mintToken("a@example.com", 30, SECRET);
  const [h, , s] = token.split(".");
  const forged = base64url(JSON.stringify({ email: "evil@example.com", iat: 0, exp: 9999999999 }));
  assert.equal(await verifyToken(`${h}.${forged}.${s}`, SECRET), null);
});

test("expired token is rejected", async () => {
  const past = Date.now() - 40 * 86400 * 1000;
  const token = await mintToken("a@example.com", 30, SECRET, past);
  assert.equal(await verifyToken(token, SECRET), null);
});

test("token still valid just before expiry, using the now parameter", async () => {
  const start = Date.now();
  const token = await mintToken("a@example.com", 30, SECRET, start);
  const justBefore = start + 30 * 86400 * 1000 - 60 * 1000;
  assert.ok(await verifyToken(token, SECRET, justBefore));
});

test("garbage inputs are rejected, not thrown", async () => {
  for (const bad of ["", "a.b", "a.b.c.d", null, undefined, 42, "..", "x.y.z"]) {
    assert.equal(await verifyToken(bad, SECRET), null);
  }
});

test("token without an email is rejected", async () => {
  const iat = Math.floor(Date.now() / 1000);
  const h = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const b = base64url(JSON.stringify({ iat, exp: iat + 3600 }));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${h}.${b}`))));
  assert.equal(await verifyToken(`${h}.${b}.${sig}`, SECRET), null);
});

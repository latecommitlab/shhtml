import test from "node:test";
import assert from "node:assert/strict";
import { isValidUploadKey, isHiddenKey, candidateKeys } from "../src/keys.js";

test("valid upload keys", () => {
  for (const k of [
    "finance/index.html",
    "finance/assets/app.js",
    "a",
    "q4-report/data.json",
    "team/dashboards/metrics.html",
    "IMG_2024.png",
  ]) {
    assert.ok(isValidUploadKey(k), k);
  }
});

test("invalid upload keys", () => {
  for (const k of [
    "../etc/passwd",
    "finance/../secrets",
    "finance/.shh",
    ".shh",
    "/finance/index.html",
    "finance//index.html",
    "finance/",
    "",
    "-leading-dash",
    "_leading_underscore",
    "a".repeat(600),
    "finance/.hidden/file.html",
  ]) {
    assert.equal(isValidUploadKey(k), false, k);
  }
});

test("hidden keys are detected anywhere in the path", () => {
  assert.ok(isHiddenKey(".shh"));
  assert.ok(isHiddenKey("finance/.shh"));
  assert.ok(isHiddenKey("a/.b/c.html"));
  assert.equal(isHiddenKey("finance/index.html"), false);
});

test("candidateKeys maps request paths to lookups", () => {
  assert.deepEqual(candidateKeys("/finance"), ["finance", "finance/index.html"]);
  assert.deepEqual(candidateKeys("/finance/"), ["finance/index.html"]);
  assert.deepEqual(candidateKeys("/finance/app.css"), ["finance/app.css"]);
  assert.deepEqual(candidateKeys("/"), ["index.html"]);
  assert.deepEqual(candidateKeys("/a/b/c"), ["a/b/c", "a/b/c/index.html"]);
});

test("candidateKeys refuses traversal, hidden files, and bad encodings", () => {
  assert.deepEqual(candidateKeys("/../secret"), []);
  assert.deepEqual(candidateKeys("/finance/../x"), []);
  assert.deepEqual(candidateKeys("/%2e%2e/secret"), []);
  assert.deepEqual(candidateKeys("/finance/.shh"), []);
  assert.deepEqual(candidateKeys("/%ff"), []);
  assert.deepEqual(candidateKeys("/a\\b"), []);
});

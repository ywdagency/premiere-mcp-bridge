const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

test("builds the Premiere runtime as a self-contained IIFE", () => {
  const bundle = readFileSync(resolve(__dirname, "../dist/main.js"), "utf8");
  assert.match(bundle, /^"use strict";\s*\(\(\) => \{/);
  assert.doesNotMatch(bundle, /Object\.defineProperty\(exports|\bexports\./);
  assert.match(bundle, /require\("premierepro"\)/);
  assert.match(bundle, /require\("uxp"\)/);
});

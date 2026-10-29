const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const actionSource = fs.readFileSync(path.join(root, "convex", "ai.ts"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "src", "main.jsx"), "utf8");

test("OpenRouter key is read only by the Convex server action", () => {
  assert.match(actionSource, /process\.env\.OPENROUTER_API_KEY/);
  assert.match(actionSource, /Authorization:\s*\`Bearer \\$\{apiKey\}\`/);
  assert.doesNotMatch(uiSource, /OPENROUTER_API_KEY|sk-or-v1-/);
});

test("AI action requires authentication and bounds prompt and output", () => {
  assert.match(actionSource, /ctx\.auth\.getUserIdentity\(\)/);
  assert.match(actionSource, /if \(!identity\)/);
  assert.match(actionSource, /MAX_PROMPT_LENGTH\s*=\s*1800/);
  assert.match(actionSource, /MAX_OUTPUT_TOKENS\s*=\s*450/);
});

test("AI action uses OpenRouter free router by default and handles rate limits", () => {
  assert.match(actionSource, /"openrouter\/free"/);
  assert.match(actionSource, /api\.openrouter\.ai\/api\/v1\/chat\/completions/);
  assert.match(actionSource, /response\.status === 429/);
});

test("AI UI requires sign-in and keeps input length bounded", () => {
  assert.match(uiSource, /useAction\(api\.ai\.ask\)/);
  assert.match(uiSource, /disabled=\{!isAuthenticated \|\| busy\}/);
  assert.match(uiSource, /maxLength=\{1800\}/);
});

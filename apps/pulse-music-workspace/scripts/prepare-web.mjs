import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "www");
const excluded = new Set([
  ".git",
  "android",
  "android-native",
  "node_modules",
  "scripts",
  "tests",
  "www",
  "package.json",
  "package-lock.json",
  "capacitor.config.json",
  "README.md",
  "CLOUD_SETUP.md",
  "ANDROID_RELEASE.md",
]);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  await cp(path.join(root, entry.name), path.join(output, entry.name), {
    recursive: true,
    force: true,
  });
}

console.log("Prepared Pulse web assets in www/");

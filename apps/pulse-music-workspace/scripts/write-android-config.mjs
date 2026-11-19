import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "www", "config.js");
const convexUrl = process.env.PULSE_CONVEX_URL?.trim() || "";
const clerkPublishableKey =
  process.env.PULSE_CLERK_PUBLISHABLE_KEY?.trim() || "";

if (Boolean(convexUrl) !== Boolean(clerkPublishableKey)) {
  throw new Error(
    "Provide both public Pulse cloud settings or leave both unset for local-only mode.",
  );
}
if (convexUrl && !/^https:\/\/[a-z0-9-]+\.convex\.cloud\/?$/i.test(convexUrl)) {
  throw new Error("PULSE_CONVEX_URL must be a public HTTPS .convex.cloud URL.");
}
if (
  clerkPublishableKey &&
  !/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(clerkPublishableKey)
) {
  throw new Error(
    "PULSE_CLERK_PUBLISHABLE_KEY must be a Clerk publishable key, never a secret key.",
  );
}
const config = {
  convexUrl: convexUrl.replace(/\/$/, ""),
  clerkPublishableKey,
};
await writeFile(
  output,
  "// Generated from public client configuration; no secrets belong here.\n" +
    "window.PULSE_CONFIG = Object.freeze(" +
    JSON.stringify(config, null, 2) +
    ");\n",
  "utf8",
);
console.log(
  convexUrl
    ? "Validated public Pulse cloud configuration."
    : "Prepared local-only Android configuration.",
);

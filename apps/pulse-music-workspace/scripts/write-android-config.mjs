import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "www", "config.js");
const convexUrl = process.env.PULSE_CONVEX_URL?.trim() || "";
const clerkPublishableKey =
  process.env.PULSE_CLERK_PUBLISHABLE_KEY?.trim() || "";

if (!/^https:\/\/[a-z0-9-]+\.convex\.cloud\/?$/i.test(convexUrl)) {
  throw new Error(
    "PULSE_CONVEX_URL must be the exact public HTTPS Convex deployment URL ending in .convex.cloud",
  );
}

if (!/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(clerkPublishableKey)) {
  throw new Error(
    "PULSE_CLERK_PUBLISHABLE_KEY must be a Clerk publishable key beginning with pk_test_ or pk_live_. Never provide a Clerk secret key.",
  );
}

const config = {
  convexUrl: convexUrl.replace(/\/$/, ""),
  clerkPublishableKey,
};

await writeFile(
  output,
  "// Generated for the Android build from public client configuration.\n" +
    "window.PULSE_CONFIG = Object.freeze(" +
    JSON.stringify(config, null, 2) +
    ");\n",
  "utf8",
);

console.log("Validated and generated Android public cloud configuration.");

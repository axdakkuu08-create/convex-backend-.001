import type { AuthConfig } from "convex/server";

/**
 * Clerk issuer configuration for Pulse.
 *
 * Set CLERK_JWT_ISSUER_DOMAIN in the Convex development deployment's
 * environment settings to the exact Clerk Frontend API URL, then run
 * `npx convex dev` from apps/pulse-backend to sync this configuration.
 * Use a separate issuer value for production. Never commit secrets or tokens.
 */
const domain = process.env.CLERK_JWT_ISSUER_DOMAIN?.trim();

if (!domain) {
  throw new Error(
    "Pulse authentication is not configured. Set CLERK_JWT_ISSUER_DOMAIN " +
      "to the exact Clerk Frontend API URL in the Convex deployment settings.",
  );
}

export default {
  providers: [{ domain, applicationID: "convex" }],
} satisfies AuthConfig;

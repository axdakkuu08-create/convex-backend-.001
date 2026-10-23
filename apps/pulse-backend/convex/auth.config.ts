import type { AuthConfig } from "convex/server";

/**
 * Pulse authentication must be configured before running `npx convex dev`
 * or deploying this backend.
 *
 * Set PULSE_AUTH_DOMAIN to the exact OIDC issuer/domain and
 * PULSE_AUTH_APPLICATION_ID to the audience/application ID expected in the JWT.
 * Follow the chosen provider's official Convex instructions; do not guess.
 * Never commit secrets, private keys, or access tokens.
 */
const domain = process.env.PULSE_AUTH_DOMAIN?.trim();
const applicationID = process.env.PULSE_AUTH_APPLICATION_ID?.trim();

if (!domain || !applicationID) {
  throw new Error(
    "Pulse authentication is not configured. Set both PULSE_AUTH_DOMAIN and " +
      "PULSE_AUTH_APPLICATION_ID to the values from your OIDC provider before " +
      "running Convex dev or deploying.",
  );
}

export default {
  providers: [{ domain, applicationID }],
} satisfies AuthConfig;

import type { AuthConfig } from "convex/server";

/**
 * Configure these values in the Convex deployment environment before deploying:
 * - PULSE_AUTH_DOMAIN: exact issuer/domain from your OIDC provider
 * - PULSE_AUTH_APPLICATION_ID: audience/application ID expected in its JWT
 *
 * Keep these values aligned with the identity provider and frontend auth SDK.
 * Never put client secrets or private keys in this file.
 */
const domain = process.env.PULSE_AUTH_DOMAIN;
const applicationID = process.env.PULSE_AUTH_APPLICATION_ID;

export default {
  providers: [
    {
      domain: domain!,
      applicationID: applicationID!,
    },
  ],
} satisfies AuthConfig;

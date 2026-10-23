import type { AuthConfig } from "convex/server";

/**
 * Configure these values in the Convex deployment environment before enabling
 * authentication:
 * - PULSE_AUTH_DOMAIN: exact issuer/domain from your OIDC provider
 * - PULSE_AUTH_APPLICATION_ID: audience/application ID expected in its JWT
 *
 * During local/CI code generation, an empty provider list lets the project
 * validate without inventing identity-provider values. This does NOT enable
 * authentication. Configure both values before deploying or accepting users.
 * Never put client secrets or private keys in this file.
 */
const domain = process.env.PULSE_AUTH_DOMAIN?.trim();
const applicationID = process.env.PULSE_AUTH_APPLICATION_ID?.trim();

const providers =
  domain && applicationID
    ? [{ domain, applicationID }]
    : [];

export default {
  providers,
} satisfies AuthConfig;

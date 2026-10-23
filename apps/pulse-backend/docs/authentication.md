# Pulse authentication setup

Pulse's backend uses Convex's verified identity for every private library operation. The repository now contains an OIDC provider configuration template; it is **not active on a deployment until valid provider values are configured and the configuration is synced**.

## Required provider values

Configure these as environment variables on the **Convex development deployment** before running `npx convex dev`:

- `PULSE_AUTH_DOMAIN`: the exact issuer/domain provided by your OIDC identity provider.
- `PULSE_AUTH_APPLICATION_ID`: the exact audience/application ID expected in the access/identity token.

The domain and application ID must match the JWT claims and provider setup. Do not guess these values. Use the provider's official Convex integration instructions. A provider may require a specific audience such as `convex`; another provider may require its client ID.

After development is verified, configure separate values on the production deployment before any production deployment. Never put client secrets, admin keys, private signing keys, or access tokens in GitHub files or frontend code.

## Before frontend integration

1. Choose and create an OIDC-compatible identity-provider application.
2. Set the two values above in the Convex development deployment settings.
3. Run `npx convex dev` from `apps/pulse-backend/` in a trusted Node.js environment to sync the auth configuration.
4. Confirm the Convex dashboard lists the expected issuer and application ID.
5. Test signed-out requests, signed-in requests, and cross-user access attempts.
6. Only then plan frontend login wiring. The current Pulse frontend remains unchanged and does not yet provide a login flow.

## Identity and ownership

Backend functions use Convex's verified `tokenIdentifier`, not an owner ID sent by the browser. This is globally unique across identity providers. All private functions must continue to authenticate and verify ownership before reading or changing records.

## Important

This template does not create an identity-provider account, configure a deployment, or make sign-in work by itself. Do not deploy until both values are configured and verified. No live deployment is performed as part of this change.

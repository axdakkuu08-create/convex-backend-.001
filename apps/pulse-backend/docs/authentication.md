# Pulse authentication setup

Pulse's backend uses Convex's verified identity for every private library
operation. The repository now contains an OIDC provider configuration template;
it is **not active on a deployment until valid provider values are configured
and the configuration is synced**.

## Required provider values

Configure `CLERK_JWT_ISSUER_DOMAIN` in the **Convex development deployment**
using the exact Clerk Frontend API URL. The application ID is fixed to `convex`.
Activate the Convex integration in Clerk so the session token's issuer and
`aud` claim match the backend configuration.

The Clerk issuer domain and application ID must match the JWT claims. Use
Clerk's official Convex integration instructions; this integration uses the
application ID `convex`.

After development is verified, configure separate values on the production
deployment before any production deployment. Never put client secrets, admin
keys, private signing keys, or access tokens in GitHub files or frontend code.

## Before frontend integration

1. Create a Clerk application and activate the Convex integration.
2. Set `CLERK_JWT_ISSUER_DOMAIN` in the Convex development deployment settings.
3. Run `npx convex dev` from `apps/pulse-backend/` in a trusted Node.js
   environment to sync the auth configuration.
4. Confirm the Convex dashboard lists the expected issuer and application ID.
5. Test signed-out requests, signed-in requests, and cross-user access attempts.
6. Only then plan frontend login wiring. The current Pulse frontend remains
   unchanged and does not yet provide a login flow.

## Identity and ownership

Backend functions use Convex's verified `tokenIdentifier`, not an owner ID sent
by the browser. This is globally unique across identity providers. All private
functions must continue to authenticate and verify ownership before reading or
changing records.

## Important

This template does not create an identity-provider account, configure a
deployment, or make sign-in work by itself. Do not deploy until both values are
configured and verified. No live deployment is performed as part of this change.

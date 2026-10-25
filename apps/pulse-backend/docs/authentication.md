# Pulse authentication setup

Pulse uses Convex's verified identity for every private library operation. This
repository uses Clerk as the OpenID Connect identity provider for the static
Pulse frontend. The configuration is **not active on a deployment until the
Clerk issuer is configured and the backend auth configuration is synced**.

## Development setup

1. Create a Clerk application in the
   [Clerk Dashboard](https://dashboard.clerk.com/).
2. Activate Clerk's Convex integration and copy the exact Clerk Frontend API URL
   (the issuer domain) and the browser-safe publishable key.
3. In the Convex **development deployment** environment settings, set
   `CLERK_JWT_ISSUER_DOMAIN` to that exact Frontend API URL.
4. The backend's `convex/auth.config.ts` uses application ID `convex`. The
   Clerk integration must issue a compatible token with the matching issuer and
   audience.
5. From `apps/pulse-backend/` in a trusted Node.js environment, run
   `npm install`, authenticate with `npx convex login` if needed, then run
   `npx convex dev` to sync the auth configuration.
6. Confirm the Convex dashboard's Authentication settings list the expected
   Clerk issuer and application ID `convex`.

See the [frontend cloud setup guide](../../pulse-music-workspace/CLOUD_SETUP.md)
for how to fill the public values in `apps/pulse-music-workspace/config.js`.

## Production

Do not reuse development credentials or deploy until the development flow has
been verified. Configure the production deployment with the intended Clerk
production issuer, then run the appropriate production deployment command. Never
put Clerk secret keys, Convex deploy keys, admin keys, private signing keys, or
access tokens in frontend files or GitHub.

## Identity and ownership

Backend functions use Convex's verified `tokenIdentifier`, not an owner ID sent
by the browser. Every private query and mutation must authenticate and verify
ownership before reading or changing records. Test signed-out requests and
cross-account access before relying on cloud data.

## Important

This setup does not create a Clerk account, provision a Convex deployment, or
make sign-in work by itself. GitHub CI checks are not proof of a live deployment
or real login.

import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Return Convex's verified, globally unique identity key.
 * Never accept owner IDs from client arguments.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Sign in is required to access your Pulse library.");
  }
  return identity.tokenIdentifier;
}

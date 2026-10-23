import type { QueryCtx, MutationCtx } from "../_generated/server";

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Sign in is required to access your Pulse library.");
  }
  return identity.subject;
}

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { musicSource } from "./schema";

async function requireOwner(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in is required.");
  return identity.subject;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwner(ctx);
    return await ctx.db
      .query("savedTracks")
      .withIndex("by_owner_saved", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();
  },
});

export const save = mutation({
  args: {
    title: v.string(),
    artist: v.optional(v.string()),
    source: musicSource,
    sourceUrl: v.string(),
    artworkUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const title = args.title.trim();
    if (!title || title.length > 200) throw new Error("Track title must be 1–200 characters.");
    if (!/^https?:\/\//i.test(args.sourceUrl)) throw new Error("Track URL must use http or https.");
    const duplicate = await ctx.db
      .query("savedTracks")
      .withIndex("by_owner_source_url", (q) =>
        q.eq("ownerId", ownerId).eq("sourceUrl", args.sourceUrl),
      )
      .first();
    if (duplicate) return duplicate._id;
    return await ctx.db.insert("savedTracks", {
      ...args,
      title,
      ownerId,
      savedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { trackId: v.id("savedTracks") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const track = await ctx.db.get(args.trackId);
    if (!track || track.ownerId !== ownerId) throw new Error("Track not found.");
    await ctx.db.delete(args.trackId);
  },
});

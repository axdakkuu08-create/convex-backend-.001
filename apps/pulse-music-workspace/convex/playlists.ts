import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
      .query("playlists")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const name = args.name.trim();
    if (!name || name.length > 80) throw new Error("Playlist name must be 1–80 characters.");
    const now = Date.now();
    return await ctx.db.insert("playlists", {
      ownerId,
      name,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { playlistId: v.id("playlists"), name: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.ownerId !== ownerId) throw new Error("Playlist not found.");
    const name = args.name.trim();
    if (!name || name.length > 80) throw new Error("Playlist name must be 1–80 characters.");
    await ctx.db.patch(args.playlistId, { name, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { playlistId: v.id("playlists") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.ownerId !== ownerId) throw new Error("Playlist not found.");
    const tracks = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_added", (q) => q.eq("playlistId", args.playlistId))
      .collect();
    for (const track of tracks) await ctx.db.delete(track._id);
    await ctx.db.delete(args.playlistId);
  },
});

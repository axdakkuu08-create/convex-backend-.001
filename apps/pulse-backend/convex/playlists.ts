import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

const MAX_PLAYLIST_NAME = 80;

function cleanName(name: string): string {
  const cleaned = name.trim();
  if (!cleaned || cleaned.length > MAX_PLAYLIST_NAME) {
    throw new Error("Playlist names must contain 1–80 characters.");
  }
  return cleaned;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireUser(ctx);
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
    const ownerId = await requireUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("playlists", {
      ownerId,
      name: cleanName(args.name),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { playlistId: v.id("playlists"), name: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.ownerId !== ownerId) {
      throw new Error("Playlist not found.");
    }
    await ctx.db.patch(args.playlistId, {
      name: cleanName(args.name),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { playlistId: v.id("playlists") },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.ownerId !== ownerId) {
      throw new Error("Playlist not found.");
    }
    const tracks = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_added", (q) =>
        q.eq("playlistId", args.playlistId),
      )
      .collect();
    for (const track of tracks) {
      if (track.ownerId === ownerId) {
        await ctx.db.delete(track._id);
      }
    }
    await ctx.db.delete(args.playlistId);
  },
});

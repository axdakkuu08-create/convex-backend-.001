import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { musicSource } from "./schema";

async function requireOwner(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in is required.");
  return identity.subject;
}

export const list = query({
  args: { playlistId: v.id("playlists") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.ownerId !== ownerId) throw new Error("Playlist not found.");
    return await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_added", (q) => q.eq("playlistId", args.playlistId))
      .order("asc")
      .collect();
  },
});

export const add = mutation({
  args: {
    playlistId: v.id("playlists"),
    title: v.string(),
    artist: v.optional(v.string()),
    source: musicSource,
    sourceUrl: v.string(),
    artworkUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.ownerId !== ownerId) throw new Error("Playlist not found.");
    const title = args.title.trim();
    if (!title || title.length > 200) throw new Error("Track title must be 1–200 characters.");
    if (!/^https?:\/\//i.test(args.sourceUrl)) throw new Error("Track URL must use http or https.");
    const duplicate = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_source_url", (q) =>
        q.eq("playlistId", args.playlistId).eq("sourceUrl", args.sourceUrl),
      )
      .first();
    if (duplicate) return duplicate._id;
    return await ctx.db.insert("playlistTracks", {
      ...args,
      title,
      ownerId,
      addedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { trackId: v.id("playlistTracks") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const track = await ctx.db.get(args.trackId);
    if (!track || track.ownerId !== ownerId) throw new Error("Track not found.");
    await ctx.db.delete(args.trackId);
  },
});

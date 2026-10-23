import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { musicSource } from "./schema";
import { requireUser } from "./lib/auth";

const trackArgs = {
  title: v.string(),
  artist: v.optional(v.string()),
  source: musicSource,
  sourceUrl: v.string(),
  artworkUrl: v.optional(v.string()),
};

function validateTrack(title: string, sourceUrl: string) {
  if (!title.trim() || title.trim().length > 200) {
    throw new Error("Track titles must contain 1–200 characters.");
  }
  if (sourceUrl.length > 2048) {
    throw new Error("The music URL is too long.");
  }
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("Enter a valid music URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS music links are supported.");
  }
}

export const listSaved = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireUser(ctx);
    return await ctx.db
      .query("savedTracks")
      .withIndex("by_owner_saved", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();
  },
});

export const saveTrack = mutation({
  args: trackArgs,
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    validateTrack(args.title, args.sourceUrl);
    const existing = await ctx.db
      .query("savedTracks")
      .withIndex("by_owner_saved", (q) => q.eq("ownerId", ownerId))
      .collect();
    if (existing.some((track) => track.sourceUrl === args.sourceUrl)) {
      return existing.find((track) => track.sourceUrl === args.sourceUrl)!._id;
    }
    return await ctx.db.insert("savedTracks", {
      ...args,
      title: args.title.trim(),
      ownerId,
      savedAt: Date.now(),
    });
  },
});

export const unsaveTrack = mutation({
  args: { trackId: v.id("savedTracks") },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const track = await ctx.db.get(args.trackId);
    if (!track || track.ownerId !== ownerId) {
      throw new Error("Saved track not found.");
    }
    await ctx.db.delete(args.trackId);
  },
});

export const listPlaylistTracks = query({
  args: { playlistId: v.id("playlists") },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.ownerId !== ownerId) {
      throw new Error("Playlist not found.");
    }
    return await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_added", (q) =>
        q.eq("playlistId", args.playlistId),
      )
      .order("desc")
      .collect();
  },
});

export const addToPlaylist = mutation({
  args: { playlistId: v.id("playlists"), ...trackArgs },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.ownerId !== ownerId) {
      throw new Error("Playlist not found.");
    }
    validateTrack(args.title, args.sourceUrl);
    const existing = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_added", (q) =>
        q.eq("playlistId", args.playlistId),
      )
      .collect();
    if (existing.some((track) => track.sourceUrl === args.sourceUrl)) {
      return existing.find((track) => track.sourceUrl === args.sourceUrl)!._id;
    }
    const trackId = await ctx.db.insert("playlistTracks", {
      ...args,
      title: args.title.trim(),
      ownerId,
      addedAt: Date.now(),
    });
    await ctx.db.patch(args.playlistId, { updatedAt: Date.now() });
    return trackId;
  },
});

export const removeFromPlaylist = mutation({
  args: { trackId: v.id("playlistTracks") },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const track = await ctx.db.get(args.trackId);
    if (!track || track.ownerId !== ownerId) {
      throw new Error("Playlist track not found.");
    }
    await ctx.db.delete(args.trackId);
  },
});

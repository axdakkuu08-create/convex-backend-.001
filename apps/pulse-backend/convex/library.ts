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

const SOURCE_HOSTS: Record<"spotify" | "youtube" | "soundcloud", string[]> = {
  spotify: ["spotify.com", "spotify.link"],
  youtube: ["youtube.com", "youtu.be"],
  soundcloud: ["soundcloud.com"],
};

function validateHttpUrl(value: string, label: string): URL {
  if (!value.trim() || value.length > 2048) {
    throw new Error(`${label} must be a valid URL up to 2048 characters.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error(
      `${label} must use HTTP(S) and cannot contain embedded credentials.`,
    );
  }
  return url;
}

function validateTrack(
  title: string,
  artist: string | undefined,
  source: "spotify" | "youtube" | "soundcloud" | "direct",
  sourceUrl: string,
  artworkUrl: string | undefined,
): void {
  if (!title.trim() || title.trim().length > 200) {
    throw new Error("Track titles must contain 1–200 characters.");
  }
  if (artist !== undefined && artist.trim().length > 200) {
    throw new Error("Artist names must contain at most 200 characters.");
  }

  const url = validateHttpUrl(sourceUrl, "Music URL");
  if (source !== "direct") {
    const allowedHosts = SOURCE_HOSTS[source];
    const hostMatches = allowedHosts.some(
      (host) =>
        url.hostname.toLowerCase() === host ||
        url.hostname.toLowerCase().endsWith(`.${host}`),
    );
    if (!hostMatches) {
      throw new Error(
        "The music URL host does not match the selected provider.",
      );
    }
  }

  if (artworkUrl !== undefined) {
    validateHttpUrl(artworkUrl, "Artwork URL");
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
    validateTrack(
      args.title,
      args.artist,
      args.source,
      args.sourceUrl,
      args.artworkUrl,
    );

    const duplicate = await ctx.db
      .query("savedTracks")
      .withIndex("by_owner_source_url", (q) =>
        q.eq("ownerId", ownerId).eq("sourceUrl", args.sourceUrl),
      )
      .first();
    if (duplicate) return duplicate._id;

    return await ctx.db.insert("savedTracks", {
      ...args,
      title: args.title.trim(),
      artist: args.artist?.trim(),
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
    if (!track || track.ownerId !== ownerId)
      throw new Error("Saved track not found.");
    await ctx.db.delete(args.trackId);
  },
});

export const listPlaylistTracks = query({
  args: { playlistId: v.id("playlists") },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist || playlist.ownerId !== ownerId)
      throw new Error("Playlist not found.");
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
    if (!playlist || playlist.ownerId !== ownerId)
      throw new Error("Playlist not found.");
    validateTrack(
      args.title,
      args.artist,
      args.source,
      args.sourceUrl,
      args.artworkUrl,
    );

    const duplicate = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_source_url", (q) =>
        q.eq("playlistId", args.playlistId).eq("sourceUrl", args.sourceUrl),
      )
      .first();
    if (duplicate) return duplicate._id;

    const trackId = await ctx.db.insert("playlistTracks", {
      ...args,
      title: args.title.trim(),
      artist: args.artist?.trim(),
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
    if (!track || track.ownerId !== ownerId)
      throw new Error("Playlist track not found.");
    await ctx.db.delete(args.trackId);
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireUser(ctx);
    return await ctx.db
      .query("recentlyPlayed")
      .withIndex("by_owner_played", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(50);
  },
});

export const recordPlayed = mutation({
  args: trackArgs,
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    validateTrack(
      args.title,
      args.artist,
      args.source,
      args.sourceUrl,
      args.artworkUrl,
    );
    const duplicate = await ctx.db
      .query("recentlyPlayed")
      .withIndex("by_owner_source_url", (q) =>
        q.eq("ownerId", ownerId).eq("sourceUrl", args.sourceUrl),
      )
      .first();
    if (duplicate) await ctx.db.delete(duplicate._id);
    const id = await ctx.db.insert("recentlyPlayed", {
      ...args,
      title: args.title.trim(),
      artist: args.artist?.trim(),
      ownerId,
      playedAt: Date.now(),
    });
    const all = await ctx.db
      .query("recentlyPlayed")
      .withIndex("by_owner_played", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();
    for (const old of all.slice(50)) await ctx.db.delete(old._id);
    return id;
  },
});

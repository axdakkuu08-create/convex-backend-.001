import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const musicSource = v.union(
  v.literal("spotify"),
  v.literal("youtube"),
  v.literal("soundcloud"),
  v.literal("direct"),
);

export default defineSchema({
  playlists: defineTable({
    ownerId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner_updated", ["ownerId", "updatedAt"]),
  playlistTracks: defineTable({
    ownerId: v.string(),
    playlistId: v.id("playlists"),
    title: v.string(),
    artist: v.optional(v.string()),
    source: musicSource,
    sourceUrl: v.string(),
    artworkUrl: v.optional(v.string()),
    addedAt: v.number(),
  })
    .index("by_playlist_added", ["playlistId", "addedAt"])
    .index("by_owner_added", ["ownerId", "addedAt"])
    .index("by_playlist_source_url", ["playlistId", "sourceUrl"]),
  savedTracks: defineTable({
    ownerId: v.string(),
    title: v.string(),
    artist: v.optional(v.string()),
    source: musicSource,
    sourceUrl: v.string(),
    artworkUrl: v.optional(v.string()),
    savedAt: v.number(),
  })
    .index("by_owner_saved", ["ownerId", "savedAt"])
    .index("by_owner_source_url", ["ownerId", "sourceUrl"]),
  recentlyPlayed: defineTable({
    ownerId: v.string(),
    title: v.string(),
    artist: v.optional(v.string()),
    source: musicSource,
    sourceUrl: v.string(),
    artworkUrl: v.optional(v.string()),
    playedAt: v.number(),
  })
    .index("by_owner_played", ["ownerId", "playedAt"])
    .index("by_owner_source_url", ["ownerId", "sourceUrl"]),
});

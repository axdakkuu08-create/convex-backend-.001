package app.unifiedmusic.data

import androidx.room.Entity
import androidx.room.PrimaryKey

const val MIN_TRACK_DURATION_MS = 60_000L

@Entity(tableName = "library_tracks")
data class TrackEntity(
    @PrimaryKey val mediaUri: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long,
    val dateAddedMs: Long,
    val playCount: Long = 0,
    val isFavorite: Boolean = false
) {
    val eligible: Boolean get() = durationMs >= MIN_TRACK_DURATION_MS
}

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val createdAtMs: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "playlist_tracks",
    primaryKeys = ["playlistId", "mediaUri"]
)
data class PlaylistTrackEntity(
    val playlistId: Long,
    val mediaUri: String,
    val addedAtMs: Long = System.currentTimeMillis()
)

@Entity(tableName = "track_lyrics")
data class TrackLyricsEntity(
    @PrimaryKey val mediaUri: String,
    val text: String,
    val updatedAtMs: Long = System.currentTimeMillis()
)

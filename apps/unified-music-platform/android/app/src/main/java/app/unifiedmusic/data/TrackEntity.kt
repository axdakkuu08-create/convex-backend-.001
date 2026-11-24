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
    val playCount: Long = 0
) {
    val eligible: Boolean get() = durationMs >= MIN_TRACK_DURATION_MS
}

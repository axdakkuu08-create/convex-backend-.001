package app.unifiedmusic.data

import android.content.ContentUris
import android.content.Context
import android.provider.MediaStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class ScanResult(val discovered: Int, val eligible: Int, val excludedShort: Int)

class MediaStoreScanner(private val context: Context, private val dao: TrackDao) {
    suspend fun scan(): ScanResult = withContext(Dispatchers.IO) {
        val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATE_ADDED
        )
        val tracks = mutableListOf<TrackEntity>()
        var discovered = 0
        var excluded = 0
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
        context.contentResolver.query(
            collection, projection, selection, null,
            "${MediaStore.Audio.Media.DATE_ADDED} DESC"
        )?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
            val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
            val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
            val addedCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
            while (cursor.moveToNext()) {
                discovered++
                val duration = cursor.getLong(durationCol)
                if (duration < MIN_TRACK_DURATION_MS) {
                    excluded++
                    continue
                }
                val id = cursor.getLong(idCol)
                val uri = ContentUris.withAppendedId(collection, id).toString()
                tracks += TrackEntity(
                    mediaUri = uri,
                    title = cursor.getString(titleCol) ?: "Unknown title",
                    artist = cursor.getString(artistCol)?.takeUnless { it == "<unknown>" } ?: "Unknown artist",
                    album = cursor.getString(albumCol) ?: "Unknown album",
                    durationMs = duration,
                    dateAddedMs = cursor.getLong(addedCol) * 1000L
                )
            }
        }
        if (tracks.isNotEmpty()) dao.upsertAll(tracks)
        ScanResult(discovered, tracks.size, excluded)
    }
}

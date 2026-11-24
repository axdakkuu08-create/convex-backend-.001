package app.unifiedmusic.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

@Dao
interface TrackDao {
    @Query("SELECT * FROM library_tracks WHERE durationMs >= 60000 ORDER BY dateAddedMs DESC")
    fun observeLibrary(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM library_tracks WHERE durationMs >= 60000 ORDER BY playCount DESC")
    fun observeMostPlayed(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM library_tracks WHERE durationMs >= 60000 ORDER BY album COLLATE NOCASE, title COLLATE NOCASE")
    fun observeAlbums(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM library_tracks WHERE durationMs >= 60000 AND isFavorite = 1 ORDER BY title COLLATE NOCASE")
    fun observeFavorites(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM library_tracks WHERE durationMs >= 60000 AND (title LIKE '%' || :query || '%' OR artist LIKE '%' || :query || '%' OR album LIKE '%' || :query || '%') ORDER BY title COLLATE NOCASE")
    fun search(query: String): Flow<List<TrackEntity>>

    @Query("UPDATE library_tracks SET isFavorite = :favorite WHERE mediaUri = :uri")
    suspend fun setFavorite(uri: String, favorite: Boolean)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(tracks: List<TrackEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(track: TrackEntity)

    @Query("UPDATE library_tracks SET playCount = playCount + 1 WHERE mediaUri = :uri")
    suspend fun incrementPlayCount(uri: String)

    @Query("SELECT COUNT(*) FROM library_tracks")
    suspend fun count(): Int
}

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM playlists ORDER BY createdAtMs DESC")
    fun observePlaylists(): Flow<List<PlaylistEntity>>

    @Insert
    suspend fun create(playlist: PlaylistEntity): Long

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun addTrack(item: PlaylistTrackEntity)

    @Query("SELECT library_tracks.* FROM library_tracks INNER JOIN playlist_tracks ON library_tracks.mediaUri = playlist_tracks.mediaUri WHERE playlist_tracks.playlistId = :playlistId AND library_tracks.durationMs >= 60000 ORDER BY playlist_tracks.addedAtMs")
    fun observePlaylistTracks(playlistId: Long): Flow<List<TrackEntity>>

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId AND mediaUri = :uri")
    suspend fun removeTrack(playlistId: Long, uri: String)

    @Query("DELETE FROM playlists WHERE id = :playlistId")
    suspend fun deletePlaylist(playlistId: Long)
}

@Dao
interface LyricsDao {
    @Query("SELECT * FROM track_lyrics WHERE mediaUri = :uri LIMIT 1")
    fun observeLyrics(uri: String): Flow<TrackLyricsEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveLyrics(lyrics: TrackLyricsEntity)
}

@Database(
    entities = [TrackEntity::class, PlaylistEntity::class, PlaylistTrackEntity::class, TrackLyricsEntity::class],
    version = 2,
    exportSchema = false
)
abstract class LibraryDatabase : RoomDatabase() {
    abstract fun tracks(): TrackDao
    abstract fun playlists(): PlaylistDao
    abstract fun lyrics(): LyricsDao

    companion object {
        @Volatile private var INSTANCE: LibraryDatabase? = null
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE library_tracks ADD COLUMN isFavorite INTEGER NOT NULL DEFAULT 0")
                db.execSQL("CREATE TABLE IF NOT EXISTS playlists (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, createdAtMs INTEGER NOT NULL)")
                db.execSQL("CREATE TABLE IF NOT EXISTS playlist_tracks (playlistId INTEGER NOT NULL, mediaUri TEXT NOT NULL, addedAtMs INTEGER NOT NULL, PRIMARY KEY(playlistId, mediaUri))")
                db.execSQL("CREATE TABLE IF NOT EXISTS track_lyrics (mediaUri TEXT NOT NULL PRIMARY KEY, text TEXT NOT NULL, updatedAtMs INTEGER NOT NULL)")
            }
        }

        fun get(context: Context): LibraryDatabase = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Room.databaseBuilder(
                context.applicationContext,
                LibraryDatabase::class.java,
                "unified-library.db"
            ).addMigrations(MIGRATION_1_2).build().also { INSTANCE = it }
        }
    }
}

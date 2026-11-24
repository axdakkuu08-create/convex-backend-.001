package app.unifiedmusic.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Dao
interface TrackDao {
    @Query("SELECT * FROM library_tracks WHERE durationMs >= 60000 ORDER BY dateAddedMs DESC")
    fun observeLibrary(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM library_tracks WHERE durationMs >= 60000 ORDER BY playCount DESC")
    fun observeMostPlayed(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM library_tracks WHERE durationMs >= 60000 ORDER BY album COLLATE NOCASE, title COLLATE NOCASE")
    fun observeAlbums(): Flow<List<TrackEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(tracks: List<TrackEntity>)

    @Query("UPDATE library_tracks SET playCount = playCount + 1 WHERE mediaUri = :uri")
    suspend fun incrementPlayCount(uri: String)

    @Query("SELECT COUNT(*) FROM library_tracks")
    suspend fun count(): Int
}

@Database(entities = [TrackEntity::class], version = 1, exportSchema = false)
abstract class LibraryDatabase : RoomDatabase() {
    abstract fun tracks(): TrackDao

    companion object {
        @Volatile private var INSTANCE: LibraryDatabase? = null
        fun get(context: Context): LibraryDatabase = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Room.databaseBuilder(
                context.applicationContext,
                LibraryDatabase::class.java,
                "unified-library.db"
            ).build().also { INSTANCE = it }
        }
    }
}

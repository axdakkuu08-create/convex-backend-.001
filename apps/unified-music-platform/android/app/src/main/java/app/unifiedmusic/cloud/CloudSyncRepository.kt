package app.unifiedmusic.cloud

import dev.convex.android.ConvexClientWithAuth
import kotlinx.coroutines.flow.first
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CloudPlaylist(
    @SerialName("_id") val id: String,
    val ownerId: String,
    val name: String,
    val createdAt: Double,
    val updatedAt: Double
)

class CloudSyncRepository(private val client: ConvexClientWithAuth<String>) {
    suspend fun syncPlaylistNames(localNames: List<String>): Int {
        val remote = client.subscribe<List<CloudPlaylist>>("playlists:listMine")
            .first()
            .getOrThrow()
        val knownNames = remote.map { it.name.trim().lowercase() }.toMutableSet()
        var added = 0
        localNames.map(String::trim)
            .filter { it.isNotEmpty() }
            .distinctBy { it.lowercase() }
            .forEach { name ->
                if (knownNames.add(name.lowercase())) {
                    client.mutation<String>(
                        "playlists:create",
                        args = mapOf("name" to name)
                    )
                    added++
                }
            }
        return added
    }
}

package app.unifiedmusic.providers

import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class NavidromeConfig(val serverUrl: String, val apiKey: String)

class NavidromeCredentialStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("navidrome-connection", Context.MODE_PRIVATE)
    private val alias = "unified-music-navidrome-api-key"

    fun load(): NavidromeConfig? {
        val server = prefs.getString("server_url", null) ?: return null
        val packed = prefs.getString("api_key", null) ?: return null
        return runCatching {
            val bytes = Base64.decode(packed, Base64.NO_WRAP)
            val iv = bytes.copyOfRange(0, 12)
            val encrypted = bytes.copyOfRange(12, bytes.size)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
            NavidromeConfig(server, String(cipher.doFinal(encrypted), Charsets.UTF_8))
        }.getOrElse {
            clear()
            null
        }
    }

    fun save(config: NavidromeConfig) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val packed = cipher.iv + cipher.doFinal(config.apiKey.toByteArray(Charsets.UTF_8))
        prefs.edit()
            .putString("server_url", config.serverUrl.trimEnd('/'))
            .putString("api_key", Base64.encodeToString(packed, Base64.NO_WRAP))
            .apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
        runCatching {
            val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            store.deleteEntry(alias)
        }
    }

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}

/** OpenSubsonic adapter for Navidrome. Uses HTTPS and an OpenSubsonic API key; never stores passwords. */
class NavidromeAdapter(private val config: NavidromeConfig) {
    private val restBase: String

    init {
        val normalized = config.serverUrl.trim().trimEnd('/')
        val parsed = Uri.parse(normalized)
        require(parsed.scheme.equals("https", ignoreCase = true) && !parsed.host.isNullOrBlank()) {
            "Use your Navidrome HTTPS address so the API key is protected in transit."
        }
        require(config.apiKey.isNotBlank()) { "Enter a Navidrome API key." }
        restBase = if (normalized.endsWith("/rest")) normalized else "$normalized/rest"
    }

    suspend fun connect(): String = withContext(Dispatchers.IO) {
        val response = request("getMusicFolders")
        val folders = response.optJSONObject("musicFolders")?.optJSONArray("musicFolder") ?: JSONArray()
        "Connected • ${folders.length()} music libraries"
    }

    suspend fun searchTracks(query: String): List<ProviderTrack> = withContext(Dispatchers.IO) {
        require(query.trim().length >= 2) { "Enter at least two characters." }
        val response = request(
            "search3",
            mapOf("query" to query.trim(), "songCount" to "60", "songOffset" to "0", "albumCount" to "0", "artistCount" to "0")
        )
        val songs = response.optJSONObject("searchResult3")?.optJSONArray("song") ?: JSONArray()
        buildList {
            for (i in 0 until songs.length()) {
                val song = songs.optJSONObject(i) ?: continue
                val id = song.optString("id")
                val duration = song.optLong("duration") * 1000L
                if (id.isBlank() || duration < 60_000L) continue
                val title = song.optString("title").ifBlank { "Unknown title" }
                val artist = song.optString("artist").ifBlank { "Unknown artist" }
                val stream = mediaUrl("stream", mapOf("id" to id))
                val cover = song.optString("coverArt").takeIf(String::isNotBlank)?.let { mediaUrl("getCoverArt", mapOf("id" to it, "size" to "600")) }
                add(
                    ProviderTrack(
                        provider = "navidrome",
                        providerId = id,
                        title = title,
                        artist = artist,
                        durationMs = duration,
                        streamUrl = stream,
                        permalink = config.serverUrl.trimEnd('/'),
                        licenseUrl = "Personal library • rights depend on the library owner",
                        artworkUrl = cover,
                        attribution = "Your Navidrome library"
                    )
                )
            }
        }.distinctBy { it.stableId }
    }

    private fun request(method: String, extra: Map<String, String> = emptyMap()): JSONObject {
        val uri = Uri.parse("$restBase/$method.view").buildUpon()
            .appendQueryParameter("apiKey", config.apiKey)
            .appendQueryParameter("v", "1.16.1")
            .appendQueryParameter("c", "UnifiedMusicAndroid")
            .appendQueryParameter("f", "json")
        extra.forEach { (key, value) -> uri.appendQueryParameter(key, value) }
        val connection = URL(uri.build().toString()).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 12_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "UnifiedMusicAndroid/0.1")
            if (connection.responseCode !in 200..299) error("Navidrome request failed (${connection.responseCode}). Check the server address and API key.")
            val root = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            val response = root.optJSONObject("subsonic-response") ?: error("The server did not return an OpenSubsonic response.")
            if (response.optString("status") != "ok") {
                val detail = response.optJSONObject("error")?.optString("message").orEmpty()
                error(detail.ifBlank { "Navidrome rejected the request. Check the API key and server access." })
            }
            return response
        } finally {
            connection.disconnect()
        }
    }

    private fun mediaUrl(method: String, values: Map<String, String>): String {
        val builder = Uri.parse("$restBase/$method.view").buildUpon()
            .appendQueryParameter("apiKey", config.apiKey)
            .appendQueryParameter("v", "1.16.1")
            .appendQueryParameter("c", "UnifiedMusicAndroid")
            .appendQueryParameter("f", "json")
        values.forEach { (key, value) -> builder.appendQueryParameter(key, value) }
        return builder.build().toString()
    }
}

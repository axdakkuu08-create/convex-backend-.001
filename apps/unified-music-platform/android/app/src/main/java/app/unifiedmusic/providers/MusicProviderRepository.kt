package app.unifiedmusic.providers

import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale

enum class Eligibility { CANDIDATE_FULL_TRACK, FULL_TRACK, PREVIEW_ONLY, EXTERNAL_ONLY, METADATA_ONLY, BLOCKED, UNKNOWN }
data class ProviderTrack(
    val provider: String, val providerId: String, val title: String, val artist: String,
    val durationMs: Long, val streamUrl: String, val permalink: String,
    val licenseUrl: String, val artworkUrl: String?, val attribution: String
) { val stableId: String get() = "${provider}:${providerId}"; val eligibility = Eligibility.CANDIDATE_FULL_TRACK }
data class RadioStation(
    val id: String, val name: String, val country: String?, val language: String?,
    val codec: String?, val bitrate: Int, val streamUrl: String, val homepage: String?
)

class MusicProviderRepository(private val jamendoClientId: String = "") {
    suspend fun searchTracks(query: String): List<ProviderTrack> = withContext(Dispatchers.IO) {
        require(query.trim().length >= 2) { "Enter at least two characters." }
        val results = mutableListOf<ProviderTrack>()
        results += archive(query.trim())
        if (jamendoClientId.isNotBlank()) runCatching { results += jamendo(query.trim()) }
        results.distinctBy { it.stableId }
    }

    suspend fun searchRadio(query: String): List<RadioStation> = withContext(Dispatchers.IO) {
        require(query.trim().length >= 2) { "Enter at least two characters." }
        val url = "https://de1.api.radio-browser.info/json/stations/search?name=${enc(query)}&hidebroken=true&order=clickcount&reverse=true&limit=40"
        val array = JSONArray(get(url))
        buildList {
            for (i in 0 until array.length()) {
                val x = array.optJSONObject(i) ?: continue
                val stream = x.optString("url_resolved").ifBlank { x.optString("url") }
                if (!stream.startsWith("https://")) continue
                add(RadioStation(x.optString("stationuuid"), x.optString("name"), x.optString("country").takeIf(String::isNotBlank), x.optString("language").takeIf(String::isNotBlank), x.optString("codec").takeIf(String::isNotBlank), x.optInt("bitrate"), stream, x.optString("homepage").takeIf(String::isNotBlank)))
            }
        }.distinctBy { it.id }
    }

    private fun archive(term: String): List<ProviderTrack> {
        val q = "mediatype:audio AND (title:\"${term}\" OR creator:\"${term}\")"
        val url = "https://archive.org/advancedsearch.php?q=${enc(q)}&fl[]=identifier&fl[]=title&fl[]=creator&rows=20&output=json"
        val docs = JSONObject(get(url)).optJSONObject("response")?.optJSONArray("docs") ?: return emptyList()
        val out = mutableListOf<ProviderTrack>()
        for (i in 0 until docs.length()) {
            val doc = docs.optJSONObject(i) ?: continue
            val id = doc.optString("identifier")
            if (!id.matches(Regex("[A-Za-z0-9_-]{1,100}"))) continue
            runCatching {
                val payload = JSONObject(get("https://archive.org/metadata/${enc(id)}"))
                val meta = payload.optJSONObject("metadata") ?: JSONObject()
                val license = meta.optString("licenseurl").ifBlank { meta.optString("rights") }
                if (!allowed(license)) return@runCatching
                val files = payload.optJSONArray("files") ?: JSONArray()
                val audioFiles = (0 until files.length()).mapNotNull { files.optJSONObject(it) }
                    .filter {
                        it.optString("name").matches(Regex("(?i).+\\.(mp3|m4a|ogg|oga|opus|wav|flac)")) &&
                            !it.optString("name").contains("spectrogram", true) &&
                            !it.optString("name").contains("thumbnail", true)
                    }
                // Archive file.length is a byte count, not a playback duration. Never use it as seconds.
                // Multi-file items are ambiguous when only item-level runtime metadata is available.
                val originals = audioFiles.filter { it.optString("source").equals("original", true) }
                val candidates = if (originals.isNotEmpty()) originals else audioFiles
                if (candidates.size != 1) return@runCatching
                val file = candidates.single()
                val duration = durationMs(meta.optString("runtime"))
                if (duration < 60_000L) return@runCatching
                val name = file.optString("name")
                val stream = "https://archive.org/download/${enc(id)}/${Uri.encode(name)}"
                if (!probeArchiveAudio(stream)) return@runCatching
                out += ProviderTrack("internet_archive", "$id:$name", meta.optString("title").ifBlank { doc.optString("title").ifBlank { id } }, meta.optString("creator").ifBlank { doc.optString("creator").ifBlank { "Internet Archive contributor" } }, duration, stream, "https://archive.org/details/${enc(id)}", license, "https://archive.org/services/img/${enc(id)}", "Internet Archive • ${meta.optString("creator")}")
            }
        }
        return out
    }

    private fun jamendo(term: String): List<ProviderTrack> {
        val url = "https://api.jamendo.com/v3.0/tracks/?client_id=${enc(jamendoClientId)}&format=json&limit=20&search=${enc(term)}&audioformat=mp32"
        val results = JSONObject(get(url)).optJSONArray("results") ?: return emptyList()
        return buildList {
            for (i in 0 until results.length()) {
                val x = results.optJSONObject(i) ?: continue
                val license = x.optString("license_ccurl")
                val stream = x.optString("audio")
                val id = x.optString("id")
                val duration = x.optLong("duration") * 1000
                if (!allowed(license) || !stream.startsWith("https://") || id.isBlank() || duration < 60_000L) continue
                add(ProviderTrack("jamendo", id, x.optString("name"), x.optString("artist_name"), duration, stream, x.optString("shareurl").ifBlank { "https://www.jamendo.com/track/${id}" }, license, x.optString("album_image").takeIf(String::isNotBlank), "Music by ${x.optString("artist_name")} via Jamendo"))
            }
        }
    }

    private fun allowed(value: String): Boolean {
        val v = value.trim().lowercase(Locale.ROOT)
        if (v.contains("creativecommons.org/publicdomain/zero/") ||
            v.contains("creativecommons.org/publicdomain/mark/") ||
            v.contains("creativecommons.org/zero/") ||
            v == "public domain" || v.startsWith("public domain ")) return true

        // Exact CC BY / CC BY-SA families only; do not accidentally admit BY-NC or BY-ND.
        return Regex("""creativecommons\.org/licenses/by(-sa)?/(1\.0|2\.0|2\.5|3\.0|4\.0)/?$""")
            .containsMatchIn(v)
    }

    private fun probeArchiveAudio(address: String): Boolean {
        val connection = URL(address).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 10_000
            connection.readTimeout = 12_000
            connection.setRequestProperty("Range", "bytes=0-0")
            connection.setRequestProperty("Accept", "audio/*,application/ogg,application/octet-stream")
            connection.setRequestProperty("User-Agent", "UnifiedMusic/0.1 Android")
            if (connection.responseCode != HttpURLConnection.HTTP_PARTIAL) return false
            val type = connection.contentType?.lowercase(Locale.ROOT).orEmpty()
            if (!(type.startsWith("audio/") || type.contains("ogg") || type == "application/octet-stream")) return false
            val range = connection.getHeaderField("Content-Range").orEmpty()
            val total = range.substringAfterLast('/', "").toLongOrNull() ?: return false
            if (total <= 1L) return false
            return connection.inputStream.use { it.read() >= 0 }
        } finally {
            connection.disconnect()
        }
    }

    private fun durationMs(s: String): Long {
        s.toDoubleOrNull()?.let { return (it * 1000).toLong() }
        val p = s.split(":").mapNotNull(String::toDoubleOrNull)
        if (p.size != s.count { it == ':' } + 1) return 0
        return (p.fold(0.0) { a, b -> a * 60 + b } * 1000).toLong()
    }
    private fun enc(s: String) = URLEncoder.encode(s, Charsets.UTF_8.name())
    private fun get(address: String): String {
        val c = URL(address).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 10_000; c.readTimeout = 12_000
            c.setRequestProperty("Accept", "application/json")
            c.setRequestProperty("User-Agent", "UnifiedMusic/0.1 Android")
            if (c.responseCode !in 200..299) error("Provider request failed (${c.responseCode})")
            return c.inputStream.bufferedReader().use { it.readText() }
        } finally { c.disconnect() }
    }
}

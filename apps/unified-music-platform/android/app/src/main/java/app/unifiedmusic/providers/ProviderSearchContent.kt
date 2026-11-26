package app.unifiedmusic.providers

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun ProviderSearchContent(
    repository: MusicProviderRepository,
    credentialStore: NavidromeCredentialStore,
    accent: Color,
    onPlayTrack: (ProviderTrack, List<ProviderTrack>) -> Unit,
    onPlayStation: (RadioStation) -> Unit
) {
    var query by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf("Tracks") }
    var tracks by remember { mutableStateOf<List<ProviderTrack>>(emptyList()) }
    var stations by remember { mutableStateOf<List<RadioStation>>(emptyList()) }
    var navTracks by remember { mutableStateOf<List<ProviderTrack>>(emptyList()) }
    var navServerUrl by remember { mutableStateOf(credentialStore.load()?.serverUrl.orEmpty()) }
    var navApiKey by remember { mutableStateOf(credentialStore.load()?.apiKey.orEmpty()) }
    var navConfig by remember { mutableStateOf(credentialStore.load()) }
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("Navidrome personal library first; Internet Archive genuine full-track candidates next. Radio is separate.") }
    var requestKey by remember { mutableStateOf("") }
    var connectRequest by remember { mutableIntStateOf(0) }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = mode == "Tracks", onClick = { mode = "Tracks" }, label = { Text("Music tracks") })
            FilterChip(selected = mode == "Radio", onClick = { mode = "Radio" }, label = { Text("Radio stations") })
            FilterChip(selected = mode == "Navidrome", onClick = { mode = "Navidrome" }, label = { Text("Navidrome") })
        }
        if (mode == "Tracks" || mode == "Radio") {
            OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth(), label = { Text(if (mode == "Tracks") "Search online music" else "Search radio stations") }, singleLine = true)
            Button(onClick = { requestKey = query.trim() + "|" + mode }, enabled = query.trim().length >= 2 && !loading) { Text("Search providers") }
            if (message.isNotBlank()) Text(message, color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
            if (mode == "Tracks") {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    items(tracks, key = { it.stableId }) { track ->
                        Surface(color = Color(0xFF141C19), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().clickable { onPlayTrack(track, tracks) }) {
                            Column(Modifier.padding(13.dp)) {
                                Text(track.title, fontWeight = FontWeight.SemiBold, maxLines = 1)
                                Text("${track.artist} • ${track.provider.replace('_', ' ')}", color = accent, style = MaterialTheme.typography.bodySmall)
                                Text("${track.durationMs / 60000}:${((track.durationMs / 1000) % 60).toString().padStart(2, '0')} • Full-track candidate • duration metadata and audio endpoint checked; device playback still needs verification", color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
                                Text("License: ${track.licenseUrl}", color = Color.LightGray, style = MaterialTheme.typography.labelSmall, maxLines = 2)
                                Text("Attribution: ${track.attribution}", color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    items(stations, key = { it.id }) { station ->
                        Surface(color = Color(0xFF141C19), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().clickable { onPlayStation(station) }) {
                            Column(Modifier.padding(13.dp)) {
                                Text(station.name, fontWeight = FontWeight.SemiBold)
                                Text(listOfNotNull(station.country, station.language, station.codec, station.bitrate.takeIf { it > 0 }?.let { "${it} kbps" }).joinToString(" • "), color = accent, style = MaterialTheme.typography.bodySmall)
                                Text("Radio Browser listing • stream availability can change", color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
                                station.homepage?.let { Text(it, color = accent, style = MaterialTheme.typography.labelSmall, maxLines = 1) }
                            }
                        }
                    }
                }
            }
        } else {
            Text("Connect your own Navidrome server using its OpenSubsonic API.", color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(navServerUrl, { navServerUrl = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Server HTTPS URL") }, singleLine = true, placeholder = { Text("https://music.example.com") })
            OutlinedTextField(navApiKey, { navApiKey = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Navidrome API key") }, singleLine = true, visualTransformation = PasswordVisualTransformation())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { connectRequest++ }, enabled = !loading && navServerUrl.isNotBlank() && navApiKey.isNotBlank()) { Text("Connect") }
                if (navConfig != null) TextButton(onClick = { credentialStore.clear(); navConfig = null; navApiKey = ""; navTracks = emptyList(); message = "Navidrome disconnected." }) { Text("Disconnect") }
            }
            if (navConfig != null) Text("Saved connection: ${navConfig!!.serverUrl}", color = accent, style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Search your Navidrome library") }, singleLine = true)
            Button(onClick = { requestKey = query.trim() + "|Navidrome" }, enabled = navConfig != null && query.trim().length >= 2 && !loading) { Text("Search Navidrome") }
            if (message.isNotBlank()) Text(message, color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
            LazyColumn(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                items(navTracks, key = { it.stableId }) { track ->
                    Surface(color = Color(0xFF141C19), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().clickable { onPlayTrack(track, navTracks) }) {
                        Column(Modifier.padding(13.dp)) {
                            Text(track.title, fontWeight = FontWeight.SemiBold, maxLines = 1)
                            Text("${track.artist} • Navidrome", color = accent, style = MaterialTheme.typography.bodySmall)
                            Text("${track.durationMs / 60000}:${((track.durationMs / 1000) % 60).toString().padStart(2, '0')} • Your personal server", color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
        if (loading) CircularProgressIndicator()
    }

    LaunchedEffect(connectRequest) {
        if (connectRequest == 0) return@LaunchedEffect
        loading = true
        message = "Checking Navidrome connection…"
        try {
            val config = NavidromeConfig(navServerUrl.trimEnd('/'), navApiKey)
            message = NavidromeAdapter(config).connect()
            credentialStore.save(config)
            navConfig = config
            navTracks = emptyList()
        } catch (error: Exception) {
            message = error.message ?: "Could not connect to Navidrome."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(requestKey) {
        if (requestKey.isBlank()) return@LaunchedEffect
        loading = true
        message = ""
        try {
            when {
                requestKey.endsWith("|Tracks") -> {
                    tracks = repository.searchTracks(query)
                    message = if (tracks.isEmpty()) "No eligible Internet Archive full-track candidates. Items without an accepted license, reliable duration or accessible audio file are excluded." else "${tracks.size} full-track candidates • source attribution and license are displayed; playback is not marked verified until device testing."
                }
                requestKey.endsWith("|Radio") -> {
                    stations = repository.searchRadio(query)
                    message = if (stations.isEmpty()) "No station entries returned." else "${stations.size} radio stations • streams may become unavailable."
                }
                requestKey.endsWith("|Navidrome") -> {
                    val config = navConfig ?: error("Connect a Navidrome server first.")
                    navTracks = NavidromeAdapter(config).searchTracks(query)
                    message = if (navTracks.isEmpty()) "No matching tracks of at least 60 seconds were found." else "${navTracks.size} tracks found in your Navidrome library."
                }
            }
        } catch (error: Exception) {
            message = error.message ?: "Provider search failed."
        } finally {
            loading = false
            requestKey = ""
        }
    }
}

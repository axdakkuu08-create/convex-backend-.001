package app.unifiedmusic.providers

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
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun ProviderSearchContent(
    repository: MusicProviderRepository,
    accent: Color,
    onPlayTrack: (ProviderTrack, List<ProviderTrack>) -> Unit,
    onPlayStation: (RadioStation) -> Unit
) {
    var query by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf("Tracks") }
    var tracks by remember { mutableStateOf<List<ProviderTrack>>(emptyList()) }
    var stations by remember { mutableStateOf<List<RadioStation>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("Search Internet Archive and configured Jamendo music, or discover radio stations.") }
    var requestKey by remember { mutableStateOf("") }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = mode == "Tracks", onClick = { mode = "Tracks" }, label = { Text("Music tracks") })
            FilterChip(selected = mode == "Radio", onClick = { mode = "Radio" }, label = { Text("Radio stations") })
        }
        OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth(), label = { Text(if (mode == "Tracks") "Search online music" else "Search radio stations") }, singleLine = true)
        Button(onClick = { requestKey = query.trim() + "|" + mode }, enabled = query.trim().length >= 2 && !loading) { Text("Search providers") }
        if (loading) CircularProgressIndicator()
        if (message.isNotBlank()) Text(message, color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
        if (mode == "Tracks") {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                items(tracks, key = { it.stableId }) { track ->
                    Surface(color = Color(0xFF141C19), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().clickable { onPlayTrack(track, tracks) }) {
                        Column(Modifier.padding(13.dp)) {
                            Text(track.title, fontWeight = FontWeight.SemiBold, maxLines = 1)
                            Text("${track.artist} • ${track.provider.replace('_', ' ')}", color = accent, style = MaterialTheme.typography.bodySmall)
                            Text("${track.durationMs / 60000}:${((track.durationMs / 1000) % 60).toString().padStart(2, '0')} • Full track", color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
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
                            Text("Internet radio • station stream", color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }

    LaunchedEffect(requestKey) {
        if (requestKey.isBlank()) return@LaunchedEffect
        loading = true
        message = ""
        try {
            if (mode == "Tracks") {
                tracks = repository.searchTracks(query)
                message = if (tracks.isEmpty()) "No eligible licensed full-track matches. Items without an accepted license are excluded." else "${tracks.size} eligible tracks • source attribution is displayed."
            } else {
                stations = repository.searchRadio(query)
                message = if (stations.isEmpty()) "No station entries returned." else "${stations.size} radio stations • streams may become unavailable."
            }
        } catch (error: Exception) {
            message = error.message ?: "Provider search failed."
        } finally {
            loading = false
            requestKey = ""
        }
    }
}

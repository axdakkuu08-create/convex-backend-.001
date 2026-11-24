package app.unifiedmusic

import android.Manifest
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Album
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import app.unifiedmusic.data.LibraryDatabase
import app.unifiedmusic.data.MediaStoreScanner
import app.unifiedmusic.data.TrackEntity
import app.unifiedmusic.playback.PlaybackService
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.launch

private val Ink = Color(0xFF090D0C)
private val Panel = Color(0xFF141C19)
private val Mint = Color(0xFF78E6B1)

class MainActivity : ComponentActivity() {
    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) scanLibrary()
    }
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var mediaController by mutableStateOf<MediaController?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        controllerFuture = MediaController.Builder(this, token).buildAsync()
        controllerFuture?.addListener({
            runCatching { mediaController = controllerFuture?.get() }
        }, { command -> runOnUiThread(command) })
        setContent {
            val dao = remember { LibraryDatabase.get(applicationContext).tracks() }
            val tracks by dao.observeLibrary().collectAsState(initial = emptyList())
            var selected by remember { mutableStateOf("Library") }
            var scanMessage by remember { mutableStateOf("Your music stays on this device.") }
            MaterialTheme(colorScheme = darkColorScheme(
                background = Ink, surface = Panel, primary = Mint, onBackground = Color.White,
                onSurface = Color.White, onPrimary = Ink
            )) {
                Scaffold(
                    containerColor = Ink,
                    bottomBar = {
                        NavigationBar(containerColor = Panel) {
                            listOf("Home", "Library", "Albums", "Settings").forEach { item ->
                                NavigationBarItem(
                                    selected = selected == item,
                                    onClick = { selected = item },
                                    icon = { Icon(
                                        when (item) {
                                            "Home" -> Icons.Default.Home
                                            "Albums" -> Icons.Default.Album
                                            "Settings" -> Icons.Default.Settings
                                            else -> Icons.Default.LibraryMusic
                                        }, contentDescription = item
                                    ) },
                                    label = { Text(item) }
                                )
                            }
                        }
                    }
                ) { padding ->
                    Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp)) {
                        Spacer(Modifier.height(22.dp))
                        Text("UNIFIED MUSIC", color = Mint, style = MaterialTheme.typography.labelMedium)
                        Text(selected, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(8.dp))
                        when (selected) {
                            "Home" -> HomeContent(tracks.size, scanMessage, onScan = ::requestScan)
                            "Albums" -> AlbumContent(tracks)
                            "Settings" -> SettingsContent(scanMessage, onScan = ::requestScan)
                            else -> LibraryContent(
                                tracks = tracks,
                                message = scanMessage,
                                onScan = ::requestScan,
                                onPlay = { track ->
                                    mediaController?.let { player ->
                                        player.setMediaItem(MediaItem.fromUri(track.mediaUri))
                                        player.prepare()
                                        player.play()
                                        lifecycleScope.launch { dao.incrementPlayCount(track.mediaUri) }
                                    }
                                }
                            )
                        }
                        Spacer(Modifier.height(14.dp))
                        mediaController?.let { player ->
                            Surface(color = Panel, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(player.currentMediaItem?.mediaMetadata?.title?.toString() ?: "Nothing playing", fontWeight = FontWeight.SemiBold)
                                        Text("Unified player", color = Mint, style = MaterialTheme.typography.labelSmall)
                                    }
                                    TextButton(onClick = { if (player.isPlaying) player.pause() else player.play() }) {
                                        Text(if (player.isPlaying) "PAUSE" else "PLAY")
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                    }
                }
            }
        }
    }

    private fun requestScan() {
        val permissionName = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO else Manifest.permission.READ_EXTERNAL_STORAGE
        if (checkSelfPermission(permissionName) == PackageManager.PERMISSION_GRANTED) scanLibrary()
        else permission.launch(permissionName)
    }

    private fun scanLibrary() {
        lifecycleScope.launch {
            runCatching {
                val dao = LibraryDatabase.get(applicationContext).tracks()
                MediaStoreScanner(applicationContext, dao).scan()
            }
        }
    }

    override fun onDestroy() {
        controllerFuture?.let { MediaController.releaseFuture(it) }
        mediaController = null
        super.onDestroy()
    }
}

@Composable
private fun LibraryContent(
    tracks: List<TrackEntity>, message: String, onScan: () -> Unit, onPlay: (TrackEntity) -> Unit
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("${tracks.size} tracks", color = Mint)
            Text(message, color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
        }
        Button(onClick = onScan) { Text("Scan device") }
    }
    Spacer(Modifier.height(12.dp))
    if (tracks.isEmpty()) {
        Surface(color = Panel, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(22.dp)) {
                Text("Your library starts here", style = MaterialTheme.typography.titleLarge)
                Text("Scan your device to find eligible local audio. Tracks shorter than 60 seconds are left out.", color = Color.LightGray)
            }
        }
    } else {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(tracks, key = { it.mediaUri }) { track ->
                Surface(color = Panel, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().clickable { onPlay(track) }) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = Color(0xFF263B32), shape = RoundedCornerShape(12.dp)) {
                            Text("♫", Modifier.padding(horizontal = 15.dp, vertical = 12.dp), color = Mint)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(track.title, fontWeight = FontWeight.SemiBold, maxLines = 1)
                            Text("${track.artist} • ${track.album}", color = Color.LightGray, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                        }
                        Text("%d:%02d".format(track.durationMs / 60000, (track.durationMs / 1000) % 60), color = Mint)
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeContent(count: Int, message: String, onScan: () -> Unit) {
    Text("Your listening space", style = MaterialTheme.typography.titleLarge)
    Text("Local music first. Your library works without an account.", color = Color.LightGray)
    Spacer(Modifier.height(18.dp))
    Surface(color = Panel, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp)) {
            Text("YOUR LIBRARY", color = Mint, style = MaterialTheme.typography.labelMedium)
            Text("$count tracks", style = MaterialTheme.typography.headlineMedium)
            Text(message, color = Color.LightGray)
            Spacer(Modifier.height(12.dp))
            Button(onClick = onScan) { Text("Scan device") }
        }
    }
    Spacer(Modifier.height(16.dp))
    Text("Coming into the unified roadmap", color = Mint)
    Text("Recently added • Most played • Playlists • Lyrics • Listening history • Themes", color = Color.LightGray)
}

@Composable
private fun AlbumContent(tracks: List<TrackEntity>) {
    val albums = tracks.distinctBy { it.album to it.artist }
    if (albums.isEmpty()) Text("Albums will appear after your first library scan.", color = Color.LightGray)
    else LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(albums, key = { it.album + it.artist }) {
            Surface(color = Panel, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(it.album, fontWeight = FontWeight.SemiBold)
                    Text(it.artist, color = Color.LightGray)
                }
            }
        }
    }
}

@Composable
private fun SettingsContent(message: String, onScan: () -> Unit) {
    Text("Library", color = Mint, style = MaterialTheme.typography.titleMedium)
    Text("Local scanning • 60-second minimum • Room library storage", color = Color.LightGray)
    Spacer(Modifier.height(18.dp))
    Text("Playback", color = Mint, style = MaterialTheme.typography.titleMedium)
    Text("Media3 playback service foundation", color = Color.LightGray)
    Spacer(Modifier.height(18.dp))
    Text("Privacy", color = Mint, style = MaterialTheme.typography.titleMedium)
    Text("Audio files are read from device storage and are not uploaded.", color = Color.LightGray)
    Spacer(Modifier.height(18.dp))
    Text(message, color = Color.LightGray)
    Button(onClick = onScan) { Text("Scan library") }
}

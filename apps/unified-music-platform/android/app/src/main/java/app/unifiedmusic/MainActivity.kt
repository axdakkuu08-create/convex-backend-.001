package app.unifiedmusic

import android.Manifest
import android.content.ComponentName
import android.content.pm.PackageManager
import android.media.audiofx.Equalizer
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import app.unifiedmusic.data.*
import app.unifiedmusic.cloud.CloudSyncRepository
import com.clerk.api.Clerk
import com.clerk.ui.auth.AuthView
import com.clerk.ui.userbutton.UserButton
import app.unifiedmusic.playback.PlaybackService
import app.unifiedmusic.providers.MusicProviderRepository
import app.unifiedmusic.providers.ProviderTrack
import app.unifiedmusic.providers.RadioStation
import app.unifiedmusic.providers.ProviderSearchContent
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.delay
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
    private var scanMessage by mutableStateOf("Your music stays on this device.")
    private var themeChoice by mutableStateOf("Emerald")
    private var equalizer: Equalizer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        themeChoice = getSharedPreferences("unified-settings", MODE_PRIVATE).getString("theme", "Emerald") ?: "Emerald"
        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        controllerFuture = MediaController.Builder(this, token).buildAsync()
        controllerFuture?.addListener({
            runCatching { mediaController = controllerFuture?.get() }
        }, { command -> runOnUiThread(command) })
        setContent {
            val db = remember { LibraryDatabase.get(applicationContext) }
            val dao = remember { db.tracks() }
            val playlistsDao = remember { db.playlists() }
            val lyricsDao = remember { db.lyrics() }
            val tracks by dao.observeLibrary().collectAsState(initial = emptyList())
            val favorites by dao.observeFavorites().collectAsState(initial = emptyList())
            val playlists by playlistsDao.observePlaylists().collectAsState(initial = emptyList())
            var selected by remember { mutableStateOf("Home") }
            var query by remember { mutableStateOf("") }
            val searchResults by dao.search(query).collectAsState(initial = emptyList())
            var selectedPlaylist by remember { mutableStateOf<PlaylistEntity?>(null) }
            val playlistTracks by playlistsDao.observePlaylistTracks(selectedPlaylist?.id ?: -1L).collectAsState(initial = emptyList())
            var fullPlayer by remember { mutableStateOf(false) }
            var showCreatePlaylist by remember { mutableStateOf(false) }
            var playlistName by remember { mutableStateOf("") }
            var showLyrics by remember { mutableStateOf(false) }
            var showEqualizer by remember { mutableStateOf(false) }
            var lyricsText by remember { mutableStateOf("") }
            var cloudSyncMessage by remember { mutableStateOf("Cloud sync has not run yet.") }
                        var position by remember { mutableLongStateOf(0L) }

            DisposableEffect(mediaController) {
                val listener = object : Player.Listener {
                    override fun onEvents(player: Player, events: Player.Events) { position = player.currentPosition }
                }
                mediaController?.addListener(listener)
                onDispose { mediaController?.removeListener(listener) }
            }
            LaunchedEffect(mediaController, fullPlayer) {
                while (true) {
                    position = mediaController?.currentPosition ?: 0L
                    delay(500)
                }
            }
            val currentUri = mediaController?.currentMediaItem?.localConfiguration?.uri?.toString()
            LaunchedEffect(currentUri, showLyrics) {
                if (currentUri != null && showLyrics) {
                    lyricsDao.observeLyrics(currentUri).collect { lyricsText = it?.text.orEmpty() }
                }
            }
            val accent = when (themeChoice) {
                "Ocean" -> Color(0xFF7DCBFF)
                "Amber" -> Color(0xFFFFC36A)
                else -> Mint
            }
            MaterialTheme(colorScheme = darkColorScheme(
                primary = accent, secondary = accent, background = Ink,
                surface = Panel, onSurface = Color.White, onPrimary = Ink
            )) {
                Scaffold(
                    containerColor = Ink,
                    bottomBar = {
                        NavigationBar(containerColor = Panel) {
                            val destinations = listOf("Home", "Library", "Search", "Playlists", "Favorites", "Settings")
                            destinations.forEach { destination ->
                                NavigationBarItem(
                                    selected = selected == destination,
                                    onClick = { selected = destination; selectedPlaylist = null },
                                    icon = {
                                        Icon(
                                            when (destination) {
                                                "Home" -> Icons.Default.Home
                                                "Library" -> Icons.Default.LibraryMusic
                                                "Search" -> Icons.Default.Search
                                                "Playlists" -> Icons.Default.QueueMusic
                                                "Favorites" -> Icons.Default.Favorite
                                                else -> Icons.Default.Settings
                                            }, contentDescription = destination
                                        )
                                    },
                                    label = { Text(destination, maxLines = 1) }
                                )
                            }
                        }
                    }
                ) { padding ->
                    Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 18.dp)) {
                        Spacer(Modifier.height(18.dp))
                        Text("UNIFIED MUSIC", color = accent, style = MaterialTheme.typography.labelMedium)
                        Text(selectedPlaylist?.name ?: selected, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(10.dp))
                        when (selected) {
                            "Home" -> HomeContent(tracks, scanMessage, accent, ::requestScan, onOpen = { selected = it })
                            "Library" -> TrackList(tracks, accent, ::requestScan, onPlay = { playTrack(it, tracks, dao) }, onFavorite = { track -> lifecycleScope.launch { dao.setFavorite(track.mediaUri, !track.isFavorite) } })
                            "Search" -> {
                                Text("ON THIS DEVICE • ${searchResults.size}", color = accent, style = MaterialTheme.typography.labelMedium)
                                searchResults.take(3).forEach { track ->
                                    TrackRow(track, accent, { playTrack(track, tracks, dao) }, { lifecycleScope.launch { dao.setFavorite(track.mediaUri, !track.isFavorite) } }, trailing = if (track.isFavorite) "♥" else "♡")
                                }
                                Spacer(Modifier.height(8.dp))
                                Text("ONLINE PROVIDERS", color = accent, style = MaterialTheme.typography.labelMedium)
                                ProviderSearchContent(
                                    repository = remember { MusicProviderRepository(BuildConfig.JAMENDO_CLIENT_ID) },
                                    accent = accent,
                                    onPlayTrack = { track, queue -> playProviderTracks(track, queue) },
                                    onPlayStation = { station -> playRadioStation(station) }
                                )
                            }
                            "Favorites" -> TrackList(favorites, accent, null, onPlay = { playTrack(it, tracks, dao) }, onFavorite = { track -> lifecycleScope.launch { dao.setFavorite(track.mediaUri, !track.isFavorite) } })
                            "Playlists" -> {
                                if (selectedPlaylist == null) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("Your collections", modifier = Modifier.weight(1f), color = Color.LightGray)
                                        Button(onClick = { showCreatePlaylist = true }) { Icon(Icons.Default.Add, null); Text(" New") }
                                    }
                                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        items(playlists, key = { it.id }) { playlist ->
                                            Surface(color = Panel, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().clickable { selectedPlaylist = playlist }) {
                                                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                                    Icon(Icons.Default.QueueMusic, null, tint = accent)
                                                    Spacer(Modifier.width(12.dp))
                                                    Text(playlist.name, Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                                                    Text("OPEN", color = accent)
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    TextButton(onClick = { selectedPlaylist = null }) { Text("← All playlists") }
                                    Text("Tracks in this playlist", color = accent)
                                    LazyColumn {
                                        items(playlistTracks, key = { it.mediaUri }) { TrackRow(it, accent, { playTrack(it, playlistTracks, dao) }, { lifecycleScope.launch { playlistsDao.removeTrack(selectedPlaylist!!.id, it.mediaUri) } }) }
                                        item { Spacer(Modifier.height(12.dp)); Text("Add from library", color = accent) }
                                        items(tracks.filterNot { track -> playlistTracks.any { it.mediaUri == track.mediaUri } }, key = { it.mediaUri }) { TrackRow(it, accent, { lifecycleScope.launch { playlistsDao.addTrack(PlaylistTrackEntity(selectedPlaylist!!.id, it.mediaUri)) } }, null, trailing = "ADD") }
                                    }
                                }
                            }
                            "Albums" -> AlbumContent(tracks, accent, onPlay = { playTrack(it, tracks, dao) })
                            "Settings" -> SettingsContent(
                                scanMessage, themeChoice, cloudSyncMessage,
                                onTheme = { choice -> themeChoice = choice; getSharedPreferences("unified-settings", MODE_PRIVATE).edit().putString("theme", choice).apply() },
                                onScan = ::requestScan,
                                onEqualizer = { showEqualizer = true },
                                onSyncPlaylists = {
                                    val client = (application as UnifiedMusicApplication).convexClient
                                    if (client == null) {
                                        cloudSyncMessage = "Cloud sync needs a Convex URL and Clerk publishable key."
                                    } else {
                                        lifecycleScope.launch {
                                            runCatching {
                                                CloudSyncRepository(client).syncPlaylistNames(playlists.map { it.name })
                                            }.onSuccess { count ->
                                                cloudSyncMessage = "Cloud playlists updated. $count new playlist names synced."
                                            }.onFailure { error ->
                                                cloudSyncMessage = "Sync unavailable: " + (error.message ?: "authentication or deployment check failed")
                                            }
                                        }
                                    }
                                }
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                        mediaController?.let { player ->
                            val item = player.currentMediaItem
                            Surface(color = Panel, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth().clickable { fullPlayer = true }) {
                                Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(item?.mediaMetadata?.title?.toString() ?: "Nothing playing", fontWeight = FontWeight.SemiBold, maxLines = 1)
                                        Text(item?.mediaMetadata?.artist?.toString() ?: "Tap to open player", color = accent, style = MaterialTheme.typography.labelSmall)
                                    }
                                    IconButton(onClick = { if (player.isPlaying) player.pause() else player.play() }) {
                                        Icon(if (player.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, "Play or pause", tint = accent)
                                    }
                                    IconButton(onClick = { player.seekToNextMediaItem() }) { Icon(Icons.Default.SkipNext, "Next", tint = accent) }
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                }

                if (showCreatePlaylist) {
                    AlertDialog(
                        onDismissRequest = { showCreatePlaylist = false },
                        title = { Text("Create playlist") },
                        text = { OutlinedTextField(playlistName, { playlistName = it }, label = { Text("Playlist name") }, singleLine = true, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences)) },
                        confirmButton = {
                            TextButton(onClick = {
                                val name = playlistName.trim()
                                if (name.isNotEmpty()) lifecycleScope.launch { playlistsDao.create(PlaylistEntity(name = name)) }
                                playlistName = ""; showCreatePlaylist = false
                            }) { Text("Create") }
                        },
                        dismissButton = { TextButton(onClick = { showCreatePlaylist = false }) { Text("Cancel") } }
                    )
                }
                if (fullPlayer && mediaController != null) {
                    FullPlayerSheet(
                        player = mediaController!!, tracks = tracks, position = position, accent = accent,
                        onClose = { fullPlayer = false },
                        onLyrics = { showLyrics = true },
                        onEqualizer = { showEqualizer = true }
                    )
                }
                if (showLyrics && currentUri != null) {
                    AlertDialog(
                        onDismissRequest = { showLyrics = false },
                        title = { Text("Lyrics") },
                        text = {
                            Column {
                                Text("Saved on this device for this track.", color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
                                Spacer(Modifier.height(8.dp))
                                OutlinedTextField(lyricsText, { lyricsText = it }, modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp), placeholder = { Text("Add or paste lyrics you have permission to use…") })
                            }
                        },
                        confirmButton = {
                            TextButton(onClick = { lifecycleScope.launch { lyricsDao.saveLyrics(TrackLyricsEntity(currentUri, lyricsText)) }; showLyrics = false }) { Text("Save lyrics") }
                        },
                        dismissButton = { TextButton(onClick = { showLyrics = false }) { Text("Close") } }
                    )
                }
                if (showEqualizer) {
                    EqualizerDialog(
                        equalizer = equalizerFor(PlaybackService.audioSessionId),
                        onClose = { showEqualizer = false; equalizer?.release(); equalizer = null }
                    )
                }
            }
        }
    }

    private fun equalizerFor(sessionId: Int): Equalizer? {
        if (sessionId <= 0) return null
        if (equalizer == null) equalizer = runCatching { Equalizer(0, sessionId).apply { enabled = true } }.getOrNull()
        return equalizer
    }

    private fun playTrack(track: TrackEntity, tracks: List<TrackEntity>, dao: TrackDao) {
        val player = mediaController ?: return
        val queue = tracks.map { item ->
            MediaItem.Builder().setUri(item.mediaUri).setMediaMetadata(
                MediaMetadata.Builder().setTitle(item.title).setArtist(item.artist).setAlbumTitle(item.album).build()
            ).build()
        }
        val index = tracks.indexOfFirst { it.mediaUri == track.mediaUri }.coerceAtLeast(0)
        player.setMediaItems(queue, index, 0L)
        player.prepare()
        player.play()
        lifecycleScope.launch { dao.incrementPlayCount(track.mediaUri) }
    }

    private fun playProviderTracks(selected: ProviderTrack, queue: List<ProviderTrack>) {
        val player = mediaController ?: return
        val playable = queue.filter { it.streamUrl.startsWith("https://") && it.eligibility == app.unifiedmusic.providers.Eligibility.FULL_TRACK }
        if (playable.isEmpty()) return
        val items = playable.map { track ->
            MediaItem.Builder()
                .setMediaId(track.stableId)
                .setUri(track.streamUrl)
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(track.title)
                        .setArtist(track.artist)
                        .setAlbumTitle(track.provider.replace('_', ' '))
                        .setArtworkUri(track.artworkUrl?.let(android.net.Uri::parse))
                        .build()
                ).build()
        }
        val index = playable.indexOfFirst { it.stableId == selected.stableId }.coerceAtLeast(0)
        player.setMediaItems(items, index, 0L)
        player.prepare()
        player.play()
    }

    private fun playRadioStation(station: RadioStation) {
        val player = mediaController ?: return
        val item = MediaItem.Builder()
            .setMediaId("radio:${station.id}")
            .setUri(station.streamUrl)
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(station.name)
                    .setArtist(listOfNotNull(station.country, station.language).joinToString(" • ").ifBlank { "Internet radio" })
                    .setAlbumTitle("Radio Browser")
                    .build()
            ).build()
        player.setMediaItem(item)
        player.prepare()
        player.play()
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
            }.onSuccess { result ->
                scanMessage = "Found ${result.discovered}; added ${result.eligible}; skipped short tracks ${result.excludedShort}."
            }.onFailure { error ->
                scanMessage = "Scan failed: ${error.message ?: "unknown error"}"
            }
        }
    }

    override fun onDestroy() {
        equalizer?.release()
        equalizer = null
        controllerFuture?.let { MediaController.releaseFuture(it) }
        mediaController = null
        super.onDestroy()
    }
}

@Composable
private fun HomeContent(tracks: List<TrackEntity>, message: String, accent: Color, onScan: () -> Unit, onOpen: (String) -> Unit) {
    Text("Your listening space", style = MaterialTheme.typography.titleLarge)
    Text("Local music first. Your library works without an account.", color = Color.LightGray)
    Spacer(Modifier.height(14.dp))
    Surface(color = Panel, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp)) {
            Text("YOUR LIBRARY", color = accent, style = MaterialTheme.typography.labelMedium)
            Text("${tracks.size} tracks", style = MaterialTheme.typography.headlineMedium)
            Text(message, color = Color.LightGray)
            Spacer(Modifier.height(10.dp))
            Button(onClick = onScan) { Text("Scan device") }
        }
    }
    Spacer(Modifier.height(16.dp))
    Text("Explore your music", color = accent, style = MaterialTheme.typography.titleMedium)
    listOf("Recently added", "Most played", "Albums", "Favorites", "Playlists").forEach { item ->
        Surface(color = Panel, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable { onOpen(if (item == "Recently added" || item == "Most played") "Library" else item) }) {
            Text(item, Modifier.padding(15.dp), fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun TrackList(tracks: List<TrackEntity>, accent: Color, onScan: (() -> Unit)?, onPlay: (TrackEntity) -> Unit, onFavorite: (TrackEntity) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("${tracks.size} tracks", color = accent, modifier = Modifier.weight(1f))
        if (onScan != null) Button(onClick = onScan) { Text("Scan device") }
    }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        items(tracks, key = { it.mediaUri }) { TrackRow(it, accent, { onPlay(it) }, { onFavorite(it) }, trailing = if (it.isFavorite) "♥" else "♡") }
    }
}

@Composable
private fun TrackRow(track: TrackEntity, accent: Color, onClick: () -> Unit, onTrailing: (() -> Unit)?, trailing: String? = null) {
    Surface(color = Panel, shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth().clickable { onClick() }) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = Color(0xFF263B32), shape = RoundedCornerShape(11.dp)) { Text("♫", Modifier.padding(horizontal = 13.dp, vertical = 10.dp), color = accent) }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(track.title, fontWeight = FontWeight.SemiBold, maxLines = 1)
                Text("${track.artist} • ${track.album}", color = Color.LightGray, style = MaterialTheme.typography.bodySmall, maxLines = 1)
            }
            onTrailing?.let { TextButton(onClick = it) { Text(trailing ?: "ADD", color = accent) } }
            Text("%d:%02d".format(track.durationMs / 60000, (track.durationMs / 1000) % 60), color = accent, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun AlbumContent(tracks: List<TrackEntity>, accent: Color, onPlay: (TrackEntity) -> Unit) {
    val albums = tracks.groupBy { it.album to it.artist }.toList()
    if (albums.isEmpty()) Text("Albums appear after scanning your device.", color = Color.LightGray)
    else LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(albums, key = { it.first.first + it.first.second }) { (key, songs) ->
            Surface(color = Panel, shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(15.dp)) {
                    Text(key.first, fontWeight = FontWeight.SemiBold)
                    Text("${key.second} • ${songs.size} tracks", color = Color.LightGray)
                    TextButton(onClick = { songs.firstOrNull()?.let(onPlay) }) { Text("Play album", color = accent) }
                }
            }
        }
    }
}

@Composable
private fun SettingsContent(
    message: String,
    theme: String,
    cloudSyncMessage: String,
    onTheme: (String) -> Unit,
    onScan: () -> Unit,
    onEqualizer: () -> Unit,
    onSyncPlaylists: () -> Unit
) {
    LazyColumn {
        item {
            Text("Appearance", color = Mint, style = MaterialTheme.typography.titleMedium)
            Text("Choose an accent theme", color = Color.LightGray)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Emerald", "Ocean", "Amber").forEach { choice ->
                    FilterChip(selected = theme == choice, onClick = { onTheme(choice) }, label = { Text(choice) })
                }
            }
            Spacer(Modifier.height(16.dp))
            Text("Playback", color = Mint, style = MaterialTheme.typography.titleMedium)
            Button(onClick = onEqualizer) { Icon(Icons.Default.Equalizer, null); Text(" Equalizer") }
            Spacer(Modifier.height(12.dp))
            Text("Library", color = Mint, style = MaterialTheme.typography.titleMedium)
            Text("Local scanning • 60-second minimum • Room storage", color = Color.LightGray)
            Button(onClick = onScan) { Text("Scan library") }
            Text(message, color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(16.dp))
            Text("Privacy", color = Mint, style = MaterialTheme.typography.titleMedium)
            Text("Local audio and saved lyrics stay on this device. Local playback never depends on sign-in.", color = Color.LightGray)
            Spacer(Modifier.height(14.dp))
            CloudAccountContent(cloudSyncMessage, onSyncPlaylists)
        }
    }
}


@Composable
private fun CloudAccountContent(message: String, onSyncPlaylists: () -> Unit) {
    val app = LocalContext.current.applicationContext as UnifiedMusicApplication
    Text("Cloud account", color = Mint, style = MaterialTheme.typography.titleMedium)
    if (app.convexClient == null) {
        Text(
            "Convex is prepared in the app, but this build has no development deployment URL or Clerk publishable key configured.",
            color = Color.LightGray
        )
    } else {
        val user by Clerk.userFlow.collectAsState(initial = null)
        if (user == null) {
            AuthView()
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Clerk account signed in", modifier = Modifier.weight(1f), color = Color.LightGray)
                UserButton()
            }
            Button(onClick = onSyncPlaylists) { Text("Sync playlist names") }
        }
    }
    Text(message, color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FullPlayerSheet(player: MediaController, tracks: List<TrackEntity>, position: Long, accent: Color, onClose: () -> Unit, onLyrics: () -> Unit, onEqualizer: () -> Unit) {
    var duration by remember { mutableLongStateOf(player.duration.coerceAtLeast(0L)) }
        LaunchedEffect(player.currentMediaItemIndex, player.duration) {
        duration = player.duration.coerceAtLeast(0L)
    }
    ModalBottomSheet(onDismissRequest = onClose, containerColor = Panel) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("NOW PLAYING", color = accent, style = MaterialTheme.typography.labelMedium)
            Spacer(Modifier.height(22.dp))
            Surface(color = Color(0xFF263B32), shape = RoundedCornerShape(28.dp), modifier = Modifier.size(190.dp)) {
                Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.MusicNote, null, tint = accent, modifier = Modifier.size(90.dp)) }
            }
            Spacer(Modifier.height(20.dp))
            Text(player.currentMediaItem?.mediaMetadata?.title?.toString() ?: "Nothing playing", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(player.currentMediaItem?.mediaMetadata?.artist?.toString() ?: "Unknown artist", color = Color.LightGray)
            Slider(value = if (duration > 0) (position.toFloat() / duration).coerceIn(0f, 1f) else 0f, onValueChange = { player.seekTo((it * duration).toLong()) }, modifier = Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(timeText(position), color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
                Text(timeText(duration), color = Color.LightGray, style = MaterialTheme.typography.labelSmall)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
                IconButton(onClick = { player.shuffleModeEnabled = !player.shuffleModeEnabled }) { Icon(Icons.Default.Shuffle, "Shuffle", tint = if (player.shuffleModeEnabled) accent else Color.LightGray) }
                IconButton(onClick = { player.seekToPreviousMediaItem() }) { Icon(Icons.Default.SkipPrevious, "Previous", modifier = Modifier.size(34.dp)) }
                FilledIconButton(onClick = { if (player.isPlaying) player.pause() else player.play() }, modifier = Modifier.size(64.dp)) { Icon(if (player.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, "Play pause", modifier = Modifier.size(34.dp)) }
                IconButton(onClick = { player.seekToNextMediaItem() }) { Icon(Icons.Default.SkipNext, "Next", modifier = Modifier.size(34.dp)) }
                IconButton(onClick = { player.repeatMode = when (player.repeatMode) { Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL; Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE; else -> Player.REPEAT_MODE_OFF } }) {
                    Icon(if (player.repeatMode == Player.REPEAT_MODE_ONE) Icons.Default.RepeatOne else Icons.Default.Repeat, "Repeat", tint = if (player.repeatMode == Player.REPEAT_MODE_OFF) Color.LightGray else accent)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onLyrics) { Icon(Icons.Default.Lyrics, null); Text(" Lyrics") }
                OutlinedButton(onClick = onEqualizer) { Icon(Icons.Default.Equalizer, null); Text(" Equalizer") }
            }
            Spacer(Modifier.height(12.dp))
            Text("QUEUE • ${player.mediaItemCount} tracks", color = accent, style = MaterialTheme.typography.titleSmall, modifier = Modifier.align(Alignment.Start))
            LazyColumn(Modifier.heightIn(max = 180.dp)) {
                items(player.mediaItemCount) { index ->
                    val item = player.getMediaItemAt(index)
                    Row(Modifier.fillMaxWidth().clickable { player.seekTo(index, 0L) }.padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(if (index == player.currentMediaItemIndex) "♫" else "${index + 1}", color = accent, modifier = Modifier.width(32.dp))
                        Column {
                            Text(item.mediaMetadata.title?.toString() ?: "Unknown title", maxLines = 1)
                            Text(item.mediaMetadata.artist?.toString() ?: "", color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EqualizerDialog(equalizer: Equalizer?, onClose: () -> Unit) {
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text("Equalizer") },
        text = {
            if (equalizer == null) Text("The device audio effect is unavailable until playback starts on a supported audio output.")
            else Column {
                Text("System audio effect • ${equalizer.numberOfBands} bands", color = Color.LightGray, style = MaterialTheme.typography.bodySmall)
                val range = equalizer.bandLevelRange
                for (band in 0 until equalizer.numberOfBands.toInt()) {
                    val index = band.toShort()
                    var level by remember(equalizer, band) { mutableFloatStateOf(equalizer.getBandLevel(index).toFloat()) }
                    Column {
                        Text("${equalizer.getCenterFreq(index) / 1000} Hz")
                        Slider(value = level, onValueChange = {
                            level = it
                            runCatching { equalizer.setBandLevel(index, it.toInt().toShort()) }
                        }, valueRange = range[0].toFloat()..range[1].toFloat())
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onClose) { Text("Done") } }
    )
}

private fun timeText(ms: Long): String = "%d:%02d".format(ms.coerceAtLeast(0) / 60000, (ms.coerceAtLeast(0) / 1000) % 60)

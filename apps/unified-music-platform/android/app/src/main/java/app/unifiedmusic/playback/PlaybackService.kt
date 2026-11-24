package app.unifiedmusic.playback

import android.media.AudioManager
import androidx.media3.common.AudioAttributes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

@OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {
    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        val sessionId = audioManager.generateAudioSessionId()
        val player = ExoPlayer.Builder(this).build()
        if (sessionId != AudioManager.ERROR) {
            player.setAudioSessionId(sessionId)
            audioSessionId = sessionId
        }
        player.setAudioAttributes(AudioAttributes.DEFAULT, true)
        player.setHandleAudioBecomingNoisy(true)
        mediaSession = MediaSession.Builder(this, player).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
        }
        mediaSession = null
        audioSessionId = AudioManager.ERROR
        super.onDestroy()
    }

    companion object {
        @Volatile var audioSessionId: Int = AudioManager.ERROR
            private set
    }
}

package com.pulse.music;

import android.content.ComponentName;
import android.os.Handler;
import android.os.Looper;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "PulseMedia3")
public final class PulseMedia3Plugin extends Plugin {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;
    private final Runnable positionTicker = new Runnable() {
        @Override
        public void run() {
            if (controller != null) {
                emitState(controller);
                if (controller.isPlaying()) mainHandler.postDelayed(this, 500);
            }
        }
    };

    private interface ControllerAction {
        void run(MediaController mediaController);
    }

    private void withController(PluginCall call, ControllerAction action) {
        if (controller != null) {
            action.run(controller);
            return;
        }
        if (controllerFuture == null) {
            SessionToken token = new SessionToken(
                getContext(),
                new ComponentName(getContext(), PulseAudioService.class)
            );
            controllerFuture = new MediaController.Builder(getContext(), token).buildAsync();
        }
        controllerFuture.addListener(() -> {
            try {
                controller = controllerFuture.get();
                controller.addListener(new androidx.media3.common.Player.Listener() {
                    @Override
                    public void onEvents(androidx.media3.common.Player player,
                                         androidx.media3.common.Player.Events events) {
                        emitState(player);
                        mainHandler.removeCallbacks(positionTicker);
                        if (player.isPlaying()) mainHandler.post(positionTicker);
                    }
                });
                action.run(controller);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                call.reject("Interrupted while connecting to the audio service", error);
            } catch (ExecutionException error) {
                call.reject("Could not connect to the Android audio service", error);
            } catch (RuntimeException error) {
                call.reject("Android audio operation failed", error);
            }
        }, mainHandler::post);
    }

    private void emitState(androidx.media3.common.Player player) {
        JSObject state = new JSObject();
        state.put("isPlaying", player.isPlaying());
        state.put("positionSeconds", Math.max(0, player.getCurrentPosition()) / 1000.0);
        state.put("durationSeconds", player.getDuration() > 0 ? player.getDuration() / 1000.0 : 0);
        state.put("playbackState", player.getPlaybackState());
        state.put("title", player.getMediaMetadata().title == null ? "" : player.getMediaMetadata().title.toString());
        state.put("mediaId", player.getCurrentMediaItem() == null ? "" : player.getCurrentMediaItem().mediaId);
        notifyListeners("playbackState", state);
    }

    @PluginMethod
    public void setQueue(PluginCall call) {
        JSArray tracks = call.getArray("tracks");
        int requestedIndex = call.getInt("startIndex", 0);
        if (tracks == null || tracks.length() == 0) {
            call.reject("At least one playable queue item is required");
            return;
        }

        List<MediaItem> items = new ArrayList<>();
        try {
            for (int i = 0; i < tracks.length(); i++) {
                JSONObject track = tracks.getJSONObject(i);
                String url = track.optString("url", "");
                String mediaId = track.optString("id", "pulse-" + i);
                if (!(url.startsWith("https://") || url.startsWith("http://"))) {
                    call.reject("Every native queue item must use an HTTP or HTTPS audio URL");
                    return;
                }
                MediaMetadata metadata = new MediaMetadata.Builder()
                    .setTitle(track.optString("title", "Pulse audio"))
                    .setArtist(track.optString("artist", "Unknown artist"))
                    .build();
                items.add(new MediaItem.Builder()
                    .setMediaId(mediaId)
                    .setUri(url)
                    .setMediaMetadata(metadata)
                    .build());
            }
        } catch (JSONException error) {
            call.reject("The native playback queue contains invalid track data", error);
            return;
        }

        int startIndex = Math.max(0, Math.min(requestedIndex, items.size() - 1));
        withController(call, mediaController -> {
            mediaController.setMediaItems(items, startIndex, 0L);
            mediaController.prepare();
            call.resolve();
        });
    }

    @PluginMethod
    public void loadTrack(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            call.reject("A direct HTTP or HTTPS audio URL is required");
            return;
        }
        String title = call.getString("title", "Pulse audio");
        String artist = call.getString("artist", "Unknown artist");
        withController(call, mediaController -> {
            MediaMetadata metadata = new MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .build();
            MediaItem item = new MediaItem.Builder()
                .setUri(url)
                .setMediaMetadata(metadata)
                .build();
            mediaController.setMediaItem(item);
            mediaController.prepare();
            call.resolve();
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        withController(call, mediaController -> {
            mediaController.play();
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withController(call, mediaController -> {
            mediaController.pause();
            call.resolve();
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        double seconds = call.getDouble("positionSeconds", 0.0);
        withController(call, mediaController -> {
            mediaController.seekTo(Math.max(0L, (long) (seconds * 1000)));
            call.resolve();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        double volume = call.getDouble("volume", 0.75);
        withController(call, mediaController -> {
            mediaController.setVolume((float) Math.max(0, Math.min(1, volume)));
            call.resolve();
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        withController(call, mediaController -> {
            JSObject state = new JSObject();
            state.put("isPlaying", mediaController.isPlaying());
            state.put("positionSeconds", Math.max(0, mediaController.getCurrentPosition()) / 1000.0);
            state.put("durationSeconds", mediaController.getDuration() > 0 ? mediaController.getDuration() / 1000.0 : 0);
            state.put("playbackState", mediaController.getPlaybackState());
            state.put("mediaId", mediaController.getCurrentMediaItem() == null ? "" : mediaController.getCurrentMediaItem().mediaId);
            call.resolve(state);
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
            controller = null;
        }
        super.handleOnDestroy();
    }
}

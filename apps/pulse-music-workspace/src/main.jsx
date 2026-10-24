import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider, useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { ConvexReactClient, useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import "./auth.css";

const listSavedTracks = makeFunctionReference("savedTracks:list");
const saveTrack = makeFunctionReference("savedTracks:save");
const removeSavedTrack = makeFunctionReference("savedTracks:remove");

function LibrarySyncBridge() {
  const { isAuthenticated } = useConvexAuth();
  const savedTracks = useQuery(listSavedTracks, isAuthenticated ? {} : "skip");
  const saveTrackMutation = useMutation(saveTrack);
  const removeTrackMutation = useMutation(removeSavedTrack);

  useEffect(() => {
    if (!isAuthenticated || !savedTracks) return;
    let cancelled = false;
    async function syncLocalLibrary() {
      const localTracks = typeof window.pulseGetLikedTracks === "function" ? window.pulseGetLikedTracks() : [];
      for (const track of localTracks) {
        if (cancelled) return;
        if (!savedTracks.some((saved) => saved.sourceUrl === track.src) && /^https?:\/\//i.test(track.src)) {
          try {
            await saveTrackMutation({
              title: track.title,
              artist: track.artist,
              source: "direct",
              sourceUrl: track.src,
            });
          } catch (error) {
            window.pulseShowCloudMessage?.(error instanceof Error ? error.message : "A saved track could not sync.");
          }
        }
      }
      if (!cancelled) window.pulseApplyCloudSavedTracks?.(savedTracks);
    }
    void syncLocalLibrary();
    return () => { cancelled = true; };
  }, [isAuthenticated, savedTracks, saveTrackMutation]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onToggle = async (event) => {
      const detail = event.detail;
      if (!detail?.track?.sourceUrl || !/^https?:\/\//i.test(detail.track.sourceUrl)) return;
      try {
        if (detail.liked) {
          await saveTrackMutation(detail.track);
        } else {
          const existing = (savedTracks || []).find((item) => item.sourceUrl === detail.track.sourceUrl);
          if (existing) await removeTrackMutation({ trackId: existing._id });
        }
      } catch (error) {
        window.pulseShowCloudMessage?.(error instanceof Error ? error.message : "Cloud library sync failed.");
      }
    };
    window.addEventListener("pulse:library-toggle", onToggle);
    return () => window.removeEventListener("pulse:library-toggle", onToggle);
  }, [isAuthenticated, savedTracks, saveTrackMutation, removeTrackMutation]);

  return null;
}

function PasskeyPanel() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    window.pulseShowCloudMessage = (text) => setMessage(text);
    return () => { delete window.pulseShowCloudMessage; };
  }, []);

  if (isLoading) return <div className="pulse-auth" aria-live="polite">Checking sign-in…</div>;
  if (isAuthenticated) {
    return (
      <>
        <div className="pulse-auth pulse-auth--signed-in">
          <span><strong>Pulse account connected</strong><small>Saved tracks sync to your account when connected.</small></span>
          <button type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
        {message && <p className="pulse-auth__message" role="status">{message}</p>}
      </>
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await signIn("passkey", { email: email.trim() });
      setMessage("Passkey request submitted. Follow your device's prompt to continue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey sign-in did not complete. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pulse-auth" onSubmit={submit}>
      <label htmlFor="pulse-auth-email">Sync your music library</label>
      <div className="pulse-auth__controls">
        <input id="pulse-auth-email" type="email" required value={email} autoComplete="username webauthn" placeholder="Email for your account" onChange={(event) => setEmail(event.target.value)} />
        <button type="submit" disabled={busy}>{busy ? "Waiting for passkey…" : "Continue with passkey"}</button>
      </div>
      <small>Passkeys use your device's supported screen lock, biometric prompt, or password manager.</small>
      {message && <p className="pulse-auth__message" role="status">{message}</p>}
    </form>
  );
}

const rootElement = document.getElementById("pulse-auth-root");
const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (rootElement) {
  if (!convexUrl) {
    rootElement.innerHTML = '<div class="pulse-auth pulse-auth--notice"><strong>Cloud sync setup pending</strong><small>Pulse is still usable locally. Add VITE_CONVEX_URL after creating a Convex development deployment to enable account sign-in.</small></div>';
  } else {
    const client = new ConvexReactClient(convexUrl);
    window.pulseConvexClient = client;
    createRoot(rootElement).render(
      <React.StrictMode>
        <ConvexAuthProvider client={client}>
          <LibrarySyncBridge />
          <PasskeyPanel />
        </ConvexAuthProvider>
      </React.StrictMode>,
    );
  }
}

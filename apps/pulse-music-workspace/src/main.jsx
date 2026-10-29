import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider, useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { ConvexReactClient, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import "./auth.css";
import "./ai.css";

function PasskeyPanel() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (isLoading) return <div className="pulse-auth" aria-live="polite">Checking sign-in…</div>;
  if (isAuthenticated) {
    return (
      <div className="pulse-auth pulse-auth--signed-in">
        <span><strong>Pulse account connected</strong><small>Your playlists can be synced after backend deployment.</small></span>
        <button type="button" onClick={() => void signOut()}>Sign out</button>
      </div>
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

function MusicAssistant() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ask = useAction(api.ai.ask);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!isAuthenticated || busy || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const result = await ask({ prompt: prompt.trim() });
      setAnswer(result.answer);
      setModel(result.model);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assistant could not respond. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pulse-ai" aria-labelledby="pulse-ai-title">
      <div className="pulse-ai__head">
        <div>
          <small>DISCOVERY COMPANION</small>
          <h2 id="pulse-ai-title">Ask Pulse AI</h2>
          <p>Explore moods, build playlist ideas, or learn about music.</p>
        </div>
        <span className="pulse-ai__tag">FREE MODEL ROUTING</span>
      </div>
      {!isLoading && !isAuthenticated && <p className="pulse-ai__hint">Sign in above to use the assistant. Your request is sent through the secure Convex backend.</p>}
      <form className="pulse-ai__form" onSubmit={submit}>
        <textarea aria-label="Ask Pulse AI" maxLength={1800} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. Build a calm 30-minute focus playlist theme…" disabled={!isAuthenticated || busy} />
        <button type="submit" disabled={!isAuthenticated || busy || !prompt.trim()}>{busy ? "Thinking…" : "Ask AI"}</button>
      </form>
      {error && <p className="pulse-ai__answer pulse-ai__error" role="alert">{error}</p>}
      {answer && <div className="pulse-ai__answer" role="status">{answer}<div className="pulse-ai__foot">Model route: {model}. Availability and free-model limits may change.</div></div>}
      <p className="pulse-ai__foot">AI suggestions are not live catalogue results and do not control playback. Free models may be rate-limited.</p>
    </section>
  );
}

const rootElement = document.getElementById("pulse-auth-root");
const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (rootElement) {
  if (!convexUrl) {
    rootElement.innerHTML = '<div class="pulse-auth pulse-auth--notice"><strong>Cloud sync setup pending</strong><small>Pulse is still usable locally. Add VITE_CONVEX_URL after creating a Convex development deployment to enable account sign-in and AI.</small></div>';
  } else {
    const client = new ConvexReactClient(convexUrl);
    window.pulseConvexClient = client;
    createRoot(rootElement).render(
      <React.StrictMode>
        <ConvexAuthProvider client={client}>
          <PasskeyPanel />
          <MusicAssistant />
        </ConvexAuthProvider>
      </React.StrictMode>,
    );
  }
}

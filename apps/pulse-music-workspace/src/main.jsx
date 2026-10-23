import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider, useAuthActions, useConvexAuth, usePasskeyAuth } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./auth.css";

function PasskeyPanel() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signInOrRegisterWithPasskey } = usePasskeyAuth();
  const { signOut } = useAuthActions();
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
      const result = await signInOrRegisterWithPasskey({ email: email.trim() });
      setMessage(result?.registered ? "Passkey account created." : "Signed in successfully.");
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
          <PasskeyPanel />
        </ConvexAuthProvider>
      </React.StrictMode>,
    );
  }
}

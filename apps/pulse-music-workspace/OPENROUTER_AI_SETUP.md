# Pulse OpenRouter AI setup

This branch adds an optional AI music-discovery assistant. It is separate from the music playback path and does not replace or alter Spotify, YouTube, SoundCloud, Internet Archive, direct audio, or Convex library data.

## Secure configuration

1. Create an OpenRouter key at https://openrouter.ai/settings/keys. Do not paste it into chat or commit it.
2. In the Convex dashboard for the intended Pulse deployment, open Environment Variables and add:
   - `OPENROUTER_API_KEY`: the private OpenRouter key
   - `OPENROUTER_MODEL`: optional; defaults to `openrouter/free`
   - `SITE_URL`: optional URL for the deployed Pulse site, used as OpenRouter request metadata
3. Keep `OPENROUTER_API_KEY` server-only. Never prefix it with `VITE_`, add it to `.env.example`, put it in browser code, or store it in GitHub files.
4. Ensure the Convex Auth deployment is configured and `VITE_CONVEX_URL` points to the intended Convex deployment. The assistant requires a signed-in Pulse account.

For a development deployment, from `apps/pulse-music-workspace`, use the Convex CLI to set the secret interactively: `npx convex env set OPENROUTER_API_KEY` and enter the value when prompted. If the CLI expects a value argument in your installed version, use its documented syntax without sharing the value in screenshots or chat. Set `OPENROUTER_MODEL` to `openrouter/free` if you want to explicitly choose the free-model router.

## Android-only GitHub workflow

1. Open the repository in GitHub on your phone: https://github.com/axdakkuu08-create/convex-backend-.001
2. Switch to branch `feature/pulse-openrouter-ai` and review the files in this change.
3. Add secrets only in the Convex deployment environment, not as public repository variables. GitHub Actions secrets are appropriate only if a workflow genuinely needs the key; this app's browser build does not.
4. Run the PR checks and deploy the Convex function changes to the intended Convex deployment after review. A Vercel frontend deploy alone does not configure Convex environment variables or deploy Convex actions.
5. Test while signed in: valid prompt, empty prompt, oversized prompt, missing key, invalid key, free-model rate limit, and sign-out. Confirm local playback still works if AI is unconfigured.

## Safety and limits

- The Convex action checks authentication, trims and limits the prompt, limits output tokens, and does not expose the key to the browser.
- The free router chooses from available free models; capacity, supported features, response quality, and limits vary. See https://openrouter.ai/collections/free-models/.
- The assistant does not search a live music catalogue, verify song availability, or control playback. Its recommendations are suggestions.
- This is an integration branch, not a claim that production is live. Configure secrets and run authenticated deployment tests before rollout.

"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const MAX_PROMPT_LENGTH = 1800;
const MAX_OUTPUT_TOKENS = 450;

export const ask = action({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to Pulse to use the AI music assistant.");

    const prompt = args.prompt.trim();
    if (!prompt) throw new Error("Enter a question first.");
    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new Error(`Keep your message under ${MAX_PROMPT_LENGTH} characters.`);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("AI is not configured yet. Add OPENROUTER_API_KEY to the Convex deployment environment.");
    }

    const model = process.env.OPENROUTER_MODEL || "openrouter/free";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "https://pulse-music-workspace.vercel.app",
        "X-Title": "Pulse Music Assistant",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are Pulse's music discovery assistant. Help with music discovery, playlist themes, mood-based listening ideas, and explanations about music. Be concise and friendly. Do not claim you searched a live catalogue, played a track, or verified availability unless a tool actually did so. Recommend legal listening through official services. If asked for recommendations, suggest search terms or playlist ideas rather than inventing catalogue results.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("OpenRouter rejected the server key. Check the Convex environment secret.");
      }
      if (response.status === 429) {
        throw new Error("The selected free model is busy or rate-limited. Try again shortly.");
      }
      throw new Error(`OpenRouter request failed (${response.status}). Try again later.`);
    }

    const payload = await response.json();
    const answer = payload?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("The selected model returned an empty response. Try again.");
    }
    return { answer: answer.trim(), model };
  },
});

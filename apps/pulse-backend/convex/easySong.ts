import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Read-only Easy Song Licensing API adapter.
 *
 * Configure EASYSONG_API_KEY in the Convex deployment environment.
 * This action never submits or modifies licensing requests.
 */
export const getRequestStatus = action({
  args: {
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Sign in is required to check a licensing request.");
    }

    const requestId = args.requestId.trim();
    if (!requestId || requestId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(requestId)) {
      throw new Error("A valid Easy Song request ID is required.");
    }

    const apiKey = process.env.EASYSONG_API_KEY;
    if (!apiKey) {
      throw new Error("Easy Song integration is not configured on this deployment.");
    }

    const response = await fetch(
      `https://api.easysong.com/api/requests/${encodeURIComponent(requestId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      // Do not include provider response bodies, which may contain sensitive details.
      if (response.status === 401 || response.status === 403) {
        throw new Error("Easy Song rejected the API credentials or permissions.");
      }
      if (response.status === 404) {
        throw new Error("The Easy Song request was not found.");
      }
      throw new Error(`Easy Song status lookup failed (HTTP ${response.status}).`);
    }

    const payload: unknown = await response.json();
    // Easy Song documents request status responses as an array of request objects.
    const request = Array.isArray(payload) ? payload[0] : payload;
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      throw new Error("Easy Song returned an unexpected response.");
    }

    const data = request as Record<string, unknown>;
    const rawStatus = data.status ?? data.Status ?? data.requestStatus ?? data.RequestStatus;
    const statusData =
      rawStatus && typeof rawStatus === "object" && !Array.isArray(rawStatus)
        ? (rawStatus as Record<string, unknown>)
        : null;
    const statusValue =
      typeof rawStatus === "string"
        ? rawStatus
        : statusData?.status ?? statusData?.Status;
    const idValue = data.id ?? data.Id ?? data.requestId ?? data.RequestId;
    const description = statusData?.description ?? statusData?.Description;

    if (typeof statusValue !== "string" || !statusValue.trim()) {
      throw new Error("Easy Song response did not contain a recognised request status.");
    }

    return {
      requestId:
        typeof idValue === "string" || typeof idValue === "number"
          ? String(idValue)
          : requestId,
      status: statusValue.trim(),
      ...(typeof description === "string" && description.trim()
        ? { description: description.trim() }
        : {}),
    };
  },
});

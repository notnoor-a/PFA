/**
 * Thin fetch wrapper that:
 *   1. Resolves the backend base URL from VITE_API_URL (defaults to localhost:3001)
 *   2. Attaches the current Firebase user's ID token as
 *      `Authorization: Bearer <token>` on every request
 *   3. JSON-encodes outgoing bodies and JSON-decodes responses
 *   4. Throws an Error whose message is the server's error field, so callers
 *      can `try/catch` and show something meaningful to the user.
 *
 * Usage:
 *   import { apiFetch } from "../lib/api";
 *   const { aiResult, mlHint, id } = await apiFetch("/predict", {
 *     method: "POST",
 *     body: { symptoms: ["fever", "cough"] },
 *   });
 */

import { auth } from "./firebase";
import i18n from "../i18n/i18n";

const RAW_API_URL =
  (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:3001";

// Strip a trailing slash so `${API_URL}${path}` never produces a double slash.
export const API_URL = String(RAW_API_URL).replace(/\/+$/, "");

function getCurrentLanguage() {
  const raw = String(i18n.language || "en").toLowerCase();
  const lang = raw.split("-")[0];
  return ["en", "fr", "ar"].includes(lang) ? lang : "en";
}

/**
 * Wait until Firebase has settled on whether a user is signed in, then return
 * that user (or null). Necessary right after a page load because
 * `auth.currentUser` is null until the SDK finishes its first handshake.
 */
function waitForAuthUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const unsub = auth.onAuthStateChanged((user) => {
      unsub();
      resolve(user || null);
    });
  });
}

/**
 * Fetch a backend endpoint with the Firebase ID token attached.
 *
 * @param {string} path       Path beginning with `/` (e.g. "/predict")
 * @param {object} [options]
 * @param {string} [options.method="GET"]
 * @param {object} [options.body]           Object; will be JSON-stringified
 * @param {object} [options.headers]        Extra headers
 * @param {boolean} [options.requireAuth=true]
 *        Whether to attach the ID token. Only /health should pass false.
 * @param {AbortSignal} [options.signal]    Optional abort signal
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiFetch(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    requireAuth = true,
    signal,
  } = options;

  if (!path || typeof path !== "string" || !path.startsWith("/")) {
    throw new Error(`apiFetch: path must start with "/" — got "${path}"`);
  }

  const finalHeaders = {
    Accept: "application/json",
    "x-app-lang": getCurrentLanguage(),
    ...headers,
  };

  if (body !== undefined && body !== null) {
    finalHeaders["Content-Type"] = "application/json";
  }

  let currentUser = null;
  if (requireAuth) {
    currentUser = await waitForAuthUser();
    if (!currentUser) {
      throw new Error("You must be signed in to perform this action.");
    }
    try {
      const token = await currentUser.getIdToken();
      finalHeaders.Authorization = `Bearer ${token}`;
    } catch (err) {
      throw new Error(
        err?.message || "Could not get auth token. Please sign in again."
      );
    }
  }

  const sendRequest = (headersOverride = finalHeaders) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: headersOverride,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      signal,
    });

  let response;
  try {
    response = await sendRequest(finalHeaders);
  } catch (networkErr) {
    // Thrown on DNS failure, server down, CORS reject, etc.
    throw new Error(
      `Cannot reach backend at ${API_URL}. Is it running? (${
        networkErr?.message || "network error"
      })`
    );
  }

  // Try to parse a JSON body regardless of status — most error responses are JSON.
  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && requireAuth && currentUser) {
      try {
        const refreshedToken = await currentUser.getIdToken(true);
        const retryHeaders = {
          ...finalHeaders,
          Authorization: `Bearer ${refreshedToken}`,
        };
        response = await sendRequest(retryHeaders);
        const retryText = await response.text();
        if (retryText) {
          try {
            data = JSON.parse(retryText);
          } catch {
            data = { raw: retryText };
          }
        } else {
          data = null;
        }
        if (response.ok) {
          return data;
        }
      } catch {
        // keep original failure flow below
      }
    }

    const message =
      data?.error ||
      data?.message ||
      data?.raw ||
      `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/** Convenience: GET /health (no auth required). */
export async function apiHealth() {
  return apiFetch("/health", { requireAuth: false });
}

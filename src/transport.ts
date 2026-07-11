/**
 * Codex-faithful HTTP transport.
 *
 * Builds the same headers and cookie behavior used by the codex Rust client:
 * - originator: codex_cli_rs
 * - User-Agent: codex_cli_rs/{ver} (os ver; arch) terminal
 * - Authorization: Bearer {token}
 * - ChatGPT-Account-ID: {account_id}
 * - ChatGPT Cloudflare cookie store on all outbound/inbound requests
 */

import { getCodexOriginator, buildCodexUserAgent } from "./ua.ts";
import { wrapFetchWithCookies, type FetchLike } from "./cookies.ts";

export interface TransportOptions {
  token: string;
  accountId: string;
  fetchImpl?: FetchLike;
}

export const DEFAULT_BASE_URL = "https://chatgpt.com/backend-api";
export const DEFAULT_CLIENT_VERSION = "1.0.0";

export interface CodexTransport {
  fetch: FetchLike;
  baseUrl: string;
  token: string;
  accountId: string;
  buildHeaders(accept: string): Headers;
  resolveEndpoint(path: "models" | "responses"): string;
  resolveSearchEndpoint(): string;
}

export function resolveCodexEndpoint(path: "models" | "responses"): string {
  return `${DEFAULT_BASE_URL}/codex/${path}`;
}

export function resolveCodexSearchEndpoint(): string {
  return `${DEFAULT_BASE_URL}/codex/alpha/search`;
}

export function createTransport(options: TransportOptions): CodexTransport {
  const rawFetch: FetchLike = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const fetch = wrapFetchWithCookies(rawFetch);

  return {
    fetch,
    baseUrl: DEFAULT_BASE_URL,
    token: options.token,
    accountId: options.accountId,

    buildHeaders(accept: string): Headers {
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${options.token}`);
      headers.set("chatgpt-account-id", options.accountId);
      headers.set("originator", getCodexOriginator());
      headers.set("accept", accept);

      if (accept === "text/event-stream") {
        headers.set("content-type", "application/json");
      }

      headers.set("User-Agent", buildCodexUserAgent());
      return headers;
    },

    resolveEndpoint(path) {
      return resolveCodexEndpoint(path);
    },

    resolveSearchEndpoint() {
      return resolveCodexSearchEndpoint();
    },
  };
}

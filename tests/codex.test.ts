import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractAccountIdFromToken,
  fetchCodexModels,
  normalizeCodexBaseUrl,
  resolveCodexEndpoint,
  selectDefaultModel,
} from "../src/codex.ts";

describe("codex helpers", () => {
  it("normalizes codex base URLs", () => {
    assert.equal(normalizeCodexBaseUrl(undefined), "https://chatgpt.com/backend-api");
    assert.equal(
      normalizeCodexBaseUrl("https://chatgpt.com/backend-api/codex"),
      "https://chatgpt.com/backend-api",
    );
    assert.equal(
      normalizeCodexBaseUrl("https://chatgpt.com/backend-api/codex/responses"),
      "https://chatgpt.com/backend-api",
    );
  });

  it("resolves codex endpoints", () => {
    assert.equal(
      resolveCodexEndpoint("https://chatgpt.com/backend-api/codex", "responses"),
      "https://chatgpt.com/backend-api/codex/responses",
    );
    assert.equal(
      resolveCodexEndpoint("https://example.test/root", "models"),
      "https://example.test/root/codex/models",
    );
  });

  it("extracts account id from an access token JWT", () => {
    const payload = Buffer.from(
      JSON.stringify({
        "https://api.openai.com/auth": {
          chatgpt_account_id: "acct_123",
        },
      }),
    ).toString("base64url");
    const token = `header.${payload}.signature`;

    assert.equal(extractAccountIdFromToken(token), "acct_123");
    assert.equal(extractAccountIdFromToken("not-a-jwt"), undefined);
  });

  it("selects default model first", () => {
    assert.equal(selectDefaultModel([{ id: "gpt-a" }, { id: "gpt-b", isDefault: true }]), "gpt-b");
    assert.equal(selectDefaultModel([{ id: "gpt-a" }]), "gpt-a");
    assert.equal(selectDefaultModel([]), undefined);
  });

  it("passes client_version to the models endpoint", async () => {
    let requestedUrl = "";
    const fetchImpl = async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          models: [{ slug: "gpt-default", is_default: true }],
        }),
      );
    };

    const models = await fetchCodexModels({
      token: "token",
      accountId: "account",
      baseUrl: "https://example.test/backend",
      clientVersion: "9.9.9",
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(models[0]?.id, "gpt-default");
    assert.equal(new URL(requestedUrl).searchParams.get("client_version"), "9.9.9");
  });
});

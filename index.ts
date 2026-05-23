import { StringEnum, Type } from "@earendil-works/pi-ai";
import {
  defineTool,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  extractAccountIdFromToken,
  fetchCodexModels,
  fetchCodexWebSearch,
  selectDefaultModel,
  type SearchContextSize,
} from "./src/codex.ts";

const OPENAI_CODEX_PROVIDER = "openai-codex";
const DEFAULT_CONTEXT_SIZE = "medium";

const webSearchTool = defineTool({
  name: "web_search",
  label: "Web Search",
  description:
    "Search the web using the user's configured ChatGPT Codex subscription and return an answer with sources.",
  promptSnippet: "web_search: search the web using the configured ChatGPT Codex subscription.",
  promptGuidelines: [
    "Use web_search when current or source-backed information is needed.",
    "Do not ask the user for an access token; the tool uses pi's configured OpenAI Codex subscription.",
  ],
  parameters: Type.Object({
    query: Type.String({ description: "The web search question to answer." }),
    search_context_size: Type.Optional(
      StringEnum(["low", "medium", "high"] as const, {
        description: "Amount of web context to retrieve. Defaults to medium.",
      }),
    ),
    live: Type.Optional(Type.Boolean({ description: "Use live web access. Defaults to true." })),
  }),

  async execute(_toolCallId, params, signal, onUpdate, ctx) {
    const query = params.query.trim();
    if (!query) {
      throw new Error("query must not be empty");
    }

    const token = await ctx.modelRegistry.getApiKeyForProvider(OPENAI_CODEX_PROVIDER);
    if (!token) {
      throw new Error(
        "OpenAI Codex subscription is not configured. Run /login and choose ChatGPT Plus/Pro.",
      );
    }

    const accountId = getConfiguredAccountId(ctx, token);
    if (!accountId) {
      throw new Error(
        "OpenAI Codex account id was not found in stored credentials or access token.",
      );
    }

    const baseUrl = process.env.PI_CODEX_WEB_SEARCH_BASE_URL;
    const model = await resolveSearchModel(ctx, token, accountId, baseUrl, signal);
    let streamedText = "";

    const result = await fetchCodexWebSearch({
      query,
      token,
      accountId,
      model,
      baseUrl,
      externalWebAccess: resolveLive(params.live),
      searchContextSize: resolveSearchContextSize(params.search_context_size),
      signal,
      onTextDelta: (delta) => {
        streamedText += delta;
        onUpdate?.({
          content: [{ type: "text", text: streamedText }],
          details: { model, partial: true },
        });
      },
    });

    return {
      content: [{ type: "text", text: formatToolText(result.text, result.citations) }],
      details: {
        model: result.model,
        responseId: result.responseId,
        searchCalls: result.searchCalls,
        citations: result.citations,
        usage: result.usage,
      },
    };
  },
});

export default function codexWebSearchExtension(pi: ExtensionAPI) {
  let registered = false;

  pi.on("session_start", async (_event, ctx) => {
    if (registered) return;

    const token = await ctx.modelRegistry.getApiKeyForProvider(OPENAI_CODEX_PROVIDER);
    if (!token || !getConfiguredAccountId(ctx, token)) {
      return;
    }

    pi.registerTool(webSearchTool);
    registered = true;
  });
}

function getConfiguredAccountId(ctx: ExtensionContext, token: string): string | undefined {
  const credential = ctx.modelRegistry.authStorage.get(OPENAI_CODEX_PROVIDER);
  if (credential?.type === "oauth" && typeof credential.accountId === "string") {
    return credential.accountId;
  }
  return extractAccountIdFromToken(token);
}

async function resolveSearchModel(
  ctx: ExtensionContext,
  token: string,
  accountId: string,
  baseUrl: string | undefined,
  signal: AbortSignal | undefined,
): Promise<string> {
  const override = process.env.PI_CODEX_WEB_SEARCH_MODEL?.trim();
  if (override) return override;
  if (ctx.model?.provider === OPENAI_CODEX_PROVIDER) return ctx.model.id;

  const models = await fetchCodexModels({
    token,
    accountId,
    baseUrl,
    clientVersion: process.env.PI_CODEX_WEB_SEARCH_CLIENT_VERSION,
    signal,
  });
  const model = selectDefaultModel(models);
  if (!model) {
    throw new Error("Codex model list is empty.");
  }
  return model;
}

function resolveSearchContextSize(value: string | undefined): SearchContextSize {
  const configured = value ?? process.env.PI_CODEX_WEB_SEARCH_CONTEXT_SIZE ?? DEFAULT_CONTEXT_SIZE;
  if (configured === "low" || configured === "medium" || configured === "high") {
    return configured;
  }
  throw new Error(`Invalid search_context_size: ${configured}`);
}

function resolveLive(value: boolean | undefined): boolean {
  if (value !== undefined) return value;
  return process.env.PI_CODEX_WEB_SEARCH_LIVE !== "false";
}

function formatToolText(text: string, citations: Array<{ title?: string; url: string }>): string {
  if (citations.length === 0) return text || "(no response text)";

  const sourceLines = citations.map((citation, index) => {
    const title = citation.title?.trim() || citation.url;
    return `${index + 1}. ${title}: ${citation.url}`;
  });
  return `${text || "(no response text)"}\n\nSources:\n${sourceLines.join("\n")}`;
}

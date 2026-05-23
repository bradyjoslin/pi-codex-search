# pi-codex-search

[![npm](https://img.shields.io/npm/v/pi-codex-search)](https://www.npmjs.com/package/pi-codex-search)
[![license](https://img.shields.io/npm/l/pi-codex-search)](./LICENSE)

Pi extension that adds a `web_search` tool backed by the ChatGPT Codex backend.

It reuses the `openai-codex` subscription already configured in pi-coding-agent. The extension does not read `ACCESS_TOKEN` during normal pi usage and does not start a separate login flow.

## Install

Local checkout:

```bash
pi -e /path/to/pi-codex-search
```

After publishing, the package can be installed through pi's npm package path:

```bash
pi install npm:pi-codex-search
```

The package manifest exposes the extension through:

```json
{
  "pi": {
    "extensions": ["./index.ts"]
  }
}
```

## Authentication

Inside `pi`, run:

```text
/login openai-codex
```

Choose `ChatGPT Plus/Pro (Codex Subscription)` if pi prompts for a provider. Credentials are stored in pi's auth file and refreshed by pi.

At `session_start`, this extension calls `ctx.modelRegistry.getApiKeyForProvider("openai-codex")`. If no token is available, or if the account id cannot be found from the stored OAuth credential or decoded access token, it does not register `web_search`. In that case the model will not see the tool.

## Usage

When Codex auth is available at session start, the extension registers:

```json
{
  "name": "web_search",
  "arguments": {
    "query": "latest OpenAI Codex release notes",
    "search_context_size": "medium",
    "live": true
  }
}
```

Parameters:

- `query`: required search question.
- `search_context_size`: optional, one of `low`, `medium`, `high`.
- `live`: optional boolean. Defaults to live web access.

Model selection:

- If `PI_CODEX_WEB_SEARCH_MODEL` is set, that model id is used.
- Otherwise, if the active pi model provider is `openai-codex`, the active model id is used.
- Otherwise, the extension fetches `/codex/models?client_version=...` and uses the default model from that response.

The tool returns text content. Its structured `details` include:

- `model`
- `responseId`
- `searchCalls`
- `citations`
- `usage`

## Configuration

- `PI_CODEX_WEB_SEARCH_MODEL`: override the Codex model used by the tool.
- `PI_CODEX_WEB_SEARCH_BASE_URL`: override the Codex backend base URL.
- `PI_CODEX_WEB_SEARCH_CLIENT_VERSION`: override the `client_version` sent to `/codex/models`.
- `PI_CODEX_WEB_SEARCH_CONTEXT_SIZE`: default search context size: `low`, `medium`, or `high`.
- `PI_CODEX_WEB_SEARCH_LIVE`: set to `false` to use cached web access.

The request headers are built by the extension. They include `Authorization`, `chatgpt-account-id`, `originator: pi`, `OpenAI-Beta: responses=experimental`, `accept`, and `content-type` for streaming response requests.

## Development

```bash
npm install
npm run check
npm test
npm run lint
npm run format:check
```

## Release

This repository follows the same release shape as `pi-provider-kimi-code`:

- `release-naming.env` defines `PKG_NAME=pi-codex-search` and `TAG_PREFIX=v`.
- `scripts/next-version.sh` computes the next semantic version from tags.
- `.github/workflows/release-command.yml` creates release commits and tags.
- `.github/workflows/release-on-tag.yml` publishes to npm with provenance and attaches `pi-codex-search.tar.gz` to the GitHub release.

GitHub release tarball installs from the extracted directory:

```bash
curl -L https://github.com/Leechael/pi-codex-search/releases/latest/download/pi-codex-search.tar.gz | tar -xz -C /tmp
pi install /tmp/pi-codex-search
```

## References

- Upstream harness: [earendil-works/pi](https://github.com/earendil-works/pi) · [pi-coding-agent](https://github.com/earendil-works/pi/tree/main/packages/coding-agent)

## License

MIT

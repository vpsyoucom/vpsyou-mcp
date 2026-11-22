# MCP connection

Verified connection record for the hosted VPSYOU MCP server. The repository overview, client commands, and agent skill are in the [README](../README.md). This repository does not contain the VPSYOU server implementation.

The server address is:

```text
https://vpsyou.com/mcp
```

Official connection guides:

- English: <https://vpsyou.com/mcp-integration>
- 简体中文: <https://vpsyou.com/zh/mcp-integration>
- 繁體中文: <https://vpsyou.com/zh-TW/mcp-integration>

The English and Simplified Chinese guides were compared on 2026-11-21. They publish the same endpoint, transport, OAuth flow, client commands, `cn2:read` scope, and `get_cn2_latency` windows.

## Connection

| Field | Value |
| --- | --- |
| Endpoint | `https://vpsyou.com/mcp` |
| Transport | Streamable HTTP |
| Authorization | OAuth |
| Scope to approve | `cn2:read` (read-only) |
| MCP Registry name | `com.vpsyou/mcp` |
| Registry title | VPSYOU CN2 Latency |
| Registry remote | `streamable-http` at `https://vpsyou.com/mcp` |

The registry entry is active and lists version `1.0.0`. Its website is the English guide above. The entry has a remote URL and does not publish a package or install command. Registry record retrieved on 2026-11-21:

<https://registry.modelcontextprotocol.io/v0/servers?search=com.vpsyou/mcp>

There is no local copy of the MCP server to install, and no API key to paste into a client. The clients documented by VPSYOU sign in with OAuth and request approval for `cn2:read`. The command-line client in this repository is a separate from-source program that talks to the hosted endpoint. Its commands are in the [README](../README.md#command-line-client).

## Authorization

Protected resource metadata for `https://vpsyou.com/mcp`:

- <https://vpsyou.com/.well-known/oauth-protected-resource>
- <https://vpsyou.com/.well-known/oauth-protected-resource/mcp>

Both URLs returned the same document on 2026-11-21. It names the resource `https://vpsyou.com/mcp`, the authorization server `https://vpsyou.com/api/auth`, bearer tokens in the `Authorization` header, and the scope `cn2:read`. It also lists supported DPoP signing algorithms. It does not mark DPoP as required.

Authorization server metadata:

- <https://vpsyou.com/.well-known/oauth-authorization-server/api/auth>
- <https://vpsyou.com/api/auth/.well-known/oauth-authorization-server>

On 2026-11-21 that document published:

- Issuer: `https://vpsyou.com/api/auth`
- Authorization endpoint: `https://vpsyou.com/api/auth/oauth2/authorize`
- Token endpoint: `https://vpsyou.com/api/auth/oauth2/token`
- Registration endpoint: `https://vpsyou.com/api/auth/oauth2/register`
- Response type: `code`
- Grant types: `authorization_code`, `refresh_token`
- PKCE method: `S256`
- Scopes: `cn2:read`, `offline_access`
- Token endpoint authentication methods include `none` (public clients), along with confidential-client methods

The registration endpoint is the published dynamic client registration endpoint. The integration guide does not ask you to create a client ID or client secret yourself. Leave a client ID blank unless a later VPSYOU document tells you to supply one. Approve read-only `cn2:read` when the consent screen appears. The protected-resource metadata and the `WWW-Authenticate` challenge both advertise `cn2:read`. The authorization server additionally lists `offline_access`.

Use the live metadata URLs above for the full field list, including signing algorithms. Those lists can change.

## What the server can read

The documented tool is `get_cn2_latency`.

The integration page describes the Guangdong probe. It uses ICMP to measure round-trip latency and packet loss at listed test endpoints. History is aggregated by hour. Compare readings with the measurement time and the probe location. CN2 readings reflect that probe’s path to each test endpoint. The site footer says prices and metrics on vpsyou.com are dated snapshots, not live quotes.

The tool description published by the server on 2026-11-21 says it returns CN2 test-endpoint latency and packet loss measured from Guangdong, uses the latest sample by default, and can return a historical window or one target’s time series. Null measurements mean no observed data. The server instructions published with the tool describe timestamps as Unix milliseconds, round-trip time as milliseconds, and packet loss as a ratio from 0 to 1. This guide does not include sample tool results.

Arguments in the published input schema:

| Argument | Required | Values |
| --- | --- | --- |
| `window` | No. Default `live` | `live`, `24h`, `7d` |
| `targetId` | No | One target ID from the server’s current enum. The schema says that setting it requests that target’s time series. |

The published schema sets `additionalProperties` to false. If the server’s tool definition changes, use the definition the server returns.

### Request examples from the integration page

These are the requests shown on <https://vpsyou.com/mcp-integration>. They are not recorded responses.

Live readings, with this message for the client: “Show the latest CN2 latency and packet loss from Guangdong.”

```json
{
  "name": "get_cn2_latency",
  "arguments": {
    "window": "live"
  }
}
```

Last 24 hours. The page’s example asks for hourly CN2 latency and packet loss for DMIT Hong Kong and includes `targetId` `dmit-hkg`: “Show the hourly CN2 latency and packet loss for DMIT Hong Kong over the last 24 hours.”

```json
{
  "name": "get_cn2_latency",
  "arguments": {
    "window": "24h",
    "targetId": "dmit-hkg"
  }
}
```

Last 7 days. The page’s example asks for the DMIT Hong Kong trend and uses the same target: “Show the CN2 latency and packet loss trend for DMIT Hong Kong over the last seven days.”

```json
{
  "name": "get_cn2_latency",
  "arguments": {
    "window": "7d",
    "targetId": "dmit-hkg"
  }
}
```

`targetId` remains optional in the schema for every window. The page adds `dmit-hkg` on the 24-hour and 7-day examples.

### Target IDs advertised on 2026-11-21

`dmit-hkg` is the only target the integration page names (DMIT Hong Kong). The tool schema on that date also enumerated:

`hostdare-lax`, `bandwagonhost-dc6`, `dmit-tyo`, `dmit-hkg`, `dmit-lax`, `gigsgigscloud-tyo`, `greencloudvps-sin`, `vps-tyo`, `nosla-fra`, `nosla-hkg`, `nosla-sjc`, `akkocloud-sjc`, `akkocloud-fra`, `akkocloud-lon`, `hostkvm-hkg`, `imidc-lax`, `imidc-hkg`, `imidc-mow`, `dedione-lax`, `serverhk-hkg`, `axion-tyo`, `axion-icn`, `axion-kul`, `axion-sea`, `axion-lax`, `axion-sjc`, `axion-fra`

Treat that list as a snapshot. The connected server’s current tool definition is the list to use.

## Limits

- The service reads CN2 latency and packet loss from the single VPSYOU probe in Guangdong.
- It is a measurement query for the listed test endpoints. It does not provision, resize, reboot, or otherwise manage VPS instances.
- It is not a global monitoring network. A reading is the Guangdong probe’s path to a test endpoint at the reported measurement time.
- Historical series on the integration page are hourly aggregates.
- The only documented tool is `get_cn2_latency`, and the consent scope for that tool is read-only `cn2:read`.
- VPSYOU’s integration page documents Claude, Codex, and Grok Bot. This repository also includes a Gemini CLI extension manifest. It does not claim model compatibility.

## Connect a documented client

VPSYOU’s integration page documents the three clients below. The commands are connection commands for an already installed client. They are not an installer for this repository or for the MCP server.

Custom connectors depend on your plan and workspace settings.

### Claude Code

```shell
claude mcp add --transport http --scope user vpsyou-cn2 https://vpsyou.com/mcp
```

Run that command in a terminal. In Claude Code, open `/mcp`, select `vpsyou-cn2`, and choose Authenticate. Sign in to VPSYOU and approve `cn2:read`.

### Claude web and desktop

VPSYOU links to Anthropic’s custom-connector guide for Claude on the web and desktop:

<https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp>

Add a custom connector whose remote MCP URL is exactly `https://vpsyou.com/mcp`, then sign in to VPSYOU and approve `cn2:read`. Anthropic’s guide describes the current screens and the plan and admin rules. As of 2026-11-21, that guide says to choose your own OAuth client only when the server’s documentation requires a client you register yourself. This server’s documentation does not require that. Its metadata publishes dynamic client registration.

That same Anthropic guide describes `claude_desktop_config.json` as the configuration for local MCP servers. Do not use that file to point Claude at this hosted endpoint.

### Codex

```shell
codex mcp add vpsyou-cn2 --url https://vpsyou.com/mcp
```

Run the add command. If no authorization page opens, run:

```shell
codex mcp login vpsyou-cn2
```

Authorize VPSYOU in the browser and approve `cn2:read`. Codex’s own MCP guide is <https://developers.openai.com/codex/mcp>. As of 2026-11-21 it also documents `codex mcp login --no-browser` when the terminal has no local browser: open the printed URL, then paste the full redirect URL back into the terminal.

Codex documents this Streamable HTTP configuration, which is the form written by the add command above. OAuth is Codex’s default for that URL. Do not add a bearer token or an `--oauth-client-id` for VPSYOU.

```toml
[mcp_servers.vpsyou-cn2]
url = "https://vpsyou.com/mcp"
```

Codex’s desktop app and IDE extension can add the same Streamable HTTP URL and then Authenticate. The Codex guide says the ChatGPT website does not read this local config file.

### Grok Bot

Send this message, then follow the sign-in prompt and approve `cn2:read`:

```text
Add the remote MCP server https://vpsyou.com/mcp as VPSYOU CN2 with OAuth. After I authorize it, use it to check the latest CN2 latency and packet loss from Guangdong.
```

To add it manually, VPSYOU links to <https://docs.x.ai/grok-bot/computer-and-apps#connect-an-app>. As of 2026-11-21 that guide says to choose **Add a custom connector** at the bottom of **Connect apps**, enter the name `VPSYOU CN2`, choose remote HTTPS, and set the server URL to `https://vpsyou.com/mcp`. The OAuth client ID field is optional there. Leave it empty for this server. Save with **Add plugin**, then finish Authorize or Authenticate in the browser. A team MCP policy can block saving the connector.

### Gemini CLI

The root file `gemini-extension.json` is a Gemini CLI extension named `vpsyou-mcp` at version `0.1.1`. Its MCP server entry is `vpsyou-cn2`. The transport field is `httpUrl`, which Gemini documents as Streamable HTTP, set to `https://vpsyou.com/mcp`. It is not the SSE `url` field, and it does not set `command` or `args`. The npm package `vpsyou-cn2` remains a separate command-line client.

OAuth is enabled with scope `cn2:read`. The manifest does not set `issuer`, `clientId`, `authorizationUrl`, or `tokenUrl`. Gemini’s MCP documentation says those values are discovered from the server, and dynamic client registration is used when the server supports it. VPSYOU publishes that registration endpoint.

Install Gemini CLI, then run:

```shell
gemini extensions install https://github.com/vpsyoucom/vpsyou-mcp
```

In Gemini CLI, run `/mcp auth vpsyou-cn2` and approve read-only `cn2:read`. Sign-in needs a local browser. This repository has not run that command against a signed-in account.

Gemini’s extension gallery is a separate daily index of public repositories. Installing from the URL above does not depend on that gallery. Sources: <https://geminicli.com/docs/extensions/reference/> and <https://geminicli.com/docs/tools/mcp-server/>.

## OAuth and HTTP 401

Before OAuth is complete, a call without an `Authorization` header receives HTTP 401 and a `WWW-Authenticate` challenge. That challenge tells the client to sign in. It does not, by itself, mean `https://vpsyou.com/mcp` is down.

On 2026-11-21, a JSON-RPC request to `https://vpsyou.com/mcp` without an `Authorization` header returned HTTP 401 with:

```text
WWW-Authenticate: Bearer resource_metadata="https://vpsyou.com/.well-known/oauth-protected-resource/mcp", scope="cn2:read"
```

The body was a JSON-RPC error, code `-32000`, message `missing authorization header`. A client that supports MCP OAuth should read that header, discover the metadata above, and open VPSYOU sign-in.

When that happens:

1. Finish the client’s Authenticate or login step. For Claude Code, that is `/mcp`, then `vpsyou-cn2`, then Authenticate. For Codex, run `codex mcp login vpsyou-cn2` if the browser did not open.
2. Sign in to VPSYOU and approve read-only `cn2:read`.
3. Return to the client after the browser step finishes. In Grok Bot, the linked guide says to use Reconnect or Reopen if the sign-in page disappears, and to finish within about 10 minutes.
4. If the client has no custom-connector control, or an administrator policy blocks it, the limitation is the client plan or workspace. VPSYOU states that custom connectors depend on plan and workspace settings.

Sign in again from the client if a later request still returns 401 after you thought approval had finished. Do not paste an access token, client secret, or password into a config file or chat. This setup does not use a manually issued API key.

## From-source client

`vpsyou-cn2` calls `get_cn2_latency` on the fixed endpoint. Install the published npm package with `npm install -g vpsyou-cn2`. This repository version is `0.1.1`. The commands are in the [README](../README.md#command-line-client).

`login` uses `@modelcontextprotocol/client` 2.4.0 for Streamable HTTP, protected-resource discovery, and OAuth with the authorization server's published registration endpoint. The browser step approves `cn2:read`. The SDK also sends `offline_access` when that scope is advertised and the client metadata includes the refresh-token grant. Tokens are written to a user-only file (`0600` on Unix) under `$XDG_CONFIG_HOME/vpsyou-cn2` or `~/.config/vpsyou-cn2`. `VPSYOU_CN2_CONFIG_DIR` changes that directory only. The command does not print the file, and there is no flag to point the client at another MCP host.

`targets` and `query` read the current `get_cn2_latency` input schema after sign-in. `--window` accepts the schema's enum (`live`, `24h`, and `7d` in the schema checked on 2026-11-21). `--target` must be one of the schema's `targetId` values when that enum is present. Omit `--target` to omit `targetId`, which the schema allows. `--json` prints the tool payload, the endpoint, and `retrievedAt` (when the command received the response, not the probe time). Human output includes the same payload and the server's unit notes: Unix milliseconds, round-trip time in milliseconds, packet loss as a ratio from 0 to 1, and null for no observed data.

The tests mock the MCP session and do not sign in or call the live tool. The interactive browser login is implemented and was not run against a user account. The agent skill is described in the [README](../README.md#agent-skill).

## Sources checked on 2026-11-21

- <https://vpsyou.com/mcp-integration> and <https://vpsyou.com/zh/mcp-integration>, including the client commands, scope note, measurement description, and the live / 24-hour / 7-day request examples in the page
- Protected resource metadata and authorization server metadata at the URLs in [Authorization](#authorization)
- One unauthenticated request to `https://vpsyou.com/mcp`, used only to record the OAuth `401` challenge
- MCP Registry search for `com.vpsyou/mcp`
- The server’s published `get_cn2_latency` input schema and server instructions, read without calling the tool
- The Claude, Codex, and Grok Bot guides linked from the VPSYOU integration page, for the client screens those products currently document
- MCP TypeScript client 2.4.0 Streamable HTTP transport and OAuth client, including dynamic client registration when the authorization server publishes `registration_endpoint`: <https://ts.sdk.modelcontextprotocol.io/v2/clients/oauth>

No tool call was made, so this guide has no measured latency or packet-loss sample. No directory listing was submitted.

# VPSYOU MCP

Read CN2 latency and packet loss from the VPSYOU probe in Guangdong. This repository contains the connection guide and a from-source read-only client for the hosted MCP server. It does not contain the VPSYOU server implementation.

| Field | Value |
| --- | --- |
| Endpoint | `https://vpsyou.com/mcp` |
| Transport | Streamable HTTP |
| Authorization | OAuth. Approve read-only `cn2:read`. |
| Tool | `get_cn2_latency` (`live`, `24h`, `7d`) |
| Registry | `com.vpsyou/mcp` |

The service measures ICMP from that one probe to listed test endpoints. It does not provision or manage VPS instances, and it is not a global monitoring network.

Official product guides:

- English: <https://vpsyou.com/mcp-integration>
- 简体中文: <https://vpsyou.com/zh/mcp-integration>
- 繁體中文: <https://vpsyou.com/zh-TW/mcp-integration>

The checked connection record is [docs/mcp.md](docs/mcp.md): [OAuth metadata](docs/mcp.md#authorization), [request examples](docs/mcp.md#request-examples-from-the-integration-page), [target ids](docs/mcp.md#target-ids-advertised-on-2026-11-21), [Claude, Codex, and Grok Bot setup](docs/mcp.md#connect-a-documented-client), and [HTTP 401 troubleshooting](docs/mcp.md#oauth-and-http-401).

## Command-line client

`vpsyou-cn2` calls `get_cn2_latency` on the endpoint above. The npm package name is `vpsyou-cn2`. This repository version is `0.1.1`.

```shell
npm install -g vpsyou-cn2
vpsyou-cn2 --help
vpsyou-cn2 login
vpsyou-cn2 targets
vpsyou-cn2 query --window live --json
vpsyou-cn2 logout
```

From a checkout of this repository, the same arguments run as `node dist/src/cli.js`:

```shell
npm install
npm run build
node dist/src/cli.js --help
```

`login` stores the sign-in in a user-only file and does not print it. `targets` lists the server's current windows and target ids. `query` defaults to `live`. Omit `--target` to omit `targetId`. Sign-in storage, scopes, and how to read the result are in [From-source client](docs/mcp.md#from-source-client).

## Agent skill

`skills/vpsyou-cn2-latency` version `0.1.1` is the ClawHub skill package. Its [LICENSE](skills/vpsyou-cn2-latency/LICENSE) is MIT-0 and applies only to that directory. Install the client with `npm install -g vpsyou-cn2`, then follow `SKILL.md`.

## What is in this repository

- [docs/mcp.md](docs/mcp.md) is the connection record.
- `src/` is the from-source client. `skills/vpsyou-cn2-latency/SKILL.md` is the agent skill.
- The MCP server runs at the hosted endpoint and is not published here.

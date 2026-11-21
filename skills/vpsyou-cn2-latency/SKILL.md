---
name: vpsyou-cn2-latency
description: Use when someone asks for VPSYOU CN2 latency or packet loss from the Guangdong probe, including the latest sample or a 24-hour or 7-day history for a listed test endpoint. Do not use for VPS provisioning, plan prices, or a global monitoring network.
version: "0.1.1"
metadata:
  openclaw:
    requires:
      bins:
        - node
        - vpsyou-cn2
    install:
      - kind: node
        package: vpsyou-cn2
        bins:
          - vpsyou-cn2
    homepage: https://vpsyou.com
---

# VPSYOU CN2 latency

Read latency and packet loss from the hosted VPSYOU MCP server at `https://vpsyou.com/mcp`. The only tool is `get_cn2_latency`. Measurements come from one ICMP probe in Guangdong. This is not VPS management and not a global monitoring network.

Use the published `vpsyou-cn2` command. It is read-only. Do not call an undocumented HTTP API.

This skill version is `0.1.1`, the same version as the published npm package `vpsyou-cn2@0.1.1`. That package requires Node.js 20 or newer. These instructions were checked against that package's command interface and <https://vpsyou.com/mcp-integration>. They were not verified by a signed-in call to the live tool.

The longer connection record is <https://github.com/vpsyoucom/vpsyou-mcp/blob/main/docs/mcp.md>. The files in this directory are the skill. Their license is [LICENSE](LICENSE) (MIT-0) and applies only to this directory.

## Install

```sh
npm install -g vpsyou-cn2
vpsyou-cn2 --help
```

`node` and `vpsyou-cn2` must both be on `PATH`. Node.js must be version 20 or newer.

## Choose the query

- Omit `--window` or pass `--window live` for the latest sample.
- Pass `--window 24h` for the last 24 hours.
- Pass `--window 7d` for the last 7 days.
- Omit `--target` to omit `targetId`. The published schema allows that.
- To select one endpoint, pass `--target` with an id from the server's current schema. The integration page's 24-hour and 7-day examples use `dmit-hkg` (DMIT Hong Kong). Run `targets` before using any other id.

```sh
vpsyou-cn2 targets
vpsyou-cn2 query
vpsyou-cn2 query --window 24h --target dmit-hkg
vpsyou-cn2 query --window 7d --target dmit-hkg --json
vpsyou-cn2 query --json
```

Run one query for the request. Do not schedule repeated queries or start a monitor.

## Sign in

Sign-in is OAuth on the user's own computer. The command stores the result in a user-only file and does not print it. If the command exits with code 3, or it says no local sign-in is stored:

1. Ask the user to run this in their own terminal:

```sh
vpsyou-cn2 login
```

2. The user approves read-only `cn2:read` in the browser. The client may also request `offline_access` when the authorization server advertises it, because the client uses refresh tokens.
3. Do not run `login` yourself. Do not ask for, copy, or repeat an access token, refresh token, client secret, authorization code, callback URL, or the credential file.
4. After the user says the browser step finished, run the same query again.

`status` only reports whether that file exists. It does not check the sign-in with the server. `logout` deletes the file:

```sh
vpsyou-cn2 status
vpsyou-cn2 logout
```

`VPSYOU_CN2_CONFIG_DIR` may point at another private directory for that file. It does not change the MCP endpoint. The skill does not require that variable.

## Read the result

Prefer `--json` when you need to quote values.

- `endpoint` is the source: `https://vpsyou.com/mcp`.
- `retrievedAt` is when the command received the response. It is not the probe measurement time.
- `result` is the tool payload. `structuredContent` is used when the server sends it. Do not rename its fields.
- Report a number only when it is present in `result`. If a value is null, say the server reported no observed data. Do not fill in latency or loss from anywhere else.
- The server describes timestamps as Unix milliseconds, round-trip time as milliseconds, and packet loss as a ratio from 0 to 1. Say which field you used.
- Say the reading is the Guangdong probe's path to the test endpoint at the measurement time in the result, when that time is present.
- If the command reports a tool error, say the call failed and quote the error payload. Do not turn that payload into a latency.

## Sources

The endpoint, OAuth scope, tool name, and windows are published at <https://vpsyou.com/mcp-integration>. Target ids come from the signed-in server's `get_cn2_latency` input schema at the time of the command. Units and the single-probe limit are the server instructions and that page, checked for this client on 2026-11-21.

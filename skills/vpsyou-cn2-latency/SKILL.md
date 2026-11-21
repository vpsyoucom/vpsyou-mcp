---
name: vpsyou-cn2-latency
description: Use when someone asks for VPSYOU CN2 latency or packet loss from the Guangdong probe, including the latest sample or a 24-hour or 7-day history for a listed test endpoint. Do not use for VPS provisioning, plan prices, or a global monitoring network.
---

# VPSYOU CN2 latency

Read latency and packet loss from the hosted VPSYOU MCP server at `https://vpsyou.com/mcp`. The only tool is `get_cn2_latency`. Measurements come from one ICMP probe in Guangdong. This is not VPS management and not a global monitoring network.

Use the `vpsyou-cn2` command. Do not call an undocumented HTTP API.

## Install

Install the published npm package:

```sh
npm install -g vpsyou-cn2
vpsyou-cn2 --help
```

The arguments below are the same after that install: replace `node dist/src/cli.js` with `vpsyou-cn2`. From a checkout of this repository:

```sh
npm install
npm run build
node dist/src/cli.js --help
```

Copy the `skills/vpsyou-cn2-latency` directory into the skills folder your agent host loads. This skill is not a marketplace listing.

## Choose the query

- Omit `--window` or pass `--window live` for the latest sample.
- Pass `--window 24h` for the last 24 hours.
- Pass `--window 7d` for the last 7 days.
- Omit `--target` to omit `targetId`. The published schema allows that.
- To select one endpoint, pass `--target` with an id from the server's current schema. The integration page's 24-hour and 7-day examples use `dmit-hkg` (DMIT Hong Kong). Run `targets` before using any other id.

```sh
node dist/src/cli.js targets
node dist/src/cli.js query
node dist/src/cli.js query --window 24h --target dmit-hkg
node dist/src/cli.js query --window 7d --target dmit-hkg --json
node dist/src/cli.js query --json
```

Run one query for the request. Do not schedule repeated queries or start a monitor.

## Sign in

If the command exits with code 3, or it says no local sign-in is stored:

1. Ask the user to run this in their own terminal, from the checkout:

```sh
node dist/src/cli.js login
```

2. The user approves read-only `cn2:read` in the browser. The client may also request `offline_access` when the authorization server advertises it, because the client uses refresh tokens.
3. Do not run `login` yourself. Do not ask for, copy, or repeat an access token, refresh token, client secret, authorization code, callback URL, or the credential file. The sign-in stays in the user's private config file.
4. After the user says the browser step finished, run the same query again.

`status` only reports whether that file exists. It does not check the sign-in with the server. `logout` deletes the file:

```sh
node dist/src/cli.js status
node dist/src/cli.js logout
```

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

The endpoint, OAuth scope, tool name, and windows are the ones published at <https://vpsyou.com/mcp-integration>. Target ids come from the signed-in server's `get_cn2_latency` input schema at the time of the command. Units and the single-probe limit are the server instructions and the integration page, checked for this client on 2026-11-21. The same record is in [docs/mcp.md](../../docs/mcp.md).

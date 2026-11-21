/** Hosted Streamable HTTP endpoint published by VPSYOU. Not configurable. */
export const MCP_ENDPOINT = "https://vpsyou.com/mcp";

export const TOOL_NAME = "get_cn2_latency";

export const CLIENT_NAME = "vpsyou-cn2";

export const CLIENT_VERSION = "0.1.1";

/** Read-only scope from the protected-resource metadata and the integration guide. */
export const READ_SCOPE = "cn2:read";

export const CALLBACK_HOST = "127.0.0.1";

export const CALLBACK_PORT = 47623;

export const CALLBACK_PATH = "/callback";

export const CALLBACK_URL = `http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;

export const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

export const REQUEST_TIMEOUT_MS = 60_000;

export const DOCUMENTED_WINDOWS = ["live", "24h", "7d"] as const;

import {
  Client,
  IssuerMismatchError,
  StreamableHTTPClientTransport,
  UnauthorizedError,
} from "@modelcontextprotocol/client";

import { CLIENT_NAME, CLIENT_VERSION, MCP_ENDPOINT, REQUEST_TIMEOUT_MS } from "./constants.js";
import type { CredentialStore } from "./credentials.js";
import { CliError, errorText } from "./errors.js";
import { FileOAuthProvider } from "./oauth.js";
import type { ListedTool } from "./schema.js";

export interface ToolResult {
  content?: unknown;
  structuredContent?: unknown;
  isError?: boolean;
}

export interface Cn2Session {
  listTools(): Promise<{ tools: ListedTool[] }>;
  callTool(params: { name: string; arguments: Record<string, string> }): Promise<ToolResult>;
  close(): Promise<void>;
}

const SIGN_IN_AGAIN =
  "The MCP server asked for sign-in. Run `vpsyou-cn2 login` in your terminal and approve read-only cn2:read. Do not paste tokens, authorization codes, or callback URLs into chat.";

export async function openQuerySession(store: CredentialStore): Promise<Cn2Session> {
  if (!store.hasCredential()) {
    throw new CliError(
      "not_signed_in",
      "No local VPSYOU sign-in is stored. Run `vpsyou-cn2 login` in your terminal and approve read-only cn2:read. Do not paste tokens into chat.",
    );
  }
  const provider = new FileOAuthProvider(store, false, () => undefined);
  return connect(provider, AbortSignal.timeout(REQUEST_TIMEOUT_MS));
}

export async function connect(provider: FileOAuthProvider, signal?: AbortSignal): Promise<Cn2Session> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT), {
    authProvider: provider,
    requestInit: signal ? { signal } : undefined,
  });
  const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION });
  try {
    await client.connect(transport);
  } catch (error) {
    await transport.close().catch(() => undefined);
    throw toSessionError(error);
  }
  return {
    async listTools() {
      try {
        const listed = await client.listTools();
        return {
          tools: listed.tools.map((tool) => ({
            name: tool.name,
            description: typeof tool.description === "string" ? tool.description : undefined,
            inputSchema: tool.inputSchema,
          })),
        };
      } catch (error) {
        throw toSessionError(error);
      }
    },
    async callTool(params) {
      try {
        return await client.callTool(params);
      } catch (error) {
        throw toSessionError(error);
      }
    },
    async close() {
      await client.close();
    },
  };
}

export function toSessionError(error: unknown): CliError {
  if (error instanceof CliError) return error;
  if (UnauthorizedError.isInstance(error)) {
    return new CliError("auth_rejected", SIGN_IN_AGAIN);
  }
  if (error instanceof IssuerMismatchError) {
    return new CliError(
      "auth_rejected",
      "Sign-in failed because the authorization server did not match the server that started the flow. Run `vpsyou-cn2 login` again.",
    );
  }
  return new CliError("request_failed", errorText(error) || "The MCP request failed.");
}

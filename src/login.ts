import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";

import { Client, IssuerMismatchError, StreamableHTTPClientTransport, UnauthorizedError } from "@modelcontextprotocol/client";

import {
  CALLBACK_HOST,
  CALLBACK_PATH,
  CALLBACK_PORT,
  CLIENT_NAME,
  CLIENT_VERSION,
  LOGIN_TIMEOUT_MS,
  MCP_ENDPOINT,
} from "./constants.js";
import type { CredentialStore } from "./credentials.js";
import { CliError } from "./errors.js";
import { assertHttpsAuthorizationUrl, callbackStateMatches, FileOAuthProvider } from "./oauth.js";
import { toSessionError } from "./session.js";

export async function openBrowser(url: URL): Promise<boolean> {
  assertHttpsAuthorizationUrl(url);
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? undefined : "xdg-open";
  if (!command) return false;
  return new Promise((resolve) => {
    const child = spawn(command, [url.href], { stdio: "ignore", detached: true });
    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

export async function runLogin(store: CredentialStore, warn: (message: string) => void): Promise<void> {
  const callback = await listenForCallback(CALLBACK_PORT, () => store.oauthState());
  const provider = new FileOAuthProvider(store, true, (url) => {
    void openBrowser(url).then((opened) => {
      if (!opened) {
        warn("The browser did not open. Open this HTTPS authorization URL in your browser, then return here:");
        warn(url.href);
      } else {
        warn("Approve read-only cn2:read in the browser. This command keeps the sign-in on this computer.");
      }
    });
  });
  try {
    try {
      const existing = await connectForLogin(provider);
      await existing.close();
      return;
    } catch (error) {
      if (!UnauthorizedError.isInstance(error)) throw error;
    }
    const params = await callback.wait();
    if (!callbackStateMatches(store.oauthState(), params)) {
      throw new CliError(
        "callback_state",
        "Sign-in failed because the callback did not match this login. Run `vpsyou-cn2 login` again. Do not paste the callback URL into chat.",
      );
    }
    const transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT), { authProvider: provider });
    try {
      await transport.finishAuth(params);
    } catch (error) {
      if (error instanceof IssuerMismatchError) {
        throw new CliError(
          "auth_rejected",
          "Sign-in failed because the authorization server did not match the server that started the flow. Run `vpsyou-cn2 login` again.",
        );
      }
      throw new CliError(
        "auth_rejected",
        "Sign-in could not be completed. Run `vpsyou-cn2 login` again. Do not paste the callback URL into chat.",
      );
    } finally {
      await transport.close().catch(() => undefined);
    }
    const confirmed = await connectForLogin(provider);
    await confirmed.close();
  } finally {
    await callback.close();
  }
}

async function connectForLogin(provider: FileOAuthProvider): Promise<{ close(): Promise<void> }> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT), { authProvider: provider });
  const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION });
  try {
    await client.connect(transport);
  } catch (error) {
    await transport.close().catch(() => undefined);
    if (UnauthorizedError.isInstance(error)) throw error;
    throw toSessionError(error);
  }
  return {
    async close() {
      await client.close();
    },
  };
}

interface CallbackListener {
  port: number;
  wait(): Promise<URLSearchParams>;
  close(): Promise<void>;
}

export function listenForCallback(
  port = CALLBACK_PORT,
  expectedState?: () => string | undefined,
): Promise<CallbackListener> {
  return new Promise((resolve, reject) => {
    let settle: ((params: URLSearchParams) => void) | undefined;
    let fail: ((error: Error) => void) | undefined;
    const pending = new Promise<URLSearchParams>((resolveParams, rejectParams) => {
      settle = resolveParams;
      fail = rejectParams;
    });
    pending.catch(() => undefined);
    const server = createServer((request, response) => {
      handleCallbackRequest(request, response, port, settle, fail, expectedState);
    });
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(
          new CliError(
            "callback_port",
            `The login callback port ${CALLBACK_HOST}:${port} is already in use. Close the other vpsyou-cn2 login and try again.`,
          ),
        );
        return;
      }
      reject(error);
    });
    server.listen(port, CALLBACK_HOST, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address !== null ? address.port : port;
      resolve({
        port: actualPort,
        wait: () => withTimeout(pending, LOGIN_TIMEOUT_MS),
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

function handleCallbackRequest(
  request: IncomingMessage,
  response: ServerResponse,
  port: number,
  settle: ((params: URLSearchParams) => void) | undefined,
  fail: ((error: Error) => void) | undefined,
  expectedState?: () => string | undefined,
): void {
  const url = new URL(request.url ?? "/", `http://${CALLBACK_HOST}:${port}`);
  if (request.method !== "GET" || url.pathname !== CALLBACK_PATH) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Not found");
    return;
  }
  if (url.search.length > 4096 || (expectedState && !callbackStateMatches(expectedState(), url.searchParams))) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Sign-in could not be confirmed. Return to the terminal.");
    fail?.(
      new CliError(
        "callback_state",
        "Sign-in failed because the callback did not match this login. Run `vpsyou-cn2 login` again. Do not paste the callback URL into chat.",
      ),
    );
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(
    "<!doctype html><html><head><title>VPSYOU CN2</title></head><body><p>Sign-in received. You can close this window and return to the terminal.</p></body></html>",
  );
  settle?.(url.searchParams);
}

function withTimeout(pending: Promise<URLSearchParams>, timeoutMs: number): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new CliError(
          "callback_timeout",
          "Sign-in timed out after 10 minutes. Run `vpsyou-cn2 login` again. Do not paste a callback URL into chat.",
        ),
      );
    }, timeoutMs);
    pending.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { OAuthDiscoveryState, StoredOAuthClientInformation, StoredOAuthTokens } from "@modelcontextprotocol/client";

import { CliError } from "./errors.js";

interface CredentialFile {
  version: 1;
  clients: Record<string, StoredOAuthClientInformation>;
  tokens: Record<string, StoredOAuthTokens>;
  lastIssuer?: string;
  verifier?: string;
  oauthState?: string;
  discovery?: OAuthDiscoveryState;
}

function emptyFile(): CredentialFile {
  return { version: 1, clients: {}, tokens: {} };
}

export function credentialDirectory(): string {
  const override = process.env.VPSYOU_CN2_CONFIG_DIR;
  if (override && override.trim().length > 0) return override;
  const home = process.env.HOME || process.env.USERPROFILE || homedir();
  if (!home) {
    throw new CliError(
      "request_failed",
      "HOME is not set. Set VPSYOU_CN2_CONFIG_DIR to a private directory for the local sign-in file.",
    );
  }
  const base = process.env.XDG_CONFIG_HOME || join(home, ".config");
  return join(base, "vpsyou-cn2");
}

export class CredentialStore {
  readonly filePath: string;

  constructor(directory = credentialDirectory()) {
    this.filePath = join(directory, "credentials.json");
  }

  hasCredential(): boolean {
    if (!this.exists()) return false;
    const { tokens } = this.read();
    return Object.values(tokens).some((token) => hasSecret(token));
  }

  exists(): boolean {
    try {
      statSync(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  read(): CredentialFile {
    if (!this.exists()) return emptyFile();
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch {
      throw new CliError(
        "auth_rejected",
        "The local sign-in file could not be read. Run `vpsyou-cn2 logout`, then `vpsyou-cn2 login`.",
      );
    }
    if (!parsed || typeof parsed !== "object" || (parsed as { version?: unknown }).version !== 1) {
      throw new CliError(
        "auth_rejected",
        "The local sign-in file is not a version this client can read. Run `vpsyou-cn2 logout`, then `vpsyou-cn2 login`.",
      );
    }
    const file = parsed as Partial<CredentialFile>;
    return {
      version: 1,
      clients: file.clients ?? {},
      tokens: file.tokens ?? {},
      lastIssuer: file.lastIssuer,
      verifier: file.verifier,
      oauthState: file.oauthState,
      discovery: file.discovery,
    };
  }

  clientInformation(issuer?: string): StoredOAuthClientInformation | undefined {
    const file = this.read();
    const key = issuer ?? file.lastIssuer;
    if (!key) return undefined;
    return file.clients[key];
  }

  saveClientInformation(issuer: string, info: StoredOAuthClientInformation): void {
    const file = this.read();
    file.clients[issuer] = info;
    file.lastIssuer = issuer;
    this.write(file);
  }

  tokens(issuer?: string): StoredOAuthTokens | undefined {
    const file = this.read();
    if (issuer) return file.tokens[issuer];
    if (file.lastIssuer && file.tokens[file.lastIssuer]) return file.tokens[file.lastIssuer];
    const values = Object.values(file.tokens);
    return values.length === 1 ? values[0] : undefined;
  }

  saveTokens(issuer: string, tokens: StoredOAuthTokens): void {
    const file = this.read();
    file.tokens[issuer] = tokens;
    file.lastIssuer = issuer;
    this.write(file);
  }

  verifier(): string | undefined {
    return this.read().verifier;
  }

  saveVerifier(verifier: string): void {
    const file = this.read();
    file.verifier = verifier;
    this.write(file);
  }

  oauthState(): string | undefined {
    return this.read().oauthState;
  }

  saveOauthState(state: string): void {
    const file = this.read();
    file.oauthState = state;
    this.write(file);
  }

  discovery(): OAuthDiscoveryState | undefined {
    return this.read().discovery;
  }

  saveDiscovery(state: OAuthDiscoveryState): void {
    const file = this.read();
    file.discovery = state;
    this.write(file);
  }

  invalidate(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): void {
    if (!this.exists()) return;
    if (scope === "all") {
      this.remove();
      return;
    }
    const file = this.read();
    if (scope === "client") file.clients = {};
    if (scope === "tokens") file.tokens = {};
    if (scope === "verifier") delete file.verifier;
    if (scope === "discovery") delete file.discovery;
    this.write(file);
  }

  remove(): void {
    rmSync(this.filePath, { force: true });
  }

  private write(file: CredentialFile): void {
    const directory = dirname(this.filePath);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    const temporary = join(directory, `.credentials.${process.pid}.tmp`);
    const body = JSON.stringify(file);
    writeFileSync(temporary, body, { mode: 0o600 });
    chmodSync(temporary, 0o600);
    renameSync(temporary, this.filePath);
    chmodSync(this.filePath, 0o600);
  }
}

function hasSecret(token: StoredOAuthTokens | undefined): boolean {
  if (!token) return false;
  return (
    (typeof token.access_token === "string" && token.access_token.length > 0) ||
    (typeof token.refresh_token === "string" && token.refresh_token.length > 0)
  );
}

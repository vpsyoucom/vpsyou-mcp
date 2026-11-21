import { randomUUID } from "node:crypto";

import type {
  OAuthClientInformationContext,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from "@modelcontextprotocol/client";

import { CALLBACK_URL, CLIENT_NAME, READ_SCOPE } from "./constants.js";
import { CliError } from "./errors.js";
import type { CredentialStore } from "./credentials.js";

export function assertHttpsAuthorizationUrl(url: URL): void {
  if (url.protocol !== "https:") {
    throw new CliError("auth_rejected", "Refusing to open an authorization URL that is not HTTPS.");
  }
}

export function callbackStateMatches(expected: string | undefined, params: URLSearchParams): boolean {
  const received = params.get("state");
  return typeof expected === "string" && expected.length > 0 && received === expected;
}

/**
 * OAuth client storage for the official MCP SDK.
 * Interactive login may open the authorization URL. Query mode never does.
 */
export class FileOAuthProvider implements OAuthClientProvider {
  readonly redirectUrl = CALLBACK_URL;
  readonly clientMetadata: OAuthClientMetadata = {
    client_name: CLIENT_NAME,
    redirect_uris: [CALLBACK_URL],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "native",
    scope: READ_SCOPE,
  };

  constructor(
    private readonly store: CredentialStore,
    private readonly interactive: boolean,
    private readonly onAuthorizationUrl: (url: URL) => void,
  ) {}

  state(): string {
    const value = randomUUID();
    this.store.saveOauthState(value);
    return value;
  }

  clientInformation(ctx?: OAuthClientInformationContext): StoredOAuthClientInformation | undefined {
    return this.store.clientInformation(ctx?.issuer);
  }

  saveClientInformation(info: StoredOAuthClientInformation, ctx?: OAuthClientInformationContext): void {
    const issuer = ctx?.issuer ?? info.issuer;
    if (!issuer) {
      throw new CliError("auth_rejected", "The authorization server did not provide an issuer to store the client registration.");
    }
    this.store.saveClientInformation(issuer, info);
  }

  tokens(ctx?: OAuthClientInformationContext): StoredOAuthTokens | undefined {
    return this.store.tokens(ctx?.issuer);
  }

  saveTokens(tokens: StoredOAuthTokens, ctx?: OAuthClientInformationContext): void {
    const issuer = ctx?.issuer ?? tokens.issuer;
    if (!issuer) {
      throw new CliError("auth_rejected", "The authorization server did not provide an issuer to store the sign-in.");
    }
    this.store.saveTokens(issuer, tokens);
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    assertHttpsAuthorizationUrl(authorizationUrl);
    if (!this.interactive) return;
    this.onAuthorizationUrl(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.store.saveVerifier(codeVerifier);
  }

  codeVerifier(): string {
    const verifier = this.store.verifier();
    if (!verifier) {
      throw new CliError("auth_rejected", "The local sign-in challenge is missing. Run `vpsyou-cn2 login` again.");
    }
    return verifier;
  }

  saveDiscoveryState(state: OAuthDiscoveryState): void {
    this.store.saveDiscovery(state);
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.store.discovery();
  }

  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): void {
    this.store.invalidate(scope);
  }
}

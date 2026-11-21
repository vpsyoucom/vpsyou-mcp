export type ErrorCode =
  | "usage"
  | "not_signed_in"
  | "auth_rejected"
  | "callback_state"
  | "callback_timeout"
  | "callback_port"
  | "tool_missing"
  | "tool_error"
  | "request_failed";

export class CliError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "CliError";
    this.code = code;
  }
}

export function exitCodeFor(code: ErrorCode): number {
  if (code === "usage" || code === "tool_missing") return 2;
  if (
    code === "not_signed_in" ||
    code === "auth_rejected" ||
    code === "callback_state" ||
    code === "callback_timeout" ||
    code === "callback_port"
  ) {
    return 3;
  }
  return 1;
}

export function redact(text: string): string {
  return text
    .replace(
      /("(?:access_token|refresh_token|id_token|client_secret|code_verifier)"\s*:\s*")[^"]*/gi,
      "$1[redacted]",
    )
    .replace(
      /\b(access_token|refresh_token|id_token|client_secret|code_verifier)=([^&\s]+)/gi,
      "$1=[redacted]",
    )
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return redact(error.message);
  return redact(String(error));
}

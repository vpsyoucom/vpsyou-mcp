import { MCP_ENDPOINT, TOOL_NAME } from "./constants.js";

export interface QueryReport {
  ok: true;
  endpoint: typeof MCP_ENDPOINT;
  tool: typeof TOOL_NAME;
  arguments: Record<string, string>;
  retrievedAt: string;
  probe: "Guangdong";
  toolDescription: string | null;
  measurementNotes: {
    timestamps: "unix_milliseconds";
    rtt: "milliseconds";
    loss: "ratio_0_to_1";
    null: "no_observed_data";
  };
  result: unknown;
}

export function toolPayload(result: {
  structuredContent?: unknown;
  content?: unknown;
}): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  if (Array.isArray(result.content) && result.content.length === 1) {
    const block = result.content[0];
    if (isTextBlock(block)) {
      try {
        return JSON.parse(block.text) as unknown;
      } catch {
        return block.text;
      }
    }
  }
  return result.content ?? null;
}

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function formatQueryHuman(report: QueryReport): string {
  const target = report.arguments.targetId ?? "(omitted)";
  return [
    "VPSYOU CN2 latency",
    `Endpoint: ${report.endpoint}`,
    "Probe: Guangdong ICMP, one probe",
    `Window: ${report.arguments.window}`,
    `Target: ${target}`,
    `Retrieved: ${report.retrievedAt} (when this command received the response, not the probe timestamp)`,
    "",
    "Result:",
    JSON.stringify(report.result, null, 2),
    "",
    "The server describes timestamps as Unix milliseconds, round-trip time as milliseconds, and packet loss as a ratio from 0 to 1. Null means no observed data. Names of those values are whatever fields the result contains. A reading is this probe's path to a test endpoint. It is not a global monitoring network, and this command does not manage VPS instances.",
    "",
  ].join("\n");
}

export function formatTargetsHuman(windows: string[], targets: string[] | undefined): string {
  const lines = [
    `Tool: ${TOOL_NAME}`,
    `Endpoint: ${MCP_ENDPOINT}`,
    `Windows: ${windows.join(", ")}`,
    "Targets:",
  ];
  if (!targets) {
    lines.push("(The server did not publish a targetId enum.)");
  } else if (targets.length === 0) {
    lines.push("(The server published an empty targetId enum.)");
  } else {
    lines.push(...targets);
  }
  return `${lines.join("\n")}\n`;
}

function isTextBlock(value: unknown): value is { type: "text"; text: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "text" &&
    typeof (value as { text?: unknown }).text === "string"
  );
}

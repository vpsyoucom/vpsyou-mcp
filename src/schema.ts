import { DOCUMENTED_WINDOWS, TOOL_NAME } from "./constants.js";
import { CliError } from "./errors.js";

export interface ListedTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export function findTool(tools: ListedTool[]): ListedTool {
  const tool = tools.find((item) => item.name === TOOL_NAME);
  if (!tool) {
    throw new CliError(
      "tool_missing",
      `The server did not advertise ${TOOL_NAME}. This client only calls that read-only tool.`,
    );
  }
  return tool;
}

export function stringEnum(schema: unknown, property: string): string[] | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  const properties = (schema as { properties?: unknown }).properties;
  if (!properties || typeof properties !== "object") return undefined;
  const field = (properties as Record<string, unknown>)[property];
  if (!field || typeof field !== "object") return undefined;
  const values = (field as { enum?: unknown }).enum;
  if (!Array.isArray(values) || values.length === 0 || !values.every((item) => typeof item === "string")) {
    return undefined;
  }
  return values;
}

export function windowsFromSchema(schema: unknown): string[] {
  return stringEnum(schema, "window") ?? [...DOCUMENTED_WINDOWS];
}

export function targetsFromSchema(schema: unknown): string[] | undefined {
  return stringEnum(schema, "targetId");
}

const TARGET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildToolArguments(
  schema: unknown,
  window: string | undefined,
  target: string | undefined,
): Record<string, string> {
  const windows = windowsFromSchema(schema);
  const chosen = window ?? "live";
  if (!windows.includes(chosen)) {
    throw new CliError("usage", `Window must be one of: ${windows.join(", ")}.`);
  }
  const args: Record<string, string> = { window: chosen };
  if (target === undefined) return args;
  if (!TARGET_ID.test(target) || target.length > 64) {
    throw new CliError("usage", "Target id must match the server's targetId values. Run `vpsyou-cn2 targets`.");
  }
  const targets = targetsFromSchema(schema);
  if (targets && !targets.includes(target)) {
    throw new CliError(
      "usage",
      `Target ${target} is not in the server's current targetId list. Run \`vpsyou-cn2 targets\`.`,
    );
  }
  args.targetId = target;
  return args;
}

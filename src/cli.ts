#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { CLIENT_VERSION, MCP_ENDPOINT, TOOL_NAME } from "./constants.js";
import { CredentialStore } from "./credentials.js";
import { CliError, exitCodeFor } from "./errors.js";
import { formatJson, formatQueryHuman, formatTargetsHuman, toolPayload, type QueryReport } from "./format.js";
import { runLogin } from "./login.js";
import { buildToolArguments, findTool, targetsFromSchema, windowsFromSchema } from "./schema.js";
import { openQuerySession, type Cn2Session } from "./session.js";

export type Command =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "login"; json: boolean }
  | { kind: "logout"; json: boolean }
  | { kind: "status"; json: boolean }
  | { kind: "targets"; json: boolean }
  | { kind: "query"; json: boolean; window?: string; target?: string };

export interface Runtime {
  store: CredentialStore;
  openSession: () => Promise<Cn2Session>;
  login: () => Promise<void>;
  now: () => Date;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export function parseArgs(argv: string[]): Command {
  let json = false;
  let windowValue: string | undefined;
  let targetValue: string | undefined;
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--") continue;
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") return { kind: "help" };
    if (arg === "--version" || arg === "-V") return { kind: "version" };
    if (arg === "--endpoint" || arg.startsWith("--endpoint=")) {
      throw new CliError("usage", `The MCP endpoint is fixed at ${MCP_ENDPOINT} and cannot be changed.`);
    }
    if (arg === "--window" || arg.startsWith("--window=")) {
      windowValue = optionValue(argv, index, "--window");
      if (arg === "--window") index += 1;
      continue;
    }
    if (arg === "--target" || arg.startsWith("--target=")) {
      targetValue = optionValue(argv, index, "--target");
      if (arg === "--target") index += 1;
      continue;
    }
    if (arg.startsWith("-")) throw new CliError("usage", `Unknown option ${arg}. Run \`vpsyou-cn2 --help\`.`);
    positionals.push(arg);
  }
  if (positionals.length === 0) return { kind: "help" };
  if (positionals.length > 1) {
    throw new CliError("usage", `Unexpected argument ${positionals[1]}. Run \`vpsyou-cn2 --help\`.`);
  }
  const command = positionals[0];
  if (windowValue !== undefined && command !== "query") {
    throw new CliError("usage", "--window is only valid with query.");
  }
  if (targetValue !== undefined && command !== "query") {
    throw new CliError("usage", "--target is only valid with query.");
  }
  if (command === "login") return { kind: "login", json };
  if (command === "logout") return { kind: "logout", json };
  if (command === "status") return { kind: "status", json };
  if (command === "targets") return { kind: "targets", json };
  if (command === "query") return { kind: "query", json, window: windowValue, target: targetValue };
  throw new CliError("usage", `Unknown command ${command}. Run \`vpsyou-cn2 --help\`.`);
}

export function helpText(): string {
  return `vpsyou-cn2 ${CLIENT_VERSION}

Read CN2 latency and packet loss from the VPSYOU probe in Guangdong.
The endpoint is fixed at ${MCP_ENDPOINT} (Streamable HTTP, OAuth).
This client does not manage VPS instances and is not a global monitoring network.

The package name is vpsyou-cn2. It is not yet published to npm.
From a checkout of this repository, build it and run:

  npm install
  npm run build
  node dist/src/cli.js --help

Usage:
  vpsyou-cn2 login
  vpsyou-cn2 logout
  vpsyou-cn2 status [--json]
  vpsyou-cn2 targets [--json]
  vpsyou-cn2 query [--window live|24h|7d] [--target <id>] [--json]

  login     Sign in with the browser and approve read-only cn2:read.
            The sign-in stays in a user-only file under your config directory.
  logout    Delete that local sign-in file.
  status    Say whether a local sign-in is stored. This does not call the server.
  targets   List windows and target ids from the server's current ${TOOL_NAME} schema.
  query     Call ${TOOL_NAME}. The default window is live. Omit --target to omit targetId.

Set VPSYOU_CN2_CONFIG_DIR to choose the private directory for the sign-in file.
That variable does not change the MCP endpoint.
`;
}

export async function run(argv: string[], runtime: Runtime = defaultRuntime()): Promise<number> {
  try {
    const command = parseArgs(argv);
    if (command.kind === "help") {
      runtime.stdout(helpText());
      return 0;
    }
    if (command.kind === "version") {
      runtime.stdout(`${CLIENT_VERSION}\n`);
      return 0;
    }
    if (command.kind === "login") {
      await runtime.login();
      write(
        runtime,
        command.json,
        { ok: true, signedIn: true, endpoint: MCP_ENDPOINT },
        "Signed in. The local sign-in file was updated and was not printed.\n",
      );
      return 0;
    }
    if (command.kind === "logout") {
      const existed = runtime.store.exists();
      runtime.store.remove();
      write(
        runtime,
        command.json,
        { ok: true, removed: existed, endpoint: MCP_ENDPOINT },
        existed ? "Removed the local sign-in file.\n" : "No local sign-in file was stored.\n",
      );
      return 0;
    }
    if (command.kind === "status") {
      const stored = runtime.store.hasCredential();
      write(
        runtime,
        command.json,
        {
          ok: true,
          endpoint: MCP_ENDPOINT,
          credentialStored: stored,
          credentialCheckedWithServer: false,
          credentialFile: runtime.store.filePath,
        },
        stored
          ? `Endpoint: ${MCP_ENDPOINT}\nA local sign-in file is stored. This command does not check it with the server.\nCredential file: ${runtime.store.filePath}\n`
          : `Endpoint: ${MCP_ENDPOINT}\nNo local sign-in is stored.\nCredential file: ${runtime.store.filePath}\n`,
      );
      return 0;
    }
    if (!runtime.store.hasCredential()) {
      throw new CliError(
        "not_signed_in",
        "No local VPSYOU sign-in is stored. Run `vpsyou-cn2 login` in your terminal and approve read-only cn2:read. Do not paste tokens into chat.",
      );
    }
    const session = await runtime.openSession();
    try {
      if (command.kind === "targets") {
        const listed = await session.listTools();
        const tool = findTool(listed.tools);
        const windows = windowsFromSchema(tool.inputSchema);
        const targets = targetsFromSchema(tool.inputSchema);
        write(
          runtime,
          command.json,
          { ok: true, endpoint: MCP_ENDPOINT, tool: TOOL_NAME, windows, targets: targets ?? null },
          formatTargetsHuman(windows, targets),
        );
        return 0;
      }
      const listed = await session.listTools();
      const tool = findTool(listed.tools);
      const args = buildToolArguments(tool.inputSchema, command.window, command.target);
      const result = await session.callTool({ name: TOOL_NAME, arguments: args });
      const payload = toolPayload(result);
      const retrievedAt = runtime.now().toISOString();
      if (result.isError) {
        const message = "The tool reported an error. The payload below is not a measurement.";
        write(
          runtime,
          command.json,
          {
            ok: false,
            error: { code: "tool_error", message },
            endpoint: MCP_ENDPOINT,
            tool: TOOL_NAME,
            arguments: args,
            retrievedAt,
            result: payload,
          },
          `${message}\n${JSON.stringify(payload, null, 2)}\n`,
        );
        return 1;
      }
      const report: QueryReport = {
        ok: true,
        endpoint: MCP_ENDPOINT,
        tool: TOOL_NAME,
        arguments: args,
        retrievedAt,
        probe: "Guangdong",
        toolDescription: tool.description ?? null,
        measurementNotes: {
          timestamps: "unix_milliseconds",
          rtt: "milliseconds",
          loss: "ratio_0_to_1",
          null: "no_observed_data",
        },
        result: payload,
      };
      write(runtime, command.json, report, formatQueryHuman(report));
      return 0;
    } finally {
      await session.close().catch(() => undefined);
    }
  } catch (error) {
    const cliError =
      error instanceof CliError
        ? error
        : new CliError("request_failed", "The command failed before it could print a result.");
    const json = argv.includes("--json");
    if (json) runtime.stdout(`${JSON.stringify({ ok: false, error: { code: cliError.code, message: cliError.message } })}\n`);
    else runtime.stderr(`${cliError.message}\n`);
    return exitCodeFor(cliError.code);
  }
}

function write(runtime: Runtime, json: boolean, value: unknown, human: string): void {
  runtime.stdout(json ? formatJson(value) : human);
}

function optionValue(argv: string[], index: number, name: string): string {
  const arg = argv[index] ?? "";
  if (arg.startsWith(`${name}=`)) {
    const value = arg.slice(name.length + 1);
    if (value.length === 0) throw new CliError("usage", `${name} needs a value.`);
    return value;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) throw new CliError("usage", `${name} needs a value.`);
  return value;
}

function defaultRuntime(): Runtime {
  const store = new CredentialStore();
  return {
    store,
    now: () => new Date(),
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    openSession: () => openQuerySession(store),
    login: () => runLogin(store, (message) => process.stderr.write(`${message}\n`)),
  };
}

const entry = process.argv[1];
const entryUrl = entry ? pathToFileURL(realpathSync(entry)).href : "";
if (entry && import.meta.url === entryUrl) {
  const code = await run(process.argv.slice(2));
  process.exit(code);
}

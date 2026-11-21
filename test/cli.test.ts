import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MCP_ENDPOINT } from "../src/constants.js";
import { CredentialStore } from "../src/credentials.js";
import { CliError } from "../src/errors.js";
import { redact } from "../src/errors.js";
import { helpText, parseArgs, run, type Runtime } from "../src/cli.js";
import { listenForCallback } from "../src/login.js";
import { assertHttpsAuthorizationUrl, callbackStateMatches } from "../src/oauth.js";
import { buildToolArguments } from "../src/schema.js";
import type { Cn2Session } from "../src/session.js";

const SECRET = "test-access-token-not-a-live-credential";

function tempStore(): { store: CredentialStore; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), "vpsyou-cn2-"));
  return { store: new CredentialStore(directory), directory };
}

function runtime(store: CredentialStore, session?: Cn2Session, login?: () => Promise<void>): { runtime: Runtime; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    runtime: {
      store,
      now: () => new Date("2026-11-21T09:00:00.000Z"),
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
      openSession: async () => {
        if (!session) throw new Error("session should not be opened");
        return session;
      },
      login: login ?? (async () => undefined),
    },
  };
}

const schema = {
  type: "object",
  properties: {
    window: { type: "string", enum: ["live", "24h", "7d"] },
    targetId: { type: "string", enum: ["dmit-hkg", "dmit-tyo"] },
  },
  additionalProperties: false,
};

function signedInStore(): CredentialStore {
  const { store } = tempStore();
  store.saveTokens("https://vpsyou.com/api/auth", {
    access_token: SECRET,
    token_type: "Bearer",
  });
  return store;
}

describe("arguments", () => {
  it("rejects an endpoint override", () => {
    assert.throws(() => parseArgs(["query", "--endpoint", "https://example.test/mcp"]), (error: unknown) => {
      assert.ok(error instanceof CliError);
      assert.equal(error.code, "usage");
      assert.match(error.message, /fixed at https:\/\/vpsyou\.com\/mcp/);
      return true;
    });
  });

  it("parses the documented query forms", () => {
    assert.deepEqual(parseArgs(["query", "--window", "24h", "--target", "dmit-hkg"]), {
      kind: "query",
      json: false,
      window: "24h",
      target: "dmit-hkg",
    });
    assert.deepEqual(parseArgs(["query", "--window=7d", "--target=dmit-hkg", "--json"]), {
      kind: "query",
      json: true,
      window: "7d",
      target: "dmit-hkg",
    });
    assert.equal(parseArgs(["query"]).kind, "query");
  });

  it("builds tool arguments from the server schema", () => {
    assert.deepEqual(buildToolArguments(schema, undefined, undefined), { window: "live" });
    assert.deepEqual(buildToolArguments(schema, "24h", "dmit-hkg"), { window: "24h", targetId: "dmit-hkg" });
    assert.throws(() => buildToolArguments(schema, "30d", undefined), /Window must be one of/);
    assert.throws(() => buildToolArguments(schema, "live", "not-a-real-target"), /not in the server's current targetId list/);
  });
});

describe("credentials", () => {
  const directories: string[] = [];
  after(() => {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  });

  it("stores a sign-in file without printing it and removes it on logout", async () => {
    const { store, directory } = tempStore();
    directories.push(directory);
    store.saveTokens("https://vpsyou.com/api/auth", { access_token: SECRET, token_type: "Bearer" });
    const mode = statSync(store.filePath).mode & 0o777;
    assert.equal(mode, 0o600);
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    const saved = readFileSync(store.filePath, "utf8");
    assert.match(saved, new RegExp(SECRET));

    const harness = runtime(store);
    const status = await run(["status"], harness.runtime);
    assert.equal(status, 0);
    assert.match(harness.stdout.join(""), /local sign-in file is stored/);
    assert.equal(harness.stdout.join("").includes(SECRET), false);

    const logout = await run(["logout", "--json"], harness.runtime);
    assert.equal(logout, 0);
    const body = JSON.parse(harness.stdout.at(-1) ?? "{}") as { removed: boolean };
    assert.equal(body.removed, true);
    assert.equal(store.exists(), false);
    assert.equal(harness.stdout.join("").includes(SECRET), false);
  });
});

describe("query", () => {
  it("does not open a session when no sign-in is stored", async () => {
    const { store, directory } = tempStore();
    const harness = runtime(store);
    const code = await run(["query", "--json"], harness.runtime);
    assert.equal(code, 3);
    const body = JSON.parse(harness.stdout.join("")) as { ok: boolean; error: { code: string; message: string } };
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "not_signed_in");
    assert.match(body.error.message, /Do not paste tokens/);
    rmSync(directory, { recursive: true, force: true });
  });

  it("passes through a fixture payload and labels null as no observed data", async () => {
    const calls: unknown[] = [];
    const session: Cn2Session = {
      async listTools() {
        return {
          tools: [
            {
              name: "get_cn2_latency",
              description: "Fixture tool description, not a live reading.",
              inputSchema: schema,
            },
          ],
        };
      },
      async callTool(params) {
        calls.push(params);
        return { isError: false, structuredContent: { observed: null } };
      },
      async close() {
        return undefined;
      },
    };
    const harness = runtime(signedInStore(), session);
    const code = await run(["query", "--window", "24h", "--target", "dmit-hkg", "--json"], harness.runtime);
    assert.equal(code, 0);
    assert.deepEqual(calls, [
      { name: "get_cn2_latency", arguments: { window: "24h", targetId: "dmit-hkg" } },
    ]);
    const body = JSON.parse(harness.stdout.join("")) as {
      endpoint: string;
      retrievedAt: string;
      result: { observed: null };
      measurementNotes: { null: string };
    };
    assert.equal(body.endpoint, MCP_ENDPOINT);
    assert.equal(body.retrievedAt, "2026-11-21T09:00:00.000Z");
    assert.deepEqual(body.result, { observed: null });
    assert.equal(body.measurementNotes.null, "no_observed_data");
    assert.equal(JSON.stringify(body).includes(SECRET), false);

    const human = runtime(signedInStore(), session);
    const humanCode = await run(["query"], human.runtime);
    assert.equal(humanCode, 0);
    assert.match(human.stdout.join(""), /Null means no observed data/);
    assert.match(human.stdout.join(""), /not the probe timestamp/);
    assert.match(human.stdout.join(""), /Guangdong/);
  });

  it("returns a tool error without treating the fixture as a measurement", async () => {
    const session: Cn2Session = {
      async listTools() {
        return { tools: [{ name: "get_cn2_latency", inputSchema: schema }] };
      },
      async callTool() {
        return { isError: true, structuredContent: { message: "fixture tool error" } };
      },
      async close() {
        return undefined;
      },
    };
    const harness = runtime(signedInStore(), session);
    const code = await run(["query", "--json"], harness.runtime);
    assert.equal(code, 1);
    const body = JSON.parse(harness.stdout.join("")) as { ok: boolean; error: { code: string }; result: { message: string } };
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "tool_error");
    assert.equal(body.result.message, "fixture tool error");
  });

  it("lists targets from the server schema", async () => {
    const session: Cn2Session = {
      async listTools() {
        return { tools: [{ name: "get_cn2_latency", inputSchema: schema }] };
      },
      async callTool() {
        throw new Error("targets must not call the tool");
      },
      async close() {
        return undefined;
      },
    };
    const harness = runtime(signedInStore(), session);
    const code = await run(["targets", "--json"], harness.runtime);
    assert.equal(code, 0);
    const body = JSON.parse(harness.stdout.join("")) as { windows: string[]; targets: string[] };
    assert.deepEqual(body.windows, ["live", "24h", "7d"]);
    assert.deepEqual(body.targets, ["dmit-hkg", "dmit-tyo"]);
  });
});

describe("auth helpers", () => {
  it("refuses a non-HTTPS authorization URL and checks callback state", () => {
    assert.throws(() => assertHttpsAuthorizationUrl(new URL("http://vpsyou.com/api/auth/oauth2/authorize")), /not HTTPS/);
    assert.equal(callbackStateMatches("expected-state", new URLSearchParams("state=expected-state")), true);
    assert.equal(callbackStateMatches("expected-state", new URLSearchParams("state=other")), false);
  });

  it("does not echo an authorization code on the local callback page", async () => {
    const listener = await listenForCallback(0);
    try {
      const response = await fetch(`http://127.0.0.1:${listener.port}/callback?code=secret-code&state=abc`);
      const page = await response.text();
      assert.equal(response.status, 200);
      assert.equal(page.includes("secret-code"), false);
      assert.match(page, /return to the terminal/);
      const params = await listener.wait();
      assert.equal(params.get("code"), "secret-code");
      assert.equal(params.get("state"), "abc");
    } finally {
      await listener.close();
    }
  });

  it("rejects a mismatched callback without echoing the code", async () => {
    const listener = await listenForCallback(0, () => "expected-state");
    try {
      const response = await fetch(`http://127.0.0.1:${listener.port}/callback?code=secret-code&state=other-state`);
      const page = await response.text();
      assert.equal(response.status, 400);
      assert.equal(page.includes("secret-code"), false);
      assert.equal(page.includes("other-state"), false);
      await assert.rejects(listener.wait(), /did not match this login/);
    } finally {
      await listener.close();
    }
  });

  it("redacts credential-shaped text", () => {
    const redacted = redact('Bearer abc.def access_token=abc {"refresh_token":"xyz"}');
    assert.equal(redacted.includes("abc"), false);
    assert.equal(redacted.includes("xyz"), false);
    assert.match(redacted, /\[redacted\]/);
  });
});

describe("help and skill", () => {
  it("prints help without a session", async () => {
    const { store, directory } = tempStore();
    const harness = runtime(store);
    const code = await run(["--help"], harness.runtime);
    assert.equal(code, 0);
    assert.match(harness.stdout.join(""), /vpsyou-cn2 login/);
    assert.match(harness.stdout.join(""), /not yet published to npm/);
    assert.equal(helpText().includes(MCP_ENDPOINT), true);
    rmSync(directory, { recursive: true, force: true });
  });

  it("parses every CLI command published in the skill", () => {
    const skillPath = join(repoRoot(dirname(fileURLToPath(import.meta.url))), "skills", "vpsyou-cn2-latency", "SKILL.md");
    const skill = readFileSync(skillPath, "utf8");
    assert.match(skill, /^---\nname: vpsyou-cn2-latency\ndescription: Use when /);
    const commands = [...skill.matchAll(/node dist\/src\/cli\.js(?: [^\n`]+)?/g)].map((match) => match[0]);
    assert.ok(commands.length >= 5);
    for (const command of commands) {
      const args = command.replace("node dist/src/cli.js", "").trim();
      const parsed = parseArgs(args.length === 0 ? ["--help"] : args.split(/\s+/));
      assert.ok(parsed.kind);
    }
  });
});

describe("built cli", () => {
  it("starts and shows help", () => {
    const cli = join(repoRoot(dirname(fileURLToPath(import.meta.url))), "dist", "src", "cli.js");
    const result = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /vpsyou-cn2 login/);
    assert.equal(result.stdout.includes(SECRET), false);
  });

  it("prints help when the executable is a symlink", () => {
    const cli = join(repoRoot(dirname(fileURLToPath(import.meta.url))), "dist", "src", "cli.js");
    const link = join(tmpdir(), `vpsyou-cn2-link-${process.pid}`);
    symlinkSync(cli, link);
    try {
      const result = spawnSync(process.execPath, [link, "--help"], { encoding: "utf8" });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /not yet published to npm/);
    } finally {
      rmSync(link, { force: true });
    }
  });
});

function repoRoot(start: string): string {
  let dir = start;
  while (true) {
    try {
      statSync(join(dir, "package.json"));
      statSync(join(dir, "skills"));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) throw new Error("repository root not found");
      dir = parent;
    }
  }
}

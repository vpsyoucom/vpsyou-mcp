import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = repoRoot(dirname(fileURLToPath(import.meta.url)));

describe("Gemini CLI extension", () => {
  it("points the hosted Streamable HTTP server at the documented OAuth scope", () => {
    const manifest = JSON.parse(readFileSync(join(root, "gemini-extension.json"), "utf8")) as {
      name: string;
      version: string;
      mcpServers: Record<string, Record<string, unknown>>;
    };
    const server = manifest.mcpServers["vpsyou-cn2"];
    assert.equal(manifest.name, "vpsyou-mcp");
    assert.equal(manifest.version, "0.1.1");
    assert.equal(server.httpUrl, "https://vpsyou.com/mcp");
    assert.equal("url" in server, false);
    assert.equal("command" in server, false);
    assert.equal("args" in server, false);
    assert.deepEqual(server.oauth, { enabled: true, scopes: ["cn2:read"] });
    for (const invented of ["issuer", "clientId", "clientSecret", "authorizationUrl", "tokenUrl"]) {
      assert.equal(JSON.stringify(server).includes(invented), false);
    }
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
      license?: string;
    };
    assert.equal(pkg.version, "0.1.1");
    assert.equal(pkg.license, undefined);
  });

  it("documents install and /mcp auth without a gallery claim", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const guide = readFileSync(join(root, "docs/mcp.md"), "utf8");
    for (const text of [readme, guide]) {
      assert.match(text, /gemini extensions install https:\/\/github\.com\/vpsyoucom\/vpsyou-mcp/);
      assert.match(text, /\/mcp auth vpsyou-cn2/);
    }
    assert.match(guide, /httpUrl/);
    assert.equal(guide.includes("gemini-cli-extension"), false);
  });
});

function repoRoot(start: string): string {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "skills"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("repository root not found");
    dir = parent;
  }
}

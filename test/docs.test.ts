import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = repoRoot(dirname(fileURLToPath(import.meta.url)));
const documents = ["README.md", "docs/mcp.md", "skills/vpsyou-cn2-latency/SKILL.md"];

describe("documentation links", () => {
  it("resolves relative links and heading anchors", () => {
    const problems: string[] = [];
    for (const document of documents) {
      const text = readFileSync(join(root, document), "utf8");
      for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = match[1] ?? "";
        if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:")) continue;
        const [pathPart, hash] = target.split("#");
        const filePath = pathPart && pathPart.length > 0 ? resolve(dirname(join(root, document)), pathPart) : join(root, document);
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          problems.push(`${document} -> missing file ${target}`);
          continue;
        }
        if (!hash) continue;
        const slugs = headingSlugs(readFileSync(filePath, "utf8"));
        if (!slugs.has(hash)) problems.push(`${document} -> missing heading #${hash} in ${filePath}`);
      }
    }
    assert.deepEqual(problems, []);
  });

  it("keeps the verified connection record in docs/mcp.md", () => {
    const guide = readFileSync(join(root, "docs/mcp.md"), "utf8");
    const readme = readFileSync(join(root, "README.md"), "utf8");
    for (const fact of [
      "https://vpsyou.com/mcp",
      "https://vpsyou.com/api/auth/oauth2/register",
      "claude mcp add --transport http --scope user vpsyou-cn2 https://vpsyou.com/mcp",
      "codex mcp add vpsyou-cn2 --url https://vpsyou.com/mcp",
      "codex mcp login vpsyou-cn2",
      "Add the remote MCP server https://vpsyou.com/mcp as VPSYOU CN2 with OAuth.",
      '"window": "7d"',
      '"targetId": "dmit-hkg"',
      "hostdare-lax",
      'scope="cn2:read"',
      "missing authorization header",
    ]) {
      assert.equal(guide.includes(fact), true, fact);
    }
    assert.equal(readme.includes("hostdare-lax"), false);
    assert.equal(readme.includes("docs/mcp.md"), true);
  });
});

function headingSlugs(markdown: string): Set<string> {
  const slugs = new Set<string>();
  for (const match of markdown.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const slug = (match[1] ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-");
    slugs.add(slug);
  }
  return slugs;
}

function repoRoot(start: string): string {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "skills"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("repository root not found");
    dir = parent;
  }
}

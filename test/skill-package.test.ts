import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = repoRoot(dirname(fileURLToPath(import.meta.url)));
const skillDir = join(root, "skills", "vpsyou-cn2-latency");

describe("ClawHub skill package", () => {
  it("is self-contained, version 0.1.1, and does not license the CLI", () => {
    const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
    const license = readFileSync(join(skillDir, "LICENSE"), "utf8");
    assert.match(skill, /^---\nname: vpsyou-cn2-latency\n/);
    assert.match(skill, /version: "0\.1\.1"/);
    assert.match(skill, /homepage: https:\/\/vpsyou\.com\n/);
    assert.match(skill, /bins:\n\s+- node\n\s+- vpsyou-cn2/);
    assert.match(skill, /package: vpsyou-cn2/);
    assert.equal(skill.includes("../../"), false);
    assert.equal(skill.includes("node dist/src/cli.js"), false);
    assert.equal(skill.includes("marketplace listing"), false);
    assert.match(skill, /Node\.js 20 or newer/);
    assert.match(skill, /cn2:read/);
    assert.match(skill, /not verified by a signed-in call/);
    assert.match(license, /MIT No Attribution/);
    assert.match(license, /only to the files in the skills\/vpsyou-cn2-latency directory/);
    assert.equal(existsSync(join(root, "LICENSE")), false);
    assert.equal(readFileSync(join(root, "package.json"), "utf8").includes('"license"'), false);

    for (const match of skill.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1] ?? "";
      if (target.startsWith("https://") || target.startsWith("http://")) continue;
      assert.equal(target.startsWith("."), false, target);
      const filePath = resolve(skillDir, target);
      assert.equal(existsSync(filePath), true, target);
      assert.equal(relative(skillDir, filePath).startsWith(".."), false);
    }
  });

  it("packs only the skill directory", () => {
    const zipPath = join(tmpdir(), `vpsyou-cn2-latency-${process.pid}.zip`);
    execFileSync("zip", ["-r", zipPath, "vpsyou-cn2-latency"], { cwd: join(root, "skills") });
    try {
      const names = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.endsWith("/"));
      assert.deepEqual(names.sort(), ["vpsyou-cn2-latency/LICENSE", "vpsyou-cn2-latency/SKILL.md"]);
    } finally {
      rmSync(zipPath, { force: true });
    }
    const files = readdirSync(skillDir).sort();
    assert.deepEqual(files, ["LICENSE", "SKILL.md"]);
    for (const file of files) assert.equal(statSync(join(skillDir, file)).isFile(), true);
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

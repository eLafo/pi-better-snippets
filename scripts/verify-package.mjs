import { execFileSync } from "node:child_process";

const expected = [
	"LICENSE",
	"README.md",
	"index.ts",
	"package.json",
	"skills/copyable-snippets/SKILL.md",
].sort();
const output = execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" });
const packages = JSON.parse(output);
if (!Array.isArray(packages) || packages.length !== 1) throw new Error("npm pack did not return exactly one package");
const actual = packages[0].files.map((file) => file.path).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
	throw new Error(`npm pack allowlist changed. Expected ${expected.join(", ")}; got ${actual.join(", ")}`);
}
console.log(`npm pack allowlist verified (${actual.length} files): ${actual.join(", ")}`);

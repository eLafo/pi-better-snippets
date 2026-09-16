import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const temporary = mkdtempSync(join(tmpdir(), "pi-better-snippets-smoke-"));
const tarballs = join(temporary, "tarballs");
const project = join(temporary, "project");
const home = join(temporary, "home");
mkdirSync(tarballs);
mkdirSync(project);
mkdirSync(home);
const run = (command, args, options = {}) => {
	const result = spawnSync(command, args, {
		cwd: project,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		...options,
	});
	if (result.error) throw result.error;
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}): ${output}`);
	return output;
};
try {
	const pack = execFileSync("npm", ["pack", "--json", "--pack-destination", tarballs], { cwd: root, encoding: "utf8" });
	const packed = JSON.parse(pack);
	if (!Array.isArray(packed) || packed.length !== 1) throw new Error("expected npm pack to create exactly one tarball");
	// The temporary host has only production dependencies and pins the baseline Pi/TUI host.
	writeFileSync(join(project, "package.json"), JSON.stringify({
		private: true,
		name: "pi-better-snippets-smoke",
		dependencies: {
			"@earendil-works/pi-coding-agent": "0.85.1",
			"@earendil-works/pi-tui": "0.85.1",
		},
	}));
	const tarball = join(tarballs, packed[0].filename);
	run("npm", ["install", "--omit=dev", "--ignore-scripts", "--package-lock=false", tarball]);
	run("npm", ["ls", "--omit=dev", "--all"]);
	for (const devTool of ["vitest", "typescript", "@vitest/coverage-v8"]) {
		if (existsSync(join(project, "node_modules", ...devTool.split("/")))) throw new Error(`development tool unexpectedly installed: ${devTool}`);
	}
	const installed = join(project, "node_modules/@elafo/pi-better-snippets");
	if (!existsSync(join(installed, "index.ts"))) throw new Error("packed extension was not installed");
	const pi = join(project, "node_modules/.bin/pi");
	if (!existsSync(pi)) throw new Error("Pi host was not installed as a production peer dependency");
	const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: join(home, ".pi", "agent"), PI_OFFLINE: "1", npm_config_ignore_scripts: "true" };
	run(pi, ["install", installed], { env });
	const listed = run(pi, ["list"], { env });
	if (!listed.includes("pi-better-snippets")) throw new Error(`Pi list did not discover installed extension: ${listed}`);
	const loaded = run(pi, ["--offline", "--no-session", "--no-skills", "--no-context-files", "--print", "--", "/copy-snippet 1"], { env });
	if (!loaded.includes("Snippet copying is only available in the interactive TUI")) throw new Error("installed extension did not load through Pi command dispatch");
	console.log(`No-dev installed-package smoke passed using ${readFileSync(join(installed, "package.json"), "utf8").match(/"version":\s*"([^"]+)"/)?.[1] ?? "unknown"}.`);
} finally {
	rmSync(temporary, { recursive: true, force: true });
}

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cwd = process.cwd();
const cliPath = resolve(cwd, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
const extensionPath = resolve(cwd, "index.ts");
const conflictExtensionPath = resolve(cwd, "test/fixtures/shortcut-conflict.ts");
const headlessError = "Snippet copying is only available in the interactive TUI";
const commonArgs = [
	"--offline",
	"--approve",
	"--no-session",
	"--no-extensions",
	"--no-skills",
	"--no-context-files",
	"--extension",
	extensionPath,
];

function runPi(args: string[], input?: string) {
	return spawnSync(process.execPath, [cliPath, ...args], {
		cwd,
		encoding: "utf8",
		input,
		timeout: 15_000,
	});
}

function runInteractivePi(args: string[]) {
	const command = [process.execPath, cliPath, ...args];
	const commandLine = command.map((part) => JSON.stringify(part)).join(" ");
	// Linux `script` keeps its pseudo-terminal open after Pi has started, so end
	// the smoke test deliberately once startup output has had time to appear.
	const boundedCommand = process.platform === "linux"
		? `timeout --signal=TERM --kill-after=1s 5s ${commandLine}; status=$?; test "$status" -eq 0 -o "$status" -eq 124`
		: commandLine;
	const scriptArgs = process.platform === "darwin"
		? ["-q", "/dev/null", ...command]
		: ["-q", "-c", boundedCommand, "/dev/null"];
	return spawnSync("script", scriptArgs, { cwd, encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"] });
}

function stripTerminalControls(value: string): string {
	return value.replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\)|_[^\x1b]*\x1b\\)/g, "").replaceAll("\r", "");
}

describe("installed Pi headless command dispatch", () => {
	it("reports command errors in print, JSON, and RPC modes without changing Pi's zero-exit policy", () => {
		const print = runPi(["--print", ...commonArgs, "--", "/copy-snippet 1"]);
		expect(print.error).toBeUndefined();
		expect(print.status).toBe(0);
		expect(print.stderr).toContain(`Extension error (command:copy-snippet): ${headlessError}`);

		const json = runPi(["--mode", "json", ...commonArgs, "--", "/copy-snippet 1"]);
		expect(json.error).toBeUndefined();
		expect(json.status).toBe(0);
		expect(json.stderr).toContain(`Extension error (command:copy-snippet): ${headlessError}`);
		expect(json.stdout).toContain('"type":"session"');

		const rpcCommands = [
			{ id: "rpc-valid", type: "prompt", message: "/copy-snippet 1" },
			{ id: "rpc-invalid", type: "prompt", message: "/copy-snippet not-a-number" },
			{ id: "rpc-huge", type: "prompt", message: `/copy-snippet ${"9".repeat(500)}` },
		];
		const rpc = runPi(
			["--mode", "rpc", ...commonArgs],
			rpcCommands.map((command) => JSON.stringify(command)).join("\n") + "\n",
		);
		expect(rpc.error).toBeUndefined();
		expect(rpc.status).toBe(0);
		const responses = rpc.stdout.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
		const notifications = responses.filter((response) => response.type === "extension_ui_request" && response.method === "notify");
		expect(notifications).toHaveLength(3);
		for (const notification of notifications) {
			expect(notification).toMatchObject({ message: headlessError, notifyType: "warning" });
		}
		for (const command of rpcCommands) {
			expect(responses).toContainEqual(expect.objectContaining({
				id: command.id,
				type: "response",
				command: "prompt",
				success: true,
			}));
		}
	});
});

describe.skipIf(process.platform === "win32")("installed Pi interactive shortcut arbitration", () => {
	it("reports this extension as the losing registration while its command fallback remains loaded", () => {
		const collisionArgs = [
			...commonArgs,
			"--extension", conflictExtensionPath,
		];
		const interactive = runInteractivePi(collisionArgs);
		expect(interactive.error).toBeUndefined();
		expect(interactive.status).toBe(0);
		const terminal = stripTerminalControls(`${interactive.stdout}${interactive.stderr}`);
		expect(terminal).toContain("Extension shortcut conflict: 'ctrl+shift+c' registered by both");
		expect(terminal).toContain(extensionPath);
		expect(terminal.replace(/\s+/g, "")).toContain(`Using${conflictExtensionPath}.`);

		const fallback = runPi(["--print", ...collisionArgs, "--", "/copy-snippet 1"]);
		expect(fallback.error).toBeUndefined();
		expect(fallback.status).toBe(0);
		expect(fallback.stderr).toContain(`Extension error (command:copy-snippet): ${headlessError}`);
	});
});

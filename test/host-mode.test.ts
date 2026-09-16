import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cwd = process.cwd();
const cliPath = resolve(cwd, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
const extensionPath = resolve(cwd, "index.ts");
const headlessError = "Snippet copying is only available in the interactive TUI";
const commonArgs = [
	"--offline",
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

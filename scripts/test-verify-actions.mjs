import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const verifier = resolve("scripts/verify-actions.mjs");
const sha = "a".repeat(40);
const cases = [
	{
		name: "accepts nested, quoted-value, and reusable-job literal SHAs",
		yaml: `jobs:\n  reusable:\n    uses: owner/workflow@${sha}\n  build:\n    steps:\n      - uses: "owner/action@${sha}"\n      - nested: { uses: owner/nested@${sha} }\n`,
		passes: true,
	},
	{ name: "rejects quoted uses key", yaml: "'uses': owner/action@v4\n", passes: false },
	{ name: "rejects flow mapping", yaml: "job: { uses: owner/action@v4 }\n", passes: false },
	{ name: "rejects reusable workflow job tag", yaml: "jobs:\n  call:\n    uses: owner/workflow@main\n", passes: false },
	{ name: "rejects unpinned list-item tag", yaml: "steps:\n  - uses: owner/action@v4\n", passes: false },
	{ name: "rejects expressions", yaml: "uses: owner/action@${{ github.sha }}\n", passes: false },
	{ name: "rejects malformed values", yaml: `uses: owner/action@${sha}extra\n`, passes: false },
	{ name: "rejects block values", yaml: "uses: |\n  owner/action@v4\n", passes: false },
	{ name: "rejects alias-key uses bypass", yaml: `key: &uses uses\njob:\n  *uses: owner/action@${sha}\n`, passes: false },
	{ name: "rejects alias values", yaml: `action: &action owner/action@${sha}\nuses: *action\n`, passes: false },
	{ name: "rejects merge keys", yaml: `job:\n  <<: { uses: owner/action@${sha} }\n`, passes: false },
	{ name: "rejects workflows without uses references", yaml: "name: no actions\n", passes: false },
];
for (const testCase of cases) {
	const directory = mkdtempSync(join(tmpdir(), "verify-actions-"));
	try {
		const workflows = join(directory, "workflows");
		mkdirSync(workflows);
		writeFileSync(join(workflows, "ci.yml"), testCase.yaml);
		let passed = true;
		try {
			execFileSync(process.execPath, [verifier], { env: { ...process.env, WORKFLOW_DIRECTORY: workflows }, stdio: "pipe" });
		} catch {
			passed = false;
		}
		if (passed !== testCase.passes) throw new Error(`${testCase.name}: expected ${testCase.passes ? "success" : "failure"}`);
		console.log(`passed: ${testCase.name}`);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

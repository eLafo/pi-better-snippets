import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function verifyAuditJson(output, graph) {
	let report;
	try { report = JSON.parse(output); } catch { throw new Error(`${graph} audit did not produce valid JSON`); }
	if (report === null || typeof report !== "object" || Array.isArray(report)) throw new Error(`${graph} audit report must be an object`);
	const total = report.metadata?.vulnerabilities?.total;
	if (total !== 0) throw new Error(`${graph} audit metadata.vulnerabilities.total must be 0, got ${String(total)}`);
	if (report.vulnerabilities === null || typeof report.vulnerabilities !== "object" || Array.isArray(report.vulnerabilities)) throw new Error(`${graph} audit vulnerabilities must be an object`);
	if (Object.keys(report.vulnerabilities).length !== 0) throw new Error(`${graph} audit vulnerabilities must have zero entries`);
}

export function runAudit(graph) {
	const args = graph === "production"
		? ["audit", "--omit=dev", "--json"]
		: graph === "full"
			? ["audit", "--include=dev", "--json"]
			: null;
	if (!args) throw new Error("usage: verify-audit.mjs production|full");
	const result = spawnSync("npm", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	if (result.error) throw result.error;
	try { verifyAuditJson(result.stdout, graph); } catch (error) {
		const suffix = result.stderr?.trim() ? `\n${result.stderr.trim()}` : "";
		throw new Error(`${error.message}${suffix}`);
	}
	console.log(`${graph} npm audit JSON verified: zero vulnerabilities.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runAudit(process.argv[2]);

import { verifyAuditJson } from "./verify-audit.mjs";

verifyAuditJson(JSON.stringify({ metadata: { vulnerabilities: { total: 0 } }, vulnerabilities: {} }), "fixture");
console.log("passed: accepts zero-vulnerability JSON audit");
for (const severity of ["low", "moderate", "high", "critical"]) {
	let rejected = false;
	try {
		verifyAuditJson(JSON.stringify({ metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: { fixture: { severity } } }), "fixture");
	} catch { rejected = true; }
	if (!rejected) throw new Error(`expected ${severity} audit fixture rejection`);
	console.log(`passed: rejects ${severity} audit fixture`);
}
for (const [name, output] of [
	["malformed output", "not json"],
	["metadata mismatch", JSON.stringify({ metadata: { vulnerabilities: { total: 0 } }, vulnerabilities: { hidden: {} } })],
	["missing metadata", JSON.stringify({ vulnerabilities: {} })],
]) {
	let rejected = false;
	try { verifyAuditJson(output, "fixture"); } catch { rejected = true; }
	if (!rejected) throw new Error(`expected ${name} rejection`);
	console.log(`passed: rejects ${name}`);
}

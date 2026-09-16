import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyLifecycle } from "./verify-lifecycle.mjs";

const hooks = ["preinstall", "install", "postinstall", "prepublish", "preprepare", "prepare", "postprepare", "prepack", "postpack", "prepublishOnly", "preversion", "version", "postversion", "publish", "postpublish", "prestart", "start", "poststart", "prestop", "stop", "poststop", "prerestart", "restart", "postrestart", "dependencies"];
const allowedPath = "node_modules/allowed";
const linkedPath = "node_modules/linked";
const workspacePath = "packages/linked";
const implicitPath = "node_modules/implicit-install";
const integrity = "sha512-allowed";
const linkedIntegrity = "sha512-linked";
const implicitIntegrity = "sha512-implicit";

function fingerprint(path, value) { return { path, version: value.version ?? null, integrity: value.integrity ?? null, optional: value.optional === true, os: value.os ?? [], cpu: value.cpu ?? [], link: value.link === true, resolved: value.resolved ?? null }; }
function metadata(path, value, scripts) { return { ...fingerprint(path, value), hasInstallScript: value.hasInstallScript === true, scripts }; }
function fixture() {
	const root = mkdtempSync(join(tmpdir(), "verify-lifecycle-"));
	const lock = { name: "fixture", lockfileVersion: 3, packages: {
		"": { name: "fixture", version: "1.0.0" },
		[allowedPath]: { version: "1.0.0", integrity },
		[linkedPath]: { version: "1.0.0", integrity: linkedIntegrity, resolved: workspacePath, link: true },
		[implicitPath]: { version: "2.0.0", integrity: implicitIntegrity, hasInstallScript: true },
	} };
	const review = {
		lifecycleHookNames: hooks,
		rootPackage: { path: "", version: "1.0.0", scripts: {} },
		packages: [metadata(allowedPath, lock.packages[allowedPath], { prepack: "node pack.js" }), metadata(linkedPath, lock.packages[linkedPath], { prepack: "node linked-pack.js" })],
		optionalLockOnlyPackages: [],
		lockInstallScriptPackages: [metadata(implicitPath, lock.packages[implicitPath], undefined)],
		lockPackageFingerprints: Object.entries(lock.packages).map(([path, value]) => fingerprint(path, value)).sort((a, b) => a.path.localeCompare(b.path)),
	};
	mkdirSync(join(root, "scripts"));
	mkdirSync(join(root, allowedPath), { recursive: true });
	mkdirSync(join(root, workspacePath), { recursive: true });
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0", scripts: {} }));
	writeFileSync(join(root, "package-lock.json"), JSON.stringify(lock));
	writeFileSync(join(root, "scripts/lifecycle-review.json"), JSON.stringify(review));
	writeFileSync(join(root, allowedPath, "package.json"), JSON.stringify({ name: "allowed", version: "1.0.0", scripts: { prepack: "node pack.js" } }));
	writeFileSync(join(root, workspacePath, "package.json"), JSON.stringify({ name: "linked", version: "1.0.0", scripts: { prepack: "node linked-pack.js" } }));
	symlinkSync("../packages/linked", join(root, linkedPath));
	return root;
}
function run(name, mutate, passes) {
	const root = fixture();
	try {
		mutate(root);
		let passed = true;
		try { verifyLifecycle(root); } catch { passed = false; }
		if (passed !== passes) throw new Error(`${name}: expected ${passes ? "success" : "failure"}`);
		console.log(`passed: ${name}`);
	} finally { rmSync(root, { recursive: true, force: true }); }
}
function packageJson(root, path) { return join(root, path, "package.json"); }
function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function writeJson(path, value) { writeFileSync(path, JSON.stringify(value)); }

run("accepts reviewed implicit install metadata and linked workspace", () => {}, true);
run("rejects root postinstall", (root) => { const path = join(root, "package.json"); const value = readJson(path); value.scripts.postinstall = "node install.js"; writeJson(path, value); }, false);
run("rejects root prepack", (root) => { const path = join(root, "package.json"); const value = readJson(path); value.scripts.prepack = "node pack.js"; writeJson(path, value); }, false);
run("rejects root precheck hook", (root) => { const path = join(root, "package.json"); const value = readJson(path); value.scripts.precheck = "node precheck.js"; writeJson(path, value); }, false);
run("rejects root preverify hook", (root) => { const path = join(root, "package.json"); const value = readJson(path); value.scripts.preverify = "node preverify.js"; writeJson(path, value); }, false);
run("rejects dependencies hook",  (root) => { const path = packageJson(root, allowedPath); const value = readJson(path); value.scripts.dependencies = "node deps.js"; writeJson(path, value); }, false);
run("rejects linked workspace changed hook", (root) => { const path = packageJson(root, workspacePath); const value = readJson(path); value.scripts.prepack = "node changed.js"; writeJson(path, value); }, false);
run("rejects canonical hook-set omission", (root) => { const path = join(root, "scripts/lifecycle-review.json"); const value = readJson(path); value.lifecycleHookNames = value.lifecycleHookNames.filter((name) => name !== "dependencies"); writeJson(path, value); }, false);
run("rejects new lock hasInstallScript without manifest", (root) => { const path = join(root, "package-lock.json"); const value = readJson(path); value.packages["node_modules/new-implicit"] = { version: "1.0.0", integrity: "sha512-new", hasInstallScript: true }; writeJson(path, value); }, false);
run("rejects absent optional hasInstallScript=false lock package", (root) => { const path = join(root, "package-lock.json"); const value = readJson(path); value.packages["node_modules/optional-absent"] = { version: "1.0.0", integrity: "sha512-optional", optional: true, os: ["win32"] }; writeJson(path, value); }, false);
run("rejects added installed package hook", (root) => { const directory = join(root, "node_modules/added"); mkdirSync(directory); writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "added", version: "1.0.0", scripts: { postinstall: "node install.js" } })); const path = join(root, "package-lock.json"); const value = readJson(path); value.packages["node_modules/added"] = { version: "1.0.0", integrity: "sha512-added" }; writeJson(path, value); }, false);
run("rejects removed reviewed package", (root) => { rmSync(join(root, allowedPath), { recursive: true }); }, false);
run("rejects changed hook command", (root) => { const path = packageJson(root, allowedPath); const value = readJson(path); value.scripts.prepack = "node changed.js"; writeJson(path, value); }, false);
run("rejects changed version", (root) => { const path = packageJson(root, allowedPath); const value = readJson(path); value.version = "1.0.1"; writeJson(path, value); }, false);
run("rejects changed integrity", (root) => { const path = join(root, "package-lock.json"); const value = readJson(path); value.packages[allowedPath].integrity = "sha512-changed"; writeJson(path, value); }, false);

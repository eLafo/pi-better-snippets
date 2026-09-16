import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const canonicalLifecycleHookNames = ["preinstall", "install", "postinstall", "prepublish", "preprepare", "prepare", "postprepare", "prepack", "postpack", "prepublishOnly", "preversion", "version", "postversion", "publish", "postpublish", "prestart", "start", "poststart", "prestop", "stop", "poststop", "prerestart", "restart", "postrestart", "dependencies"];

function sortObject(value) { return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))); }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function metadata(path, manifest, locked) {
	return { path, version: manifest?.version ?? locked?.version ?? null, integrity: locked?.integrity ?? null, optional: locked?.optional === true, os: locked?.os ?? [], cpu: locked?.cpu ?? [], link: locked?.link === true, resolved: locked?.resolved ?? null, hasInstallScript: locked?.hasInstallScript === true };
}
function fingerprint(path, locked) {
	return { path, version: locked.version ?? null, integrity: locked.integrity ?? null, optional: locked.optional === true, os: locked.os ?? [], cpu: locked.cpu ?? [], link: locked.link === true, resolved: locked.resolved ?? null };
}

export function verifyLifecycle(rootDirectory = process.env.LIFECYCLE_ROOT ?? process.cwd()) {
	const root = resolve(rootDirectory);
	const rootReal = realpathSync(root);
	const failMessages = [];
	const fail = (message) => failMessages.push(message);
	const rootFile = (...parts) => join(root, ...parts);
	const lock = JSON.parse(readFileSync(rootFile("package-lock.json"), "utf8"));
	const review = JSON.parse(readFileSync(rootFile("scripts", "lifecycle-review.json"), "utf8"));
	const lifecycleNames = new Set(canonicalLifecycleHookNames);
	if (!equal(review.lifecycleHookNames, canonicalLifecycleHookNames)) fail("reviewed lifecycle hook set must exactly equal the canonical policy set");
	const withinRoot = (path) => path === rootReal || path.startsWith(`${rootReal}/`);
	const logicalPath = (path) => relative(root, path).replaceAll("\\", "/");
	function manifestHooks(manifest) { return sortObject(Object.fromEntries(Object.entries(manifest.scripts ?? {}).filter(([name]) => lifecycleNames.has(name)))); }
	function scanPackages(directory = rootFile("node_modules"), visited = new Set()) {
		const found = [];
		if (!existsSync(directory)) return found;
		const realDirectory = realpathSync(directory);
		if (!withinRoot(realDirectory)) { fail(`node_modules target escapes repository: ${logicalPath(directory)}`); return found; }
		if (visited.has(realDirectory)) return found;
		visited.add(realDirectory);
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory() || entry.isSymbolicLink()) {
				let target;
				try { target = realpathSync(path); } catch { fail(`unresolvable node_modules link: ${logicalPath(path)}`); continue; }
				if (!withinRoot(target)) { fail(`node_modules link escapes repository: ${logicalPath(path)}`); continue; }
				if (statSync(path).isDirectory()) found.push(...scanPackages(path, visited));
			} else if (entry.isFile() && entry.name === "package.json") {
				const manifest = JSON.parse(readFileSync(path, "utf8"));
				const scripts = manifestHooks(manifest);
				if (Object.keys(scripts).length > 0) {
					const packagePath = logicalPath(path.slice(0, -"/package.json".length));
					const locked = lock.packages[packagePath];
					if (!locked) fail(`installed manifest is absent from lockfile: ${packagePath}`);
					found.push({ ...metadata(packagePath, manifest, locked), scripts });
				}
			}
		}
		return found.sort((a, b) => a.path.localeCompare(b.path));
	}
	function compare(expected, actual, label, keys) { for (const key of keys) if (!equal(actual[key], expected[key])) fail(`${label} ${expected.path ?? "root"} ${key} changed`); }
	function lockInventory() { return Object.entries(lock.packages).filter(([, entry]) => entry.hasInstallScript === true).map(([path, entry]) => metadata(path, undefined, entry)).sort((a, b) => a.path.localeCompare(b.path)); }
	function lockFingerprints() { return Object.entries(lock.packages).map(([path, entry]) => fingerprint(path, entry)).sort((a, b) => a.path.localeCompare(b.path)); }
	function validateLinks() {
		for (const [path, entry] of Object.entries(lock.packages).filter(([, value]) => value.link === true)) {
			const location = rootFile(path);
			if (!existsSync(location) || !lstatSync(location).isSymbolicLink()) { fail(`lock link is not an installed symlink: ${path}`); continue; }
			const target = realpathSync(location);
			if (!withinRoot(target)) { fail(`lock link target escapes repository: ${path}`); continue; }
			if (!existsSync(join(target, "package.json"))) { fail(`lock link target has no package manifest: ${path}`); continue; }
			if (entry.resolved) {
				const resolvedTarget = realpathSync(resolve(root, entry.resolved));
				if (!withinRoot(resolvedTarget) || resolvedTarget !== target) fail(`lock link target differs from resolved target: ${path}`);
			}
			const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
			if (entry.version && manifest.version !== entry.version) fail(`lock link target version changed: ${path}`);
		}
	}

	const rootManifest = JSON.parse(readFileSync(rootFile("package.json"), "utf8"));
	const actualRoot = { path: "", version: rootManifest.version, scripts: sortObject(rootManifest.scripts ?? {}) };
	if (!review.rootPackage) fail("reviewed root package script inventory is missing"); else compare(review.rootPackage, actualRoot, "root manifest", ["path", "version", "scripts"]);
	validateLinks();

	const actualFingerprints = lockFingerprints();
	const expectedFingerprints = [...(review.lockPackageFingerprints ?? [])].sort((a, b) => a.path.localeCompare(b.path));
	if (actualFingerprints.length !== expectedFingerprints.length) fail(`expected ${expectedFingerprints.length} lock package fingerprints, found ${actualFingerprints.length}`);
	for (const entry of expectedFingerprints) {
		const found = actualFingerprints.find((candidate) => candidate.path === entry.path);
		if (!found) fail(`reviewed lock package fingerprint is absent: ${entry.path}`); else compare(entry, found, "lock package fingerprint", ["path", "version", "integrity", "optional", "os", "cpu", "link", "resolved"]);
	}
	for (const entry of actualFingerprints) if (!expectedFingerprints.some((candidate) => candidate.path === entry.path)) fail(`unreviewed lock package fingerprint: ${entry.path}@${entry.version}`);

	const actualInstalled = scanPackages();
	const optionalExpected = review.optionalLockOnlyPackages ?? [];
	const optionalPaths = new Set(optionalExpected.map((entry) => entry.path));
	const expectedInstalled = [...review.packages].sort((a, b) => a.path.localeCompare(b.path));
	const manifestInstalled = actualInstalled.filter((entry) => !optionalPaths.has(entry.path));
	if (manifestInstalled.length !== expectedInstalled.length) fail(`expected ${expectedInstalled.length} installed lifecycle manifests, found ${manifestInstalled.length}`);
	for (const entry of expectedInstalled) {
		const found = manifestInstalled.find((candidate) => candidate.path === entry.path);
		if (!found) fail(`reviewed lifecycle manifest is absent: ${entry.path}`); else compare(entry, found, "manifest", ["path", "version", "integrity", "optional", "os", "cpu", "link", "resolved", "hasInstallScript", "scripts"]);
	}
	for (const entry of manifestInstalled) if (!expectedInstalled.some((candidate) => candidate.path === entry.path)) fail(`unreviewed lifecycle manifest: ${entry.path}@${entry.version}`);
	for (const entry of optionalExpected) {
		const found = actualInstalled.find((candidate) => candidate.path === entry.path);
		if (found) compare(entry, found, "optional manifest", ["path", "version", "integrity", "optional", "os", "cpu", "link", "resolved", "hasInstallScript", "scripts"]);
		else if (entry.os.includes(process.platform)) fail(`optional lifecycle manifest is missing on supported platform: ${entry.path}`);
	}

	const actualLockInstall = lockInventory();
	const expectedLockInstall = [...(review.lockInstallScriptPackages ?? [])].sort((a, b) => a.path.localeCompare(b.path));
	if (actualLockInstall.length !== expectedLockInstall.length) fail(`expected ${expectedLockInstall.length} hasInstallScript lock entries, found ${actualLockInstall.length}`);
	for (const entry of expectedLockInstall) {
		const found = actualLockInstall.find((candidate) => candidate.path === entry.path);
		if (!found) fail(`reviewed hasInstallScript lock entry is absent: ${entry.path}`); else compare(entry, found, "hasInstallScript lock entry", ["path", "version", "integrity", "optional", "os", "cpu", "link", "resolved", "hasInstallScript"]);
	}
	for (const entry of actualLockInstall) if (!expectedLockInstall.some((candidate) => candidate.path === entry.path)) fail(`unreviewed hasInstallScript lock entry: ${entry.path}@${entry.version}`);

	if (failMessages.length > 0) throw new Error(`Lifecycle inventory verification failed:\n${failMessages.map((message) => `- ${message}`).join("\n")}`);
	console.log(`Lifecycle inventory verified: ${Object.keys(actualRoot.scripts).length} reviewed root scripts, ${expectedInstalled.length} installed manifests, ${optionalExpected.length} optional lock-only records, ${expectedLockInstall.length} hasInstallScript lock entries, and ${expectedFingerprints.length} lock fingerprints.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) verifyLifecycle();

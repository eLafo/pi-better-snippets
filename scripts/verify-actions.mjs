import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isAlias, isMap, isScalar, isSeq, parseAllDocuments } from "yaml";

const literalAction = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[a-f0-9]{40}$/;

export function workflowFiles(directory) {
	if (!existsSync(directory)) throw new Error(`workflow directory does not exist: ${directory}`);
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return workflowFiles(path);
		return entry.isFile() && /\.ya?ml$/i.test(entry.name) ? [path] : [];
	});
}

function rejectAliasesAndMerges(node, file) {
	if (isAlias(node)) throw new Error(`${file} contains a YAML alias, which is not allowed in workflows`);
	if (isMap(node)) {
		for (const pair of node.items) {
			if (isScalar(pair.key) && pair.key.value === "<<") throw new Error(`${file} contains a YAML merge key, which is not allowed in workflows`);
			rejectAliasesAndMerges(pair.key, file);
			rejectAliasesAndMerges(pair.value, file);
		}
	} else if (isSeq(node)) {
		for (const item of node.items) rejectAliasesAndMerges(item, file);
	}
}

function findUses(node, file, references) {
	if (isMap(node)) {
		for (const pair of node.items) {
			if (isScalar(pair.key) && pair.key.value === "uses") {
				const value = isScalar(pair.value) && typeof pair.value.value === "string" ? pair.value.value : undefined;
				references.push({ file, reference: value });
				if (!value || !literalAction.test(value)) {
					throw new Error(`${file} uses a non-literal owner/repo@40hex reference: ${value ?? "<non-scalar>"}`);
				}
			}
			findUses(pair.key, file, references);
			findUses(pair.value, file, references);
		}
	} else if (isSeq(node)) {
		for (const item of node.items) findUses(item, file, references);
	}
}

export function verifyActions(workflowDirectory = process.env.WORKFLOW_DIRECTORY ?? ".github/workflows") {
	const references = [];
	for (const path of workflowFiles(workflowDirectory)) {
		const file = relative(workflowDirectory, path);
		const documents = parseAllDocuments(readFileSync(path, "utf8"));
		for (const document of documents) {
			if (document.errors.length > 0) throw new Error(`${file} is invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`);
			rejectAliasesAndMerges(document.contents, file);
			findUses(document.contents, file, references);
		}
	}
	if (references.length === 0) throw new Error(`no uses references found in ${workflowDirectory}`);
	return references;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const references = verifyActions();
	console.log(`All ${references.length} workflow action references are pinned to literal full commit SHAs.`);
}

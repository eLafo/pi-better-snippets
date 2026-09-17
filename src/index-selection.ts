/**
 * Parses and validates snippet indexes at the command and picker boundaries.
 */

const MAX_SAFE_INTEGER_TEXT = String(Number.MAX_SAFE_INTEGER);

/** A canonical one-based index requested through the command. */
export interface RequestedSnippetIndex {
	value: number;
	input: string;
}

/**
 * Parses a canonical, exactly representable one-based command index.
 *
 * @param value - Trimmed command argument.
 * @returns The parsed index and original input, or `undefined` if invalid.
 */
export function parseSnippetIndex(value: string): RequestedSnippetIndex | undefined {
	if (!/^[1-9]\d*$/.test(value)) return undefined;
	if (value.length > MAX_SAFE_INTEGER_TEXT.length) return undefined;
	if (value.length === MAX_SAFE_INTEGER_TEXT.length && value > MAX_SAFE_INTEGER_TEXT) return undefined;
	return { value: Number(value), input: value };
}

/**
 * Validates the zero-based index returned by a picker before indexing snippets.
 *
 * @param value - Picker result.
 * @param snippetCount - Number of available snippets.
 * @returns Whether `value` can safely index the snippet list.
 */
export function isValidSnippetSelection(value: unknown, snippetCount: number): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < snippetCount;
}

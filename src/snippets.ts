/**
 * @packageDocumentation
 *
 * Parses CommonMark-style fenced blocks and finds them in Pi session messages.
 * The parser preserves the original snippet body so clipboard operations never use
 * terminal-rendered or sanitized content.
 */

/**
 * A complete fenced block parsed from assistant Markdown.
 *
 * @public
 */
export interface CodeSnippet {
	/** Copyable body, excluding both fence lines. */
	code: string;
	/** Complete trimmed info string following the opening fence. */
	info: string;
	/** First whitespace-delimited token in {@link info}, when present. */
	language?: string;
	/** One-based opening-fence line number. */
	startLine: number;
	/** One-based closing-fence line number. */
	endLine: number;
}

/**
 * One source line and its UTF-16 offsets in the Markdown input.
 *
 * @public
 */
export interface SourceLine {
	/** Text excluding its line ending. */
	text: string;
	/** Inclusive offset of the line text. */
	start: number;
	/** Exclusive offset immediately before the line ending. */
	contentEnd: number;
	/** Exclusive offset immediately after the line ending. */
	end: number;
}

interface AssistantMessageLike {
	role: "assistant";
	content: readonly unknown[];
}

/**
 * Splits Markdown into offset-aware lines, supporting LF, CRLF, and CR endings.
 *
 * @param markdown - Source text to split.
 * @returns Lines in source order; each line retains offsets into `markdown`.
 * @public
 */
export function sourceLines(markdown: string): SourceLine[] {
	const lines: SourceLine[] = [];
	const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(markdown))) {
		const [whole, text] = match;
		if (!whole) break;
		lines.push({
			text,
			start: match.index,
			contentEnd: match.index + text.length,
			end: match.index + whole.length,
		});
	}
	return lines;
}

/**
 * Extracts complete CommonMark-style fenced blocks.
 *
 * @remarks
 * Incomplete fences and invalid backtick info strings are ignored. Structural
 * trailing newlines are excluded from {@link CodeSnippet.code}.
 *
 * @param markdown - Assistant Markdown to inspect.
 * @returns Snippets in their source order.
 * @public
 */
export function extractFencedCodeBlocks(markdown: string): CodeSnippet[] {
	const lines = sourceLines(markdown);
	const snippets: CodeSnippet[] = [];

	for (let index = 0; index < lines.length; index++) {
		const opener = lines[index]!.text.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/);
		if (!opener) continue;

		const indentation = opener[1]!.length;
		const marker = opener[2]![0]!;
		const fenceLength = opener[2]!.length;
		const info = opener[3]!.trim();
		if (marker === "`" && info.includes("`")) continue;

		let closingIndex = -1;
		for (let candidate = index + 1; candidate < lines.length; candidate++) {
			const closing = lines[candidate]!.text.match(/^ {0,3}(`+|~+)[ \t]*$/);
			if (closing && closing[1]![0] === marker && closing[1]!.length >= fenceLength) {
				closingIndex = candidate;
				break;
			}
		}
		if (closingIndex < 0) continue;

		const contentLines = lines.slice(index + 1, closingIndex);
		const code = contentLines.map((line, contentIndex) => {
			const leadingSpaces = line.text.match(/^ */)?.[0].length ?? 0;
			const text = line.text.slice(Math.min(indentation, leadingSpaces));
			const lineEnding = markdown.slice(line.contentEnd, line.end);
			return contentIndex === contentLines.length - 1 ? text : text + lineEnding;
		}).join("");
		const language = info.split(/\s+/, 1)[0] || undefined;
		snippets.push({ code, info, language, startLine: index + 1, endLine: closingIndex + 1 });
		index = closingIndex;
	}

	return snippets;
}

/**
 * Narrows an unknown Pi message to the assistant-message shape used by this extension.
 *
 * @param message - Value received from the Pi session tree.
 * @returns `true` when the value is an assistant message with array content.
 * @public
 */
export function isAssistantMessage(message: unknown): message is AssistantMessageLike {
	if (!message || typeof message !== "object") return false;
	const candidate = message as { role?: unknown; content?: unknown };
	return candidate.role === "assistant" && Array.isArray(candidate.content);
}

function isTextContentBlock(block: unknown): block is { type: "text"; text: string } {
	if (!block || typeof block !== "object") return false;
	const candidate = block as { type?: unknown; text?: unknown };
	return candidate.type === "text" && typeof candidate.text === "string";
}

/**
 * Extracts fenced snippets from text content blocks of one assistant message.
 *
 * @param message - Potential Pi message.
 * @returns Parsed snippets, or an empty array for non-assistant messages.
 * @public
 */
export function snippetsFromAssistantMessage(message: unknown): CodeSnippet[] {
	if (!isAssistantMessage(message)) return [];
	return message.content.flatMap((block) => isTextContentBlock(block) ? extractFencedCodeBlocks(block.text) : []);
}

/**
 * Returns snippets in the most recent assistant message in a session branch.
 *
 * @param entries - Pi session branch entries in chronological order.
 * @returns Parsed snippets from the latest assistant message, or an empty array.
 * @public
 */
export function latestAssistantSnippets(entries: readonly unknown[]): CodeSnippet[] {
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index];
		if (!entry || typeof entry !== "object") continue;
		const candidate = entry as { type?: string; message?: unknown };
		if (candidate.type === "message" && isAssistantMessage(candidate.message)) {
			return snippetsFromAssistantMessage(candidate.message);
		}
	}
	return [];
}

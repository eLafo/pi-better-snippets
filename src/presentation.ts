/**
 * @packageDocumentation
 *
 * Produces bounded terminal-safe presentation text for untrusted assistant content.
 * Rendering transformations never alter the original snippet body used for copying.
 */
import { highlightCode, type Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { translate } from "./messages.js";
import { extractFencedCodeBlocks, sourceLines, type CodeSnippet } from "./snippets.js";

const ANSI_SEQUENCE = /(\x1b\[[0-?]*[ -/]*[@-~])/g;
const MARKDOWN_PUNCTUATION = /([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const UNSAFE_DISPLAY_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const EXTENDED_PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u;
const EMOJI_JOINER_MODIFIER = /^(?:\p{Emoji_Modifier}|\p{M}|\uFE0E|\uFE0F)$/u;
const MAX_DISPLAY_MARKDOWN_GRAPHEMES = 128_000;
const MAX_DISPLAY_CODE_GRAPHEMES = 16_384;
const MAX_DISPLAY_LANGUAGE_GRAPHEMES = 64;
const MAX_PREVIEW_GRAPHEMES = 72;
const MAX_INDEX_DIAGNOSTIC_GRAPHEMES = 64;
const HIGHLIGHT_LANGUAGES = new Set([
	"bash", "c", "cpp", "csharp", "css", "diff", "go", "html", "java", "javascript", "json", "jsx",
	"kotlin", "markdown", "md", "php", "python", "ruby", "rust", "shell", "sql", "swift", "text", "toml",
	"ts", "tsx", "typescript", "xml", "yaml", "yml",
]);
const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function truncateGraphemes(value: string, maximum: number, suffix = "…"): string {
	const segments: string[] = [];
	const suffixLength = Array.from(GRAPHEME_SEGMENTER.segment(suffix)).length;
	for (const { segment } of GRAPHEME_SEGMENTER.segment(value)) {
		if (segments.length === maximum) {
			return segments.slice(0, Math.max(0, maximum - suffixLength)).join("") + suffix;
		}
		segments.push(segment);
	}
	return segments.join("");
}

/** Limits display work even when one grapheme contains an unbounded run of combining marks. */
function truncateDisplayCost(value: string, maximum: number): string {
	let codeUnits = 0;
	let codePoints = 0;
	let end = 0;
	let previousEnd = 0;
	for (const codePoint of value) {
		const nextCodeUnits = codeUnits + codePoint.length;
		const nextCodePoints = codePoints + 1;
		if (nextCodeUnits > maximum || nextCodePoints > maximum) {
			if (codeUnits + 1 <= maximum && codePoints + 1 <= maximum) return value.slice(0, end) + "…";
			return value.slice(0, previousEnd) + "…";
		}
		previousEnd = end;
		end += codePoint.length;
		codeUnits = nextCodeUnits;
		codePoints = nextCodePoints;
	}
	return value;
}

/** A joiner is safe only when its complete grapheme is an emoji ZWJ sequence. */
function isCompleteEmojiJoinerGrapheme(segment: string): boolean {
	let sawPictograph = false;
	let needsPictograph = false;
	for (const character of segment) {
		if (EXTENDED_PICTOGRAPHIC.test(character)) {
			sawPictograph = true;
			needsPictograph = false;
			continue;
		}
		if (character === "\u200D") {
			if (!sawPictograph || needsPictograph) return false;
			needsPictograph = true;
			continue;
		}
		if (!sawPictograph || !EMOJI_JOINER_MODIFIER.test(character)) return false;
	}
	return sawPictograph && !needsPictograph;
}

/** Sanitizes graphemes in linear time while retaining only complete emoji ZWJ sequences. */
function sanitizeDisplayText(value: string): string {
	const sanitized: string[] = [];
	for (const { segment } of GRAPHEME_SEGMENTER.segment(value)) {
		const preserveJoiners = segment.includes("\u200D") && isCompleteEmojiJoinerGrapheme(segment);
		for (const character of segment) {
			sanitized.push(
				character === "\n" ||
				(character === "\u200D" && preserveJoiners) ||
				!UNSAFE_DISPLAY_CHARACTERS.test(character)
					? character
					: "�",
			);
		}
	}
	return sanitized.join("");
}

/** Converts untrusted assistant text into bounded terminal-safe display text without changing stored snippets. */
function displayText(value: string, maximum: number): string {
	const source = truncateDisplayCost(value, maximum);
	const normalized = source.replaceAll(/\r\n|\r/g, "\n").replaceAll("\t", "    ");
	return truncateGraphemes(truncateDisplayCost(sanitizeDisplayText(normalized), maximum), maximum);
}

/**
 * Converts untrusted Markdown into bounded terminal-safe display text.
 *
 * @param markdown - Untrusted assistant Markdown.
 * @returns Sanitized display text with normalized line endings and tabs.
 * @public
 */
export function displayMarkdown(markdown: string): string {
	return displayText(markdown, MAX_DISPLAY_MARKDOWN_GRAPHEMES);
}

/**
 * Converts an untrusted error message into a bounded notification detail.
 *
 * @param message - Error text to show in the TUI.
 * @returns A terminal-safe single detail string.
 * @public
 */
export function displayErrorDetail(message: string): string {
	return displayText(message, MAX_DISPLAY_LANGUAGE_GRAPHEMES);
}

/**
 * Returns a bounded, terminal-safe language label, with a localized plain-text fallback.
 *
 * @param language - Parsed fence language, if any.
 * @param locale - Requested UI locale.
 * @returns Safe text suitable for a terminal label.
 * @public
 */
export function displayLanguage(language: string | undefined, locale?: string): string {
	return displayText(language || translate("plainText", locale), MAX_DISPLAY_LANGUAGE_GRAPHEMES);
}

/**
 * Formats untrusted command input safely for a one-line error diagnostic.
 *
 * @param value - Raw command argument.
 * @returns Bounded display text with line breaks made visible.
 * @public
 */
export function displayIndexDiagnostic(value: string): string {
	return displayText(value, MAX_INDEX_DIAGNOSTIC_GRAPHEMES).replaceAll("\n", "↵");
}

/**
 * Constrains rendered terminal rows to a valid visible width.
 *
 * @param rows - ANSI-capable terminal rows.
 * @param width - Requested terminal width; invalid values degrade to one column.
 * @returns Rows truncated without adding an ellipsis.
 * @public
 */
export function boundedRows(rows: string[], width: number): string[] {
	const availableWidth = typeof width === "number" && Number.isFinite(width)
		? Math.max(1, Math.floor(width))
		: 1;
	return rows.map((row) => truncateToWidth(row, availableWidth, ""));
}

function highlightLanguage(language: string | undefined): string | undefined {
	const safeLanguage = language && displayText(language, MAX_DISPLAY_LANGUAGE_GRAPHEMES).toLowerCase();
	return safeLanguage && HIGHLIGHT_LANGUAGES.has(safeLanguage) ? safeLanguage : undefined;
}

function escapeMarkdownOutsideAnsi(value: string): string {
	return value.split(ANSI_SEQUENCE).map((part) =>
		part.startsWith("\x1b[") ? part : part.replace(MARKDOWN_PUNCTUATION, "\\$1")
	).join("");
}

/**
 * Produces bounded, sanitized highlighted lines for snippet panels and pickers.
 *
 * @param snippet - Parsed source snippet; its stored code is not modified.
 * @param theme - Pi theme providing syntax colors.
 * @param locale - Requested UI locale.
 * @returns One terminal-safe highlighted row per source line.
 * @public
 */
export function highlightedSnippetLines(snippet: CodeSnippet, theme: Theme, locale?: string): string[] {
	const code = displayText(snippet.code, MAX_DISPLAY_CODE_GRAPHEMES);
	return code
		? highlightCode(code, highlightLanguage(snippet.language))
		: [theme.fg("mdCodeBlock", translate("emptySnippet", locale))];
}

function decoratedSnippet(snippet: CodeSnippet, snippetIndex: number, width: number, theme: Theme, locale?: string): string {
	const panelWidth = Math.max(1, width);
	const bodyWidth = Math.max(1, panelWidth - 2);
	const codeWidth = Math.max(1, bodyWidth - 2);
	const highlightedLines = highlightedSnippetLines(snippet, theme, locale);
	const visualLines = highlightedLines.flatMap((line) => wrapTextWithAnsi(line || " ", codeWidth));
	const fit = (value: string, targetWidth: number) => {
		const truncated = truncateToWidth(value, targetWidth, "");
		return truncated + " ".repeat(Math.max(0, targetWidth - visibleWidth(truncated)));
	};
	if (panelWidth < 5) {
		return visualLines.map((line) => escapeMarkdownOutsideAnsi(fit(line, panelWidth))).join("\n");
	}

	const language = displayLanguage(snippet.language, locale);
	const label = ` [${snippetIndex + 1}] ${language} `;
	const top = theme.fg(
		"borderMuted",
		`╭─${truncateToWidth(label, Math.max(0, panelWidth - 4), "")}${"─".repeat(Math.max(0, panelWidth - 3 - Math.min(visibleWidth(label), Math.max(0, panelWidth - 4))))}╮`,
	);
	const bottom = theme.fg("borderMuted", `╰${"─".repeat(Math.max(0, panelWidth - 2))}╯`);
	const rows = visualLines.map((line) =>
		theme.fg("borderMuted", "│") +
		theme.bg("toolPendingBg", ` ${fit(line, codeWidth)} `) +
		theme.fg("borderMuted", "│")
	);
	return [top, ...rows, bottom].map(escapeMarkdownOutsideAnsi).join("\n");
}

/**
 * Decorates complete assistant code fences for display without changing stored Markdown.
 *
 * @param markdown - Original assistant Markdown.
 * @param availableWidth - Width available to the rendered panel.
 * @param theme - Pi theme used for borders and syntax colors.
 * @param locale - Requested UI locale.
 * @returns Markdown with complete fences replaced by safe visual panels.
 * @public
 */
export function decorateAssistantSnippets(markdown: string, availableWidth: number, theme: Theme, locale?: string): string {
	const safeMarkdown = displayMarkdown(markdown);
	const snippets = extractFencedCodeBlocks(safeMarkdown);
	if (snippets.length === 0) return safeMarkdown;

	const lines = sourceLines(safeMarkdown);
	let decorated = safeMarkdown;
	for (let index = snippets.length - 1; index >= 0; index--) {
		const snippet = snippets[index]!;
		const opener = lines[snippet.startLine - 1]!;
		const closer = lines[snippet.endLine - 1]!;
		const trailingLineEnding = safeMarkdown.slice(closer.contentEnd, closer.end);
		const replacement = decoratedSnippet(snippet, index, availableWidth, theme, locale) + trailingLineEnding;
		decorated = decorated.slice(0, opener.start) + replacement + decorated.slice(closer.end);
	}
	return decorated;
}

function lineCount(code: string): number {
	return code ? code.split(/\r\n|\n|\r/).length : 0;
}

function preview(code: string, locale?: string): string {
	const firstContentLine = displayText(code, MAX_DISPLAY_CODE_GRAPHEMES).split("\n").find((line) => line.trim())?.trim() || translate("emptyPreview", locale);
	return truncateGraphemes(firstContentLine, MAX_PREVIEW_GRAPHEMES);
}

/**
 * Builds the localized, safe list label shown for a snippet picker entry.
 *
 * @param snippet - Snippet being labeled.
 * @param index - Zero-based position in the picker.
 * @param locale - Requested UI locale.
 * @returns Label containing its one-based number, language, line count, and preview.
 * @public
 */
export function snippetLabel(snippet: CodeSnippet, index: number, locale?: string): string {
	const count = lineCount(snippet.code);
	const lines = count === 1
		? translate("lineCountOne", { count }, locale)
		: translate("lineCountMany", { count }, locale);
	return translate("snippetLabel", {
		index: index + 1,
		language: displayLanguage(snippet.language, locale),
		lines,
		preview: preview(snippet.code, locale),
	}, locale);
}

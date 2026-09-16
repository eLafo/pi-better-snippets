import {
	copyToClipboard,
	highlightCode,
	type ExtensionAPI,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	truncateToWidth,
	type Component,
	type KeyId,
	type KeybindingsManager,
	type OverlayHandle,
	type OverlayOptions,
	type TUI,
	type TuiMouseEvent,
	type TuiMouseEventResult,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

const INDICATOR_KEY = "better-snippets";
const SHORTCUT = "ctrl+shift+c";

type MessageArgs = {
	emptySnippet: never; emptyPreview: never; plainText: never;
	snippetUnavailable: { number: number }; copyByNumber: never; pressNumber: { range: string };
	cancel: never; preview: never; rows: never; focus: never; select: never; scroll: never; copy: never;
	copied: { language: string }; copyFailed: { detail: string }; tuiOnly: never; noSnippets: never;
	usage: never; invalidIndex: { value: string }; invalidSnippet: { value: string; available: string };
	pickerFailed: never; pickerRenderFailed: never; numberPromptRenderFailed: never; invalidSelection: never;
	lineCountOne: { count: number }; lineCountMany: { count: number };
	snippetLabel: { index: number; language: string; lines: string; preview: string };
	promptHint: { range: string; cancelKey: string }; promptHintMany: { range: string; command: string; cancelKey: string };
	keyPageUp: never; keyPageDown: never; keyEnter: never; keyEscape: never; keyUnbound: never;
	keyTab: never; keySpace: never; keyBackspace: never; keyDelete: never; keyInsert: never; keyClear: never; keyHome: never; keyEnd: never;
	keyUp: never; keyDown: never; keyLeft: never; keyRight: never;
	keyF1: never; keyF2: never; keyF3: never; keyF4: never; keyF5: never; keyF6: never; keyF7: never; keyF8: never; keyF9: never; keyF10: never; keyF11: never; keyF12: never;
	compactTitle: never; pickerTitle: { focus: string }; listFocus: never; previewFocus: never;
	rangeOf: { start: number; end: number; total: number }; previewLines: { start: number; end: number };
	compactFooter: { arrows: string; confirm: string; cancelKey: string };
	widgetOne: { count: number; shortcut: string }; widgetMany: { count: number; shortcut: string };
	commandDescription: never; shortcutDescription: never;
};
type MessageKey = keyof MessageArgs;
type MessageKeyWithArgs = { [K in MessageKey]: MessageArgs[K] extends never ? never : K }[MessageKey];
type MessageKeyWithoutArgs = Exclude<MessageKey, MessageKeyWithArgs>;

type TranslationCatalog = { [K in MessageKey]: string };
/** Complete source catalog; validateTranslations verifies interpolation contracts. */
export const TRANSLATIONS = {
	en: {
		emptySnippet: "(empty snippet)", emptyPreview: "(empty)", plainText: "text",
		snippetUnavailable: "Snippet {number} is not available", copyByNumber: "Copy snippet by number", pressNumber: "Press {range}", cancel: "cancel", preview: "Preview", rows: "Rows", focus: "focus", select: "select", scroll: "scroll", copy: "copy",
		copied: "Copied {language} snippet to the clipboard", copyFailed: "Could not copy the snippet{detail}", tuiOnly: "Snippet copying is only available in the interactive TUI", noSnippets: "The latest assistant response has no fenced snippets", usage: "Usage: /copy-snippet [number]", invalidIndex: "Invalid snippet number: {value}", invalidSnippet: "Snippet {value} does not exist (available: {available})", pickerFailed: "Could not open the snippet picker. Please try again", pickerRenderFailed: "Snippet preview unavailable. Press Esc to cancel", numberPromptRenderFailed: "Snippet number picker unavailable. Press Esc to cancel", invalidSelection: "Could not select that snippet. Please try again",
		lineCountOne: "{count} line", lineCountMany: "{count} lines", snippetLabel: "{index}. {language} · {lines} — {preview}", promptHint: "{range} · {cancelKey} cancel", promptHintMany: "{range} · {command} · {cancelKey} cancel", keyPageUp: "PgUp", keyPageDown: "PgDn", keyEnter: "Enter", keyEscape: "Esc", keyUnbound: "unbound", keyTab: "Tab", keySpace: "Space", keyBackspace: "Backspace", keyDelete: "Delete", keyInsert: "Insert", keyClear: "Clear", keyHome: "Home", keyEnd: "End", keyUp: "↑", keyDown: "↓", keyLeft: "←", keyRight: "→", keyF1: "F1", keyF2: "F2", keyF3: "F3", keyF4: "F4", keyF5: "F5", keyF6: "F6", keyF7: "F7", keyF8: "F8", keyF9: "F9", keyF10: "F10", keyF11: "F11", keyF12: "F12", compactTitle: "Copy snippet · Preview", pickerTitle: "Copy snippet · {focus}", listFocus: "list", previewFocus: "preview", rangeOf: "{start}-{end} of {total}", previewLines: "lines {start}-{end}", compactFooter: "{arrows} scroll · {confirm} copy · {cancelKey} cancel", widgetOne: "{count} snippet · {shortcut} copy · /copy-snippet fallback", widgetMany: "{count} snippets · {shortcut} → number · /copy-snippet fallback", commandDescription: "Select and copy a fenced snippet from the latest assistant response", shortcutDescription: "Copy a fenced snippet by pressing its number; /copy-snippet is always available",
	},
	es: {
		emptySnippet: "(fragmento vacío)", emptyPreview: "(vacío)", plainText: "texto",
		snippetUnavailable: "El fragmento {number} no está disponible", copyByNumber: "Copiar fragmento por número", pressNumber: "Pulsa {range}", cancel: "cancelar", preview: "Vista previa", rows: "Filas", focus: "foco", select: "seleccionar", scroll: "desplazar", copy: "copiar",
		copied: "Fragmento {language} copiado al portapapeles", copyFailed: "No se pudo copiar el fragmento{detail}", tuiOnly: "La copia de fragmentos solo está disponible en la TUI interactiva", noSnippets: "La última respuesta del asistente no contiene fragmentos delimitados", usage: "Uso: /copy-snippet [número]", invalidIndex: "Número de fragmento no válido: {value}", invalidSnippet: "El fragmento {value} no existe (disponibles: {available})", pickerFailed: "No se pudo abrir el selector de fragmentos. Inténtalo de nuevo", pickerRenderFailed: "Vista previa no disponible. Pulsa Esc para cancelar", numberPromptRenderFailed: "Selector numérico no disponible. Pulsa Esc para cancelar", invalidSelection: "No se pudo seleccionar ese fragmento. Inténtalo de nuevo",
		lineCountOne: "{count} línea", lineCountMany: "{count} líneas", snippetLabel: "{index}. {language} · {lines} — {preview}", promptHint: "{range} · {cancelKey} cancelar", promptHintMany: "{range} · {command} · {cancelKey} cancelar", keyPageUp: "RePág", keyPageDown: "AvPág", keyEnter: "Intro", keyEscape: "Esc", keyUnbound: "sin asignar", keyTab: "Tab", keySpace: "Espacio", keyBackspace: "Retroceso", keyDelete: "Supr", keyInsert: "Insert", keyClear: "Borrar", keyHome: "Inicio", keyEnd: "Fin", keyUp: "↑", keyDown: "↓", keyLeft: "←", keyRight: "→", keyF1: "F1", keyF2: "F2", keyF3: "F3", keyF4: "F4", keyF5: "F5", keyF6: "F6", keyF7: "F7", keyF8: "F8", keyF9: "F9", keyF10: "F10", keyF11: "F11", keyF12: "F12", compactTitle: "Copiar fragmento · Vista previa", pickerTitle: "Copiar fragmento · {focus}", listFocus: "lista", previewFocus: "vista previa", rangeOf: "{start}-{end} de {total}", previewLines: "líneas {start}-{end}", compactFooter: "{arrows} desplazar · {confirm} copiar · {cancelKey} cancelar", widgetOne: "{count} fragmento · {shortcut} copiar · alternativa /copy-snippet", widgetMany: "{count} fragmentos · {shortcut} → número · alternativa /copy-snippet", commandDescription: "Selecciona y copia un fragmento delimitado de la última respuesta del asistente", shortcutDescription: "Copia un fragmento delimitado pulsando su número; /copy-snippet siempre está disponible",
	},
} satisfies Record<"en" | "es", TranslationCatalog>;

const MESSAGE_PLACEHOLDERS: { [K in MessageKey]: readonly (keyof MessageArgs[K])[] } = {
	emptySnippet: [], emptyPreview: [], plainText: [], snippetUnavailable: ["number"], copyByNumber: [], pressNumber: ["range"], cancel: [], preview: [], rows: [], focus: [], select: [], scroll: [], copy: [], copied: ["language"], copyFailed: ["detail"], tuiOnly: [], noSnippets: [], usage: [], invalidIndex: ["value"], invalidSnippet: ["value", "available"], pickerFailed: [], pickerRenderFailed: [], numberPromptRenderFailed: [], invalidSelection: [], lineCountOne: ["count"], lineCountMany: ["count"], snippetLabel: ["index", "language", "lines", "preview"], promptHint: ["range", "cancelKey"], promptHintMany: ["range", "command", "cancelKey"], keyPageUp: [], keyPageDown: [], keyEnter: [], keyEscape: [], keyUnbound: [], keyTab: [], keySpace: [], keyBackspace: [], keyDelete: [], keyInsert: [], keyClear: [], keyHome: [], keyEnd: [], keyUp: [], keyDown: [], keyLeft: [], keyRight: [], keyF1: [], keyF2: [], keyF3: [], keyF4: [], keyF5: [], keyF6: [], keyF7: [], keyF8: [], keyF9: [], keyF10: [], keyF11: [], keyF12: [], compactTitle: [], pickerTitle: ["focus"], listFocus: [], previewFocus: [], rangeOf: ["start", "end", "total"], previewLines: ["start", "end"], compactFooter: ["arrows", "confirm", "cancelKey"], widgetOne: ["count", "shortcut"], widgetMany: ["count", "shortcut"], commandDescription: [], shortcutDescription: [],
};

function resolveLanguage(locale?: string): "en" | "es" {
	const candidate = locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
	try {
		const language = Intl.getCanonicalLocales(candidate)[0]?.split("-", 1)[0]?.toLowerCase();
		return language === "es" ? "es" : "en";
	} catch {
		return "en";
	}
}

/** Throws when a catalog has missing, extra, duplicated, or unmatched interpolation placeholders. */
export function validateTranslations(catalog: Record<"en" | "es", TranslationCatalog> = TRANSLATIONS): void {
	for (const language of ["en", "es"] as const) for (const key of Object.keys(MESSAGE_PLACEHOLDERS) as MessageKey[]) {
		const template = catalog[language][key];
		if (typeof template !== "string") throw new Error(`Missing ${language} translation for ${key}`);
		const placeholders = template.match(/\{(\w+)\}/g)?.map((value) => value.slice(1, -1)) ?? [];
		const expected = MESSAGE_PLACEHOLDERS[key] as readonly string[];
		if (placeholders.length !== expected.length || expected.some((name) => placeholders.filter((value) => value === name).length !== 1)) {
			throw new Error(`Invalid ${language} translation placeholders for ${key}`);
		}
	}
}

function translateImplementation(key: MessageKey, values: Record<string, string | number>, locale?: string): string {
	const template = TRANSLATIONS[resolveLanguage(locale)][key];
	const expected = new Set(template.match(/\{(\w+)\}/g)?.map((value) => value.slice(1, -1)));
	if (Object.keys(values).some((name) => !expected.has(name)) || [...expected].some((name) => !Object.hasOwn(values, name))) {
		throw new Error(`Invalid interpolation values for ${key}`);
	}
	return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name]));
}

/** Resolves UI text with canonical en/es locale selection and checked interpolation values. */
export function translate<K extends MessageKeyWithoutArgs>(key: K, locale?: string): string;
export function translate<K extends MessageKeyWithArgs>(key: K, values: MessageArgs[K], locale?: string): string;
export function translate(key: MessageKey, valuesOrLocale?: Record<string, string | number> | string, locale?: string): string {
	return translateImplementation(key, typeof valuesOrLocale === "string" ? {} : valuesOrLocale ?? {}, typeof valuesOrLocale === "string" ? valuesOrLocale : locale);
}

validateTranslations();

export interface CodeSnippet {
	code: string;
	info: string;
	language?: string;
	startLine: number;
	endLine: number;
}

interface SourceLine {
	text: string;
	start: number;
	contentEnd: number;
	end: number;
}

interface AssistantMessageLike {
	role: "assistant";
	content: readonly unknown[];
}

interface RequestedSnippetIndex {
	value: number;
	input: string;
}

function sourceLines(markdown: string): SourceLine[] {
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

/** Extract complete CommonMark-style fenced blocks without their structural trailing newline. */
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
const MAX_SAFE_INTEGER_TEXT = String(Number.MAX_SAFE_INTEGER);
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

function displayLanguage(language: string | undefined, locale?: string): string {
	return displayText(language || translate("plainText", locale), MAX_DISPLAY_LANGUAGE_GRAPHEMES);
}

function displayIndexDiagnostic(value: string): string {
	return displayText(value, MAX_INDEX_DIAGNOSTIC_GRAPHEMES).replaceAll("\n", "↵");
}

function boundedRows(rows: string[], width: number): string[] {
	const availableWidth = typeof width === "number" && Number.isFinite(width)
		? Math.max(1, Math.floor(width))
		: 1;
	return rows.map((row) => truncateToWidth(row, availableWidth, ""));
}

/** Parses only canonical, exactly representable positive integer command indexes. */
function parseSnippetIndex(value: string): RequestedSnippetIndex | undefined {
	if (!/^[1-9]\d*$/.test(value)) return undefined;
	if (value.length > MAX_SAFE_INTEGER_TEXT.length) return undefined;
	if (value.length === MAX_SAFE_INTEGER_TEXT.length && value > MAX_SAFE_INTEGER_TEXT) return undefined;
	return { value: Number(value), input: value };
}

function isValidSnippetSelection(value: unknown, snippetCount: number): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < snippetCount;
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

function decoratedSnippet(snippet: CodeSnippet, snippetIndex: number, width: number, theme: Theme, locale?: string): string {
	const panelWidth = Math.max(1, width);
	const bodyWidth = Math.max(1, panelWidth - 2);
	const codeWidth = Math.max(1, bodyWidth - 2);
	const code = displayText(snippet.code, MAX_DISPLAY_CODE_GRAPHEMES);
	const highlightedLines = code
		? highlightCode(code, highlightLanguage(snippet.language))
		: [theme.fg("mdCodeBlock", translate("emptySnippet", locale))];
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

/** Decorate complete assistant code fences for display without changing stored Markdown. */
export function decorateAssistantSnippets(markdown: string, availableWidth: number, theme: Theme, locale?: string): string {
	const displayMarkdown = displayText(markdown, MAX_DISPLAY_MARKDOWN_GRAPHEMES);
	const snippets = extractFencedCodeBlocks(displayMarkdown);
	if (snippets.length === 0) return displayMarkdown;

	const lines = sourceLines(displayMarkdown);
	let decorated = displayMarkdown;
	for (let index = snippets.length - 1; index >= 0; index--) {
		const snippet = snippets[index]!;
		const opener = lines[snippet.startLine - 1]!;
		const closer = lines[snippet.endLine - 1]!;
		const trailingLineEnding = displayMarkdown.slice(closer.contentEnd, closer.end);
		const replacement = decoratedSnippet(snippet, index, availableWidth, theme, locale) + trailingLineEnding;
		decorated = decorated.slice(0, opener.start) + replacement + decorated.slice(closer.end);
	}
	return decorated;
}

function isAssistantMessage(message: unknown): message is AssistantMessageLike {
	if (!message || typeof message !== "object") return false;
	const candidate = message as { role?: unknown; content?: unknown };
	return candidate.role === "assistant" && Array.isArray(candidate.content);
}

function isTextContentBlock(block: unknown): block is { type: "text"; text: string } {
	if (!block || typeof block !== "object") return false;
	const candidate = block as { type?: unknown; text?: unknown };
	return candidate.type === "text" && typeof candidate.text === "string";
}

export function snippetsFromAssistantMessage(message: unknown): CodeSnippet[] {
	if (!isAssistantMessage(message)) return [];
	return message.content.flatMap((block) => isTextContentBlock(block) ? extractFencedCodeBlocks(block.text) : []);
}

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

function lineCount(code: string): number {
	return code ? code.split(/\r\n|\n|\r/).length : 0;
}

function preview(code: string, locale?: string): string {
	const firstContentLine = displayText(code, MAX_DISPLAY_CODE_GRAPHEMES).split("\n").find((line) => line.trim())?.trim() || translate("emptyPreview", locale);
	return truncateGraphemes(firstContentLine, MAX_PREVIEW_GRAPHEMES);
}

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

const MAX_VISIBLE_SNIPPETS = 6;
const MAX_PREVIEW_LINES = 8;
const MAX_OVERLAY_HEIGHT = 24;

type PickerKeybinding =
	| "tui.input.tab"
	| "tui.select.up"
	| "tui.select.down"
	| "tui.select.pageUp"
	| "tui.select.pageDown"
	| "tui.select.confirm"
	| "tui.select.cancel";

interface PickerKeybindings {
	matches(data: string, keybinding: PickerKeybinding): boolean;
	getKeys(keybinding: PickerKeybinding): KeyId[];
}

const NAMED_KEY_MESSAGES: Record<string, MessageKeyWithoutArgs> = {
	escape: "keyEscape", esc: "keyEscape", enter: "keyEnter", return: "keyEnter", tab: "keyTab",
	space: "keySpace", backspace: "keyBackspace", delete: "keyDelete", insert: "keyInsert", clear: "keyClear", home: "keyHome", end: "keyEnd",
	pageUp: "keyPageUp", pageDown: "keyPageDown", up: "keyUp", down: "keyDown", left: "keyLeft", right: "keyRight",
	f1: "keyF1", f2: "keyF2", f3: "keyF3", f4: "keyF4", f5: "keyF5", f6: "keyF6", f7: "keyF7", f8: "keyF8", f9: "keyF9", f10: "keyF10", f11: "keyF11", f12: "keyF12",
};

/** Formats named Pi-TUI keys while leaving literal keys and modifier notation conventional. */
export function formatKeyId(key: KeyId, locale?: string): string {
	const modifiers: string[] = [];
	let base = key as string;
	let prefix: RegExpMatchArray | null;
	while ((prefix = base.match(/^(ctrl|shift|alt|super)\+/))) {
		modifiers.push(prefix[1]!);
		base = base.slice(prefix[0].length);
	}
	// A KeyId always has a base key, but retain malformed values rather than rendering an empty key label.
	if (!base) return key;
	const messageKey = NAMED_KEY_MESSAGES[base];
	const label = messageKey ? translate(messageKey, locale) : base;
	return [...modifiers.map((modifier) => modifier[0]!.toUpperCase() + modifier.slice(1)), label].join("+");
}

export class SnippetNumberPrompt {
	private error: string | undefined;

	constructor(
		private readonly snippetCount: number,
		private readonly theme: Theme,
		private readonly keybindings: Pick<PickerKeybindings, "matches">,
		private readonly done: (index: number | undefined) => void,
		private readonly onChange: () => void = () => undefined,
		private readonly locale?: string,
	) {}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) return this.done(undefined);
		if (!/^[1-9]$/.test(data)) return;

		const index = Number(data) - 1;
		if (index < this.snippetCount) return this.done(index);
		this.error = translate("snippetUnavailable", { number: index + 1 }, this.locale);
		this.onChange();
	}

	render(width: number): string[] {
		try {
			return boundedRows(this.renderContent(width), width);
		} catch {
			return this.renderFallback(width);
		}
	}

	private renderFallback(width: number): string[] {
		const availableWidth = typeof width === "number" && Number.isFinite(width)
			? Math.max(1, Math.floor(width))
			: 1;
		return [translate("numberPromptRenderFailed", this.locale).slice(0, availableWidth)];
	}

	private renderContent(width: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const fit = (value: string) => {
			const truncated = truncateToWidth(value, innerWidth, "");
			return truncated + " ".repeat(Math.max(0, innerWidth - visibleWidth(truncated)));
		};
		const row = (value = "") => this.theme.fg("border", "│") + fit(value) + this.theme.fg("border", "│");
		const directCount = Math.min(9, this.snippetCount);
		const range = directCount === 1 ? "1" : `1-${directCount}`;
		const press = translate("pressNumber", { range }, this.locale);
		const cancelKey = translate("keyEscape", this.locale);
		const hint = this.snippetCount > 9
			? ` ${translate("promptHintMany", { range: press, command: "/copy-snippet 10+", cancelKey }, this.locale)}`
			: ` ${translate("promptHint", { range: press, cancelKey }, this.locale)}`;
		return [
			this.theme.fg("border", `╭${"─".repeat(innerWidth)}╮`),
			row(` ${this.theme.fg("accent", this.theme.bold(translate("copyByNumber", this.locale)))}`),
			row(` ${this.theme.fg("dim", hint.trimStart())}`),
			...(this.error ? [row(` ${this.theme.fg("error", this.error)}`)] : []),
			this.theme.fg("border", `╰${"─".repeat(innerWidth)}╯`),
		];
	}

	invalidate(): void {}
}

export class SnippetPicker {
	private selectedIndex = 0;
	private listOffset = 0;
	private previewOffset = 0;
	private previewTotalRows = 1;
	private previewVisibleRows = MAX_PREVIEW_LINES;
	private listStartRow = 3;
	private previewStartRow = 0;
	private previewEndRow = 0;
	private actualListRows = 0;
	private focus: "list" | "preview" = "list";

	constructor(
		private readonly snippets: readonly CodeSnippet[],
		private readonly theme: Theme,
		private readonly keybindings: PickerKeybindings,
		private readonly getMaxRows: () => number,
		private readonly done: (index: number | undefined) => void,
		private readonly onChange: () => void = () => undefined,
		private readonly locale?: string,
	) {}

	getSelection(): number {
		return this.selectedIndex;
	}

	getPreviewOffset(): number {
		return this.previewOffset;
	}

	getFocus(): "list" | "preview" {
		return this.focus;
	}

	private setFocus(focus: "list" | "preview"): void {
		if (this.focus === focus) return;
		this.focus = focus;
		this.onChange();
	}

	private select(index: number): void {
		const next = Math.max(0, Math.min(this.snippets.length - 1, index));
		if (next === this.selectedIndex) return;
		this.selectedIndex = next;
		this.previewOffset = 0;
		this.previewTotalRows = Math.max(1, this.snippets[next]!.code.split(/\r\n|\n|\r/).length);
		if (next < this.listOffset) this.listOffset = next;
		if (next >= this.listOffset + MAX_VISIBLE_SNIPPETS) this.listOffset = next - MAX_VISIBLE_SNIPPETS + 1;
		this.onChange();
	}

	private scrollPreview(delta: number): void {
		const next = Math.max(
			0,
			Math.min(Math.max(0, this.previewTotalRows - this.previewVisibleRows), this.previewOffset + delta),
		);
		if (next === this.previewOffset) return;
		this.previewOffset = next;
		this.onChange();
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) return this.done(undefined);
		if (this.keybindings.matches(data, "tui.select.confirm")) return this.done(this.selectedIndex);
		if (this.keybindings.matches(data, "tui.input.tab")) {
			this.setFocus(this.focus === "list" ? "preview" : "list");
			return;
		}
		if (this.keybindings.matches(data, "tui.select.up")) {
			return this.focus === "list" ? this.select(this.selectedIndex - 1) : this.scrollPreview(-1);
		}
		if (this.keybindings.matches(data, "tui.select.down")) {
			return this.focus === "list" ? this.select(this.selectedIndex + 1) : this.scrollPreview(1);
		}
		if (this.keybindings.matches(data, "tui.select.pageUp")) return this.scrollPreview(-this.previewVisibleRows);
		if (this.keybindings.matches(data, "tui.select.pageDown")) return this.scrollPreview(this.previewVisibleRows);
	}

	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (event.type === "wheel") {
			const delta = event.wheelDelta;
			if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) return undefined;
			this.setFocus("preview");
			this.scrollPreview(delta);
			return { handled: true, focus: true, render: true };
		}
		if (event.type !== "click" || event.button !== "left") return undefined;
		if (event.y >= this.listStartRow && event.y < this.listStartRow + this.actualListRows) {
			this.setFocus("list");
			this.select(this.listOffset + event.y - this.listStartRow);
			if ((event.clickCount ?? 1) >= 2) this.done(this.selectedIndex);
			return { handled: true, focus: true, render: true };
		}
		if (event.y >= this.previewStartRow && event.y < this.previewEndRow) {
			this.setFocus("preview");
			return { handled: true, focus: true, render: true };
		}
		return undefined;
	}

	private visualCodeRows(innerWidth: number): Array<{ lineNumber: string; code: string }> {
		const selected = this.snippets[this.selectedIndex]!;
		const code = displayText(selected.code, MAX_DISPLAY_CODE_GRAPHEMES);
		const codeLines = code
			? highlightCode(code, highlightLanguage(selected.language))
			: [this.theme.fg("mdCodeBlock", translate("emptySnippet", this.locale))];
		const numberWidth = String(codeLines.length).length;
		const codeWidth = Math.max(1, innerWidth - numberWidth - 5);
		return codeLines.flatMap((code, sourceIndex) => {
			const wrapped = wrapTextWithAnsi(code || " ", codeWidth);
			return wrapped.map((part, wrappedIndex) => ({
				lineNumber: wrappedIndex === 0 ? String(sourceIndex + 1).padStart(numberWidth) : " ".repeat(numberWidth),
				code: part,
			}));
		});
	}

	private keyLabel(keybinding: PickerKeybinding): string {
		return this.keybindings.getKeys(keybinding).map((key) => formatKeyId(key, this.locale)).join("/") || translate("keyUnbound", this.locale);
	}

	render(width: number): string[] {
		try {
			return boundedRows(this.renderContent(width), width);
		} catch {
			return this.renderFallback(width);
		}
	}

	private renderFallback(width: number): string[] {
		const availableWidth = typeof width === "number" && Number.isFinite(width)
			? Math.max(1, Math.floor(width))
			: 1;
		return [translate("pickerRenderFailed", this.locale).slice(0, availableWidth)];
	}

	private renderContent(width: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const fit = (value: string, targetWidth = innerWidth) => {
			const truncated = truncateToWidth(value, targetWidth, "");
			return truncated + " ".repeat(Math.max(0, targetWidth - visibleWidth(truncated)));
		};
		const outerBorder = () => this.theme.fg("border", "│");
		const row = (value = "") => outerBorder() + fit(value) + outerBorder();
		const backgroundRow = (value = "") =>
			outerBorder() + this.theme.bg("toolPendingBg", fit(value)) + outerBorder();
		const panelInnerWidth = Math.max(1, innerWidth - 4);
		const codePanelRow = (value = "") => {
			if (innerWidth < 5) return backgroundRow(value);
			return outerBorder() +
				" " +
				this.theme.fg("borderMuted", "│") +
				this.theme.bg("toolPendingBg", fit(value, panelInnerWidth)) +
				this.theme.fg("borderMuted", "│") +
				" " +
				outerBorder();
		};
		const panelBoundary = (top: boolean, label: string) => {
			const left = top ? "╭─" : "╰─";
			const right = top ? "╮" : "╯";
			const prefix = ` ${left} ${label} `;
			const fillWidth = Math.max(0, innerWidth - visibleWidth(prefix) - visibleWidth(right) - 1);
			return row(this.theme.fg("borderMuted", `${prefix}${"─".repeat(fillWidth)}${right} `));
		};
		const rule = () => this.theme.fg("borderMuted", `├${"─".repeat(innerWidth)}┤`);
		const availableRows = Math.max(1, Math.min(MAX_OVERLAY_HEIGHT, this.getMaxRows()));
		if (availableRows < 11) {
			this.actualListRows = 0;
			this.focus = "preview";
			this.previewVisibleRows = 1;
			this.previewStartRow = 2;
			this.previewEndRow = 3;
			const selected = this.snippets[this.selectedIndex]!;
			const visualCodeRows = this.visualCodeRows(innerWidth);
			this.previewTotalRows = visualCodeRows.length;
			this.previewOffset = Math.min(this.previewOffset, Math.max(0, this.previewTotalRows - 1));
			const codeRow = visualCodeRows[this.previewOffset]!;
			return [
				row(` ${this.theme.fg("accent", this.theme.bold(translate("compactTitle", this.locale)))} ${this.theme.fg("dim", `${this.previewOffset + 1}/${this.previewTotalRows}`)}`),
				row(` ${snippetLabel(selected, this.selectedIndex, this.locale)}`),
				backgroundRow(` ${codeRow.code}`),
				row(` ${this.theme.fg("dim", translate("compactFooter", {
					arrows: `${this.keyLabel("tui.select.up")}/${this.keyLabel("tui.select.down")}`,
					confirm: this.keyLabel("tui.select.confirm"),
					cancelKey: this.keyLabel("tui.select.cancel"),
				}, this.locale))}`),
			].slice(0, availableRows);
		}

		const dynamicRows = availableRows - 9;
		const listRows = Math.min(MAX_VISIBLE_SNIPPETS, this.snippets.length, Math.max(1, Math.floor(dynamicRows / 2)));
		const showListStatus = this.snippets.length > listRows && dynamicRows - listRows >= 2;
		this.previewVisibleRows = Math.min(
			MAX_PREVIEW_LINES,
			Math.max(1, dynamicRows - listRows - (showListStatus ? 1 : 0)),
		);
		if (this.selectedIndex >= this.listOffset + listRows) this.listOffset = this.selectedIndex - listRows + 1;

		const lines: string[] = [
			this.theme.fg("border", `╭${"─".repeat(innerWidth)}╮`),
			row(` ${this.theme.fg("accent", this.theme.bold(translate("pickerTitle", {
				focus: translate(this.focus === "list" ? "listFocus" : "previewFocus", this.locale),
			}, this.locale)))}`),
			rule(),
		];

		this.listStartRow = lines.length;
		const visibleSnippets = this.snippets.slice(this.listOffset, this.listOffset + listRows);
		this.actualListRows = visibleSnippets.length;
		for (let relativeIndex = 0; relativeIndex < visibleSnippets.length; relativeIndex++) {
			const index = this.listOffset + relativeIndex;
			const label = snippetLabel(visibleSnippets[relativeIndex]!, index, this.locale);
			lines.push(row(index === this.selectedIndex
				? this.theme.bg("selectedBg", this.theme.fg("accent", ` › ${label}`))
				: `   ${label}`));
		}
		if (showListStatus) {
			lines.push(row(` ${this.theme.fg("dim", translate("rangeOf", {
				start: this.listOffset + 1, end: this.listOffset + visibleSnippets.length, total: this.snippets.length,
			}, this.locale))}`));
		}

		lines.push(rule());
		const selected = this.snippets[this.selectedIndex]!;
		const language = displayLanguage(selected.language, this.locale);
		lines.push(panelBoundary(true, `${translate("preview", this.locale)} · ${language} · ${translate("previewLines", {
			start: selected.startLine, end: selected.endLine,
		}, this.locale)}`));
		const visualCodeRows = this.visualCodeRows(panelInnerWidth);
		this.previewStartRow = lines.length;
		this.previewEndRow = this.previewStartRow + this.previewVisibleRows;
		this.previewTotalRows = visualCodeRows.length;
		this.previewOffset = Math.min(this.previewOffset, Math.max(0, this.previewTotalRows - this.previewVisibleRows));
		const visibleCode = visualCodeRows.slice(this.previewOffset, this.previewOffset + this.previewVisibleRows);
		for (let index = 0; index < this.previewVisibleRows; index++) {
			const codeRow = visibleCode[index];
			lines.push(codeRow
				? codePanelRow(` ${this.theme.fg("dim", `${codeRow.lineNumber} │`)} ${codeRow.code}`)
				: codePanelRow());
		}
		const lastVisibleRow = Math.min(this.previewTotalRows, this.previewOffset + this.previewVisibleRows);
		lines.push(panelBoundary(false, `${translate("rows", this.locale)} ${translate("rangeOf", {
			start: this.previewOffset + 1, end: lastVisibleRow, total: this.previewTotalRows,
		}, this.locale)}`));
		lines.push(rule());
		const arrowAction = this.focus === "list" ? translate("select", this.locale) : translate("scroll", this.locale);
		lines.push(row(` ${this.theme.fg("dim", `${this.keyLabel("tui.input.tab")} ${translate("focus", this.locale)} · ${this.keyLabel("tui.select.up")}/${this.keyLabel("tui.select.down")} ${arrowAction} · ${this.keyLabel("tui.select.confirm")} ${translate("copy", this.locale)} · ${this.keyLabel("tui.select.cancel")} ${translate("cancel", this.locale)}`)}`));
		lines.push(this.theme.fg("border", `╰${"─".repeat(innerWidth)}╯`));
		return lines;
	}

	invalidate(): void {}
}

export default function betterSnippetsExtension(pi: ExtensionAPI, locale?: string) {
	let latestSnippets: CodeSnippet[] = [];
	let conversationTheme: Theme | undefined;
	let activePicker: { cancel(): void } | undefined;

	pi.registerMarkdownTransformer((markdown, context) => {
		if (context.messageType !== "assistant") return markdown;
		return conversationTheme
			? decorateAssistantSnippets(markdown, context.availableWidth, conversationTheme, locale)
			: displayText(markdown, MAX_DISPLAY_MARKDOWN_GRAPHEMES);
	});

	const refreshIndicator = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui" || latestSnippets.length === 0) {
			ctx.ui.setWidget(INDICATOR_KEY, undefined);
			return;
		}
		const text = latestSnippets.length === 1
			? translate("widgetOne", { count: latestSnippets.length, shortcut: SHORTCUT }, locale)
			: translate("widgetMany", { count: latestSnippets.length, shortcut: SHORTCUT }, locale);
		ctx.ui.setWidget(
			INDICATOR_KEY,
			(_tui, theme) => ({
				render: (width) => [theme.fg("dim", truncateToWidth(text, width, ""))],
				invalidate: () => undefined,
			}),
			{ placement: "belowEditor" },
		);
	};

	const cancelOpenPicker = () => activePicker?.cancel();

	const openPicker = async (
		ctx: ExtensionContext,
		create: (tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (value: unknown) => void) => Component & { dispose?(): void },
		overlayOptions: OverlayOptions,
	): Promise<unknown> => {
		let done: ((value: unknown) => void) | undefined;
		let handle: OverlayHandle | undefined;
		let component: (Component & { dispose?(): void }) | undefined;
		let settled = false;
		let cancelled = false;
		const finish = (value: unknown) => {
			if (settled) return;
			settled = true;
			done?.(value);
		};
		const operation = {
			cancel: () => {
				if (cancelled) return;
				cancelled = true;
				try { handle?.hide(); } catch { /* Teardown must not leave a pending picker. */ }
				try { component?.dispose?.(); } catch { /* The host owns component disposal errors. */ }
				finish(undefined);
			},
		};
		activePicker = operation;
		try {
			const result = await ctx.ui.custom<unknown>(
				(tui, theme, keybindings, resolve) => {
					done = resolve;
					component = create(tui, theme, keybindings, finish);
					if (cancelled) {
						try { component.dispose?.(); } catch { /* Teardown must not throw into Pi. */ }
						resolve(undefined);
					}
					return component;
				},
				{
					overlay: true,
					overlayOptions,
					onHandle: (nextHandle) => {
						handle = nextHandle;
						if (cancelled) {
							try { handle.hide(); } catch { /* Teardown must not throw into Pi. */ }
						}
					},
				},
			);
			return cancelled ? undefined : result;
		} finally {
			if (activePicker === operation) activePicker = undefined;
		}
	};

	const requestRender = (tui: TUI) => {
		try { tui.requestRender(); } catch { /* Rendering can recover on the next host refresh. */ }
	};

	const copySnippet = async (snippet: CodeSnippet, ctx: ExtensionContext) => {
		try {
			await copyToClipboard(snippet.code);
			ctx.ui.notify(translate("copied", { language: displayLanguage(snippet.language, locale) }, locale), "info");
		} catch (error) {
			const detail = error instanceof Error ? `: ${displayText(error.message, MAX_DISPLAY_LANGUAGE_GRAPHEMES)}` : "";
			ctx.ui.notify(translate("copyFailed", { detail }, locale), "error");
		}
	};

	const availableSnippets = (ctx: ExtensionContext): CodeSnippet[] => {
		const snippets = latestAssistantSnippets(ctx.sessionManager.getBranch());
		latestSnippets = snippets;
		refreshIndicator(ctx);
		return snippets;
	};

	const canCopy = (ctx: ExtensionContext): boolean => {
		if (ctx.mode === "tui") return true;
		const message = translate("tuiOnly", locale);
		if (ctx.mode === "json" || ctx.mode === "print") throw new Error(message);
		ctx.ui.notify(message, "warning");
		return false;
	};

	const notifyIfEmpty = (snippets: readonly CodeSnippet[], ctx: ExtensionContext): boolean => {
		if (snippets.length > 0) return false;
		ctx.ui.notify(translate("noSnippets", locale), "warning");
		return true;
	};

	const chooseAndCopy = async (ctx: ExtensionContext, requestedIndex?: RequestedSnippetIndex) => {
		if (activePicker || !canCopy(ctx)) return;
		const snippets = availableSnippets(ctx);
		if (notifyIfEmpty(snippets, ctx)) return;

		if (requestedIndex !== undefined) {
			const snippet = snippets[requestedIndex.value - 1];
			if (!snippet) {
				ctx.ui.notify(translate("invalidSnippet", {
					value: displayIndexDiagnostic(requestedIndex.input), available: `1-${snippets.length}`,
				}, locale), "error");
				return;
			}
			await copySnippet(snippet, ctx);
			return;
		}

		let selectedIndex: unknown;
		try {
			selectedIndex = await openPicker(
				ctx,
				(tui, theme, keybindings, done) => new SnippetPicker(
					snippets, theme, keybindings, () => tui.terminal.rows, done, () => requestRender(tui), locale,
				),
				{ anchor: "center", width: "90%", minWidth: 60, maxHeight: MAX_OVERLAY_HEIGHT, margin: 0 },
			);
		} catch {
			ctx.ui.notify(translate("pickerFailed", locale), "error");
			return;
		}
		if (selectedIndex === undefined) return;
		if (!isValidSnippetSelection(selectedIndex, snippets.length)) {
			ctx.ui.notify(translate("invalidSelection", locale), "error");
			return;
		}
		await copySnippet(snippets[selectedIndex], ctx);
	};

	const quickCopyByNumber = async (ctx: ExtensionContext) => {
		if (activePicker || !canCopy(ctx)) return;
		const snippets = availableSnippets(ctx);
		if (notifyIfEmpty(snippets, ctx)) return;
		if (snippets.length === 1) {
			await copySnippet(snippets[0]!, ctx);
			return;
		}

		let selectedIndex: unknown;
		try {
			selectedIndex = await openPicker(
				ctx,
				(tui, theme, keybindings, done) => new SnippetNumberPrompt(
					snippets.length, theme, keybindings, done, () => requestRender(tui), locale,
				),
				{ anchor: "center", width: 48, maxHeight: 5, margin: 0 },
			);
		} catch {
			ctx.ui.notify(translate("pickerFailed", locale), "error");
			return;
		}
		if (selectedIndex === undefined) return;
		if (!isValidSnippetSelection(selectedIndex, snippets.length)) {
			ctx.ui.notify(translate("invalidSelection", locale), "error");
			return;
		}
		await copySnippet(snippets[selectedIndex], ctx);
	};

	pi.on("session_start", (_event, ctx) => {
		conversationTheme = ctx.ui.theme;
		latestSnippets = latestAssistantSnippets(ctx.sessionManager.getBranch());
		refreshIndicator(ctx);
	});

	pi.on("session_before_tree", () => {
		cancelOpenPicker();
	});

	pi.on("session_tree", (_event, ctx) => {
		cancelOpenPicker();
		latestSnippets = latestAssistantSnippets(ctx.sessionManager.getBranch());
		refreshIndicator(ctx);
	});

	pi.on("message_end", (event, ctx) => {
		if (!isAssistantMessage(event.message)) return;
		latestSnippets = snippetsFromAssistantMessage(event.message);
		refreshIndicator(ctx);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		cancelOpenPicker();
		latestSnippets = [];
		conversationTheme = undefined;
		ctx.ui.setWidget(INDICATOR_KEY, undefined);
	});

	pi.registerCommand("copy-snippet", {
		description: translate("commandDescription", locale),
		handler: async (args, ctx) => {
			if (!canCopy(ctx)) return;
			const value = args.trim();
			if (value) {
				const requestedIndex = parseSnippetIndex(value);
				if (!requestedIndex) {
					ctx.ui.notify(`${translate("invalidIndex", { value: displayIndexDiagnostic(args) }, locale)}. ${translate("usage", locale)}`, "error");
					return;
				}
				await chooseAndCopy(ctx, requestedIndex);
				return;
			}
			await chooseAndCopy(ctx);
		},
	});

	// Pi resolves shortcut conflicts after registration and exposes no result; the widget always shows /copy-snippet as a fallback.
	pi.registerShortcut(SHORTCUT, {
		description: translate("shortcutDescription", locale),
		handler: async (ctx) => quickCopyByNumber(ctx),
	});
}

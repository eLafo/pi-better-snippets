import {
	copyToClipboard,
	highlightCode,
	type ExtensionAPI,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	truncateToWidth,
	type KeyId,
	type KeybindingsManager,
	type TuiMouseEvent,
	type TuiMouseEventResult,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

const INDICATOR_KEY = "better-snippets";
const SHORTCUT = "ctrl+shift+c";

type MessageKey =
	| "emptySnippet"
	| "snippetUnavailable"
	| "copyByNumber"
	| "pressNumber"
	| "cancel"
	| "preview"
	| "rows"
	| "focus"
	| "select"
	| "scroll"
	| "copy"
	| "copied"
	| "copyFailed"
	| "tuiOnly"
	| "noSnippets"
	| "usage";

const TRANSLATIONS: Record<"en" | "es", Record<MessageKey, string>> = {
	en: {
		emptySnippet: "(empty snippet)", snippetUnavailable: "Snippet {number} is not available", copyByNumber: "Copy snippet by number", pressNumber: "Press {range}", cancel: "cancel", preview: "Preview", rows: "Rows", focus: "focus", select: "select", scroll: "scroll", copy: "copy", copied: "Copied {language} snippet to the clipboard", copyFailed: "Could not copy the snippet{detail}", tuiOnly: "Snippet copying is only available in the interactive TUI", noSnippets: "The latest assistant response has no fenced snippets", usage: "Usage: /copy-snippet [number]",
	},
	es: {
		emptySnippet: "(fragmento vacío)", snippetUnavailable: "El fragmento {number} no está disponible", copyByNumber: "Copiar fragmento por número", pressNumber: "Pulsa {range}", cancel: "cancelar", preview: "Vista previa", rows: "Filas", focus: "foco", select: "seleccionar", scroll: "desplazar", copy: "copiar", copied: "Fragmento {language} copiado al portapapeles", copyFailed: "No se pudo copiar el fragmento{detail}", tuiOnly: "La copia de fragmentos solo está disponible en la TUI interactiva", noSnippets: "La última respuesta del asistente no contiene fragmentos delimitados", usage: "Uso: /copy-snippet [número]",
	},
};

/** Resolves UI text from the system locale; pass a locale to test or embed another translation. */
export function translate(key: MessageKey, values: Record<string, string | number> = {}, locale?: string): string {
	const resolvedLocale = locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
	const language = resolvedLocale.toLowerCase().startsWith("es") ? "es" : "en";
	return TRANSLATIONS[language][key].replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ""));
}

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
	content: Array<{ type: string; text?: string }>;
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

function escapeMarkdownOutsideAnsi(value: string): string {
	return value.split(ANSI_SEQUENCE).map((part) =>
		part.startsWith("\x1b[") ? part : part.replace(MARKDOWN_PUNCTUATION, "\\$1")
	).join("");
}

function decoratedSnippet(snippet: CodeSnippet, snippetIndex: number, width: number, theme: Theme): string {
	const panelWidth = Math.max(1, width);
	const bodyWidth = Math.max(1, panelWidth - 2);
	const codeWidth = Math.max(1, bodyWidth - 2);
	const normalizedCode = snippet.code.replaceAll("\t", "    ").replaceAll(/\r\n|\r/g, "\n");
	const highlightedLines = snippet.code
		? highlightCode(normalizedCode, snippet.language)
		: [theme.fg("mdCodeBlock", translate("emptySnippet"))];
	const visualLines = highlightedLines.flatMap((line) => wrapTextWithAnsi(line || " ", codeWidth));
	const fit = (value: string, targetWidth: number) => {
		const truncated = truncateToWidth(value, targetWidth, "");
		return truncated + " ".repeat(Math.max(0, targetWidth - visibleWidth(truncated)));
	};
	if (panelWidth < 4) {
		return visualLines.map((line) => escapeMarkdownOutsideAnsi(fit(line, panelWidth))).join("\n");
	}

	const language = snippet.language || "text";
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
export function decorateAssistantSnippets(markdown: string, availableWidth: number, theme: Theme): string {
	const snippets = extractFencedCodeBlocks(markdown);
	if (snippets.length === 0) return markdown;

	const lines = sourceLines(markdown);
	let decorated = markdown;
	for (let index = snippets.length - 1; index >= 0; index--) {
		const snippet = snippets[index]!;
		const opener = lines[snippet.startLine - 1]!;
		const closer = lines[snippet.endLine - 1]!;
		const trailingLineEnding = markdown.slice(closer.contentEnd, closer.end);
		const replacement = decoratedSnippet(snippet, index, availableWidth, theme) + trailingLineEnding;
		decorated = decorated.slice(0, opener.start) + replacement + decorated.slice(closer.end);
	}
	return decorated;
}

function isAssistantMessage(message: unknown): message is AssistantMessageLike {
	if (!message || typeof message !== "object") return false;
	const candidate = message as Partial<AssistantMessageLike>;
	return candidate.role === "assistant" && Array.isArray(candidate.content);
}

export function snippetsFromAssistantMessage(message: unknown): CodeSnippet[] {
	if (!isAssistantMessage(message)) return [];
	return message.content.flatMap((block) =>
		block.type === "text" && typeof block.text === "string" ? extractFencedCodeBlocks(block.text) : [],
	);
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

function preview(code: string): string {
	const firstContentLine = code.split(/\r\n|\n|\r/).find((line) => line.trim())?.trim() || "(empty)";
	return firstContentLine.length > 72 ? `${firstContentLine.slice(0, 69)}…` : firstContentLine;
}

export function snippetLabel(snippet: CodeSnippet, index: number): string {
	const language = snippet.language || "text";
	const lines = lineCount(snippet.code);
	return `${index + 1}. ${language} · ${lines} ${lines === 1 ? "line" : "lines"} — ${preview(snippet.code)}`;
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

export class SnippetNumberPrompt {
	private error: string | undefined;

	constructor(
		private readonly snippetCount: number,
		private readonly theme: Theme,
		private readonly keybindings: Pick<PickerKeybindings, "matches">,
		private readonly done: (index: number | undefined) => void,
		private readonly onChange: () => void = () => undefined,
	) {}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) return this.done(undefined);
		if (!/^[1-9]$/.test(data)) return;

		const index = Number(data) - 1;
		if (index < this.snippetCount) return this.done(index);
		this.error = translate("snippetUnavailable", { number: index + 1 });
		this.onChange();
	}

	render(width: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const fit = (value: string) => {
			const truncated = truncateToWidth(value, innerWidth, "");
			return truncated + " ".repeat(Math.max(0, innerWidth - visibleWidth(truncated)));
		};
		const row = (value = "") => this.theme.fg("border", "│") + fit(value) + this.theme.fg("border", "│");
		const directCount = Math.min(9, this.snippetCount);
		const range = directCount === 1 ? "1" : `1-${directCount}`;
		const hint = this.snippetCount > 9
			? ` ${translate("pressNumber", { range })} · /copy-snippet 10+ · Esc ${translate("cancel")}`
			: ` ${translate("pressNumber", { range })} · Esc ${translate("cancel")}`;
		return [
			this.theme.fg("border", `╭${"─".repeat(innerWidth)}╮`),
			row(` ${this.theme.fg("accent", this.theme.bold(translate("copyByNumber")))}`),
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
			this.setFocus("preview");
			this.scrollPreview(event.wheelDelta && event.wheelDelta < 0 ? -3 : 3);
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
		const normalizedCode = selected.code.replaceAll("\t", "    ");
		const codeLines = selected.code
			? highlightCode(normalizedCode.replaceAll(/\r\n|\r/g, "\n"), selected.language)
			: [this.theme.fg("mdCodeBlock", translate("emptySnippet"))];
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
		const names: Record<string, string> = {
			up: "↑",
			down: "↓",
			pageUp: "PgUp",
			pageDown: "PgDn",
			enter: "Enter",
			return: "Enter",
			escape: "Esc",
		};
		const format = (key: string) => key.split("+").map((part) =>
			names[part] ?? (part.length === 1 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1))
		).join("+");
		return this.keybindings.getKeys(keybinding).map(format).join("/") || "unbound";
	}

	render(width: number): string[] {
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
				row(` ${this.theme.fg("accent", this.theme.bold("Copy snippet · preview"))} ${this.theme.fg("dim", `${this.previewOffset + 1}/${this.previewTotalRows}`)}`),
				row(` ${snippetLabel(selected, this.selectedIndex)}`),
				backgroundRow(` ${codeRow.code}`),
				row(` ${this.theme.fg("dim", `${this.keyLabel("tui.select.up")}/${this.keyLabel("tui.select.down")} scroll · ${this.keyLabel("tui.select.confirm")} copy · ${this.keyLabel("tui.select.cancel")} cancel`)}`),
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
			row(` ${this.theme.fg("accent", this.theme.bold(`Copy snippet · ${this.focus}`))}`),
			rule(),
		];

		this.listStartRow = lines.length;
		const visibleSnippets = this.snippets.slice(this.listOffset, this.listOffset + listRows);
		this.actualListRows = visibleSnippets.length;
		for (let relativeIndex = 0; relativeIndex < visibleSnippets.length; relativeIndex++) {
			const index = this.listOffset + relativeIndex;
			const label = snippetLabel(visibleSnippets[relativeIndex]!, index);
			lines.push(row(index === this.selectedIndex
				? this.theme.bg("selectedBg", this.theme.fg("accent", ` › ${label}`))
				: `   ${label}`));
		}
		if (showListStatus) {
			lines.push(row(` ${this.theme.fg("dim", `${this.listOffset + 1}-${this.listOffset + visibleSnippets.length} of ${this.snippets.length}`)}`));
		}

		lines.push(rule());
		const selected = this.snippets[this.selectedIndex]!;
		const language = selected.language || "text";
		lines.push(panelBoundary(true, `${translate("preview")} · ${language} · lines ${selected.startLine}-${selected.endLine}`));
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
		lines.push(panelBoundary(false, `${translate("rows")} ${this.previewOffset + 1}-${lastVisibleRow} of ${this.previewTotalRows}`));
		lines.push(rule());
		const arrowAction = this.focus === "list" ? translate("select") : translate("scroll");
		lines.push(row(` ${this.theme.fg("dim", `${this.keyLabel("tui.input.tab")} ${translate("focus")} · ${this.keyLabel("tui.select.up")}/${this.keyLabel("tui.select.down")} ${arrowAction} · ${this.keyLabel("tui.select.confirm")} ${translate("copy")} · ${this.keyLabel("tui.select.cancel")} ${translate("cancel")}`)}`));
		lines.push(this.theme.fg("border", `╰${"─".repeat(innerWidth)}╯`));
		return lines;
	}

	invalidate(): void {}
}

export default function betterSnippetsExtension(pi: ExtensionAPI) {
	let latestSnippets: CodeSnippet[] = [];
	let pickerOpen = false;
	let conversationTheme: Theme | undefined;

	pi.registerMarkdownTransformer((markdown, context) => {
		if (context.messageType !== "assistant" || !conversationTheme) return markdown;
		return decorateAssistantSnippets(markdown, context.availableWidth, conversationTheme);
	});

	const refreshIndicator = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui" || latestSnippets.length === 0) {
			ctx.ui.setWidget(INDICATOR_KEY, undefined);
			return;
		}
		const noun = latestSnippets.length === 1 ? "snippet" : "snippets";
		const action = latestSnippets.length === 1 ? "copy" : "→ number";
		const text = `${latestSnippets.length} ${noun} · ${SHORTCUT} ${action}`;
		ctx.ui.setWidget(
			INDICATOR_KEY,
			(_tui, theme) => ({
				render: (width) => [theme.fg("dim", truncateToWidth(text, width, ""))],
				invalidate: () => undefined,
			}),
			{ placement: "belowEditor" },
		);
	};

	const copySnippet = async (snippet: CodeSnippet, ctx: ExtensionContext) => {
		try {
			await copyToClipboard(snippet.code);
			ctx.ui.notify(translate("copied", { language: snippet.language || "text" }), "info");
		} catch (error) {
			const detail = error instanceof Error ? `: ${error.message}` : "";
			ctx.ui.notify(translate("copyFailed", { detail }), "error");
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
		ctx.ui.notify(translate("tuiOnly"), "warning");
		return false;
	};

	const notifyIfEmpty = (snippets: readonly CodeSnippet[], ctx: ExtensionContext): boolean => {
		if (snippets.length > 0) return false;
		ctx.ui.notify(translate("noSnippets"), "warning");
		return true;
	};

	const chooseAndCopy = async (ctx: ExtensionContext, requestedIndex?: number) => {
		if (pickerOpen || !canCopy(ctx)) return;
		const snippets = availableSnippets(ctx);
		if (notifyIfEmpty(snippets, ctx)) return;

		if (requestedIndex !== undefined) {
			const snippet = snippets[requestedIndex - 1];
			if (!snippet) {
				ctx.ui.notify(`Snippet ${requestedIndex} does not exist (available: 1-${snippets.length})`, "error");
				return;
			}
			await copySnippet(snippet, ctx);
			return;
		}

		pickerOpen = true;
		try {
			const selectedIndex = await ctx.ui.custom<number | undefined>(
				(tui, theme, keybindings, done) => new SnippetPicker(
					snippets,
					theme,
					keybindings as KeybindingsManager,
					() => tui.terminal.rows,
					done,
					() => tui.requestRender(),
				),
				{
					overlay: true,
					overlayOptions: {
						anchor: "center",
						width: "90%",
						minWidth: 60,
						maxHeight: MAX_OVERLAY_HEIGHT,
						margin: 0,
					},
				},
			);
			if (selectedIndex !== undefined) await copySnippet(snippets[selectedIndex]!, ctx);
		} finally {
			pickerOpen = false;
		}
	};

	const quickCopyByNumber = async (ctx: ExtensionContext) => {
		if (pickerOpen || !canCopy(ctx)) return;
		const snippets = availableSnippets(ctx);
		if (notifyIfEmpty(snippets, ctx)) return;
		if (snippets.length === 1) {
			await copySnippet(snippets[0]!, ctx);
			return;
		}

		pickerOpen = true;
		try {
			const selectedIndex = await ctx.ui.custom<number | undefined>(
				(tui, theme, keybindings, done) => new SnippetNumberPrompt(
					snippets.length,
					theme,
					keybindings as KeybindingsManager,
					done,
					() => tui.requestRender(),
				),
				{
					overlay: true,
					overlayOptions: {
						anchor: "center",
						width: 48,
						maxHeight: 5,
						margin: 0,
					},
				},
			);
			if (selectedIndex !== undefined) await copySnippet(snippets[selectedIndex]!, ctx);
		} finally {
			pickerOpen = false;
		}
	};

	pi.on("session_start", (_event, ctx) => {
		conversationTheme = ctx.ui.theme;
		latestSnippets = latestAssistantSnippets(ctx.sessionManager.getBranch());
		refreshIndicator(ctx);
	});

	pi.on("session_tree", (_event, ctx) => {
		latestSnippets = latestAssistantSnippets(ctx.sessionManager.getBranch());
		refreshIndicator(ctx);
	});

	pi.on("message_end", (event, ctx) => {
		if (!isAssistantMessage(event.message)) return;
		latestSnippets = snippetsFromAssistantMessage(event.message);
		refreshIndicator(ctx);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		pickerOpen = false;
		latestSnippets = [];
		conversationTheme = undefined;
		ctx.ui.setWidget(INDICATOR_KEY, undefined);
	});

	pi.registerCommand("copy-snippet", {
		description: "Select and copy a fenced snippet from the latest assistant response",
		handler: async (args, ctx) => {
			const value = args.trim();
			if (value && !/^[1-9]\d*$/.test(value)) {
				ctx.ui.notify(translate("usage"), "error");
				return;
			}
			await chooseAndCopy(ctx, value ? Number(value) : undefined);
		},
	});

	pi.registerShortcut(SHORTCUT, {
		description: "Copy a fenced snippet by pressing its number",
		handler: async (ctx) => quickCopyByNumber(ctx),
	});
}

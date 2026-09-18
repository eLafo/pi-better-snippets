/**
 * @packageDocumentation
 *
 * Interactive Pi-TUI components for selecting and previewing extracted snippets.
 */
import type { Theme } from "@earendil-works/pi-coding-agent";
import {
	truncateToWidth,
	type KeyId,
	type TuiMouseEvent,
	type TuiMouseEventResult,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { translate, type MessageKeyWithoutArgs } from "./messages.js";
import {
	boundedRows,
	displayLanguage,
	displaySearchQuery,
	highlightedSnippetLines,
	snippetLabel,
	snippetSearchMetadata,
} from "./presentation.js";
import type { CodeSnippet } from "./snippets.js";

const MAX_VISIBLE_SNIPPETS = 6;
const MAX_PREVIEW_LINES = 8;
/**
 * Maximum overlay height, preserving space for the surrounding Pi interface.
 *
 * @public
 */
export const MAX_OVERLAY_HEIGHT = 24;

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

/**
 * Formats a Pi-TUI key identifier for the current locale.
 *
 * @remarks Named base keys are translated; literal keys and modifier notation are
 * retained so configured bindings remain recognizable.
 *
 * @param key - Pi-TUI key identifier.
 * @param locale - Requested UI locale.
 * @returns A human-readable key label.
 * @public
 */
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

/**
 * Compact picker that accepts direct numeric selection for the first nine snippets.
 * Higher indexes remain available through the `/copy-snippet <number>` command.
 *
 * @public
 */
export class SnippetNumberPrompt {
	private error: string | undefined;

	/**
	 * @param snippetCount - Number of snippets that can be selected.
	 * @param theme - Theme used to render prompt borders and status.
	 * @param keybindings - Keybinding matcher provided by Pi.
	 * @param done - Callback receiving a zero-based selection or cancellation.
	 * @param onChange - Callback requesting a re-render after state changes.
	 * @param locale - Requested UI locale.
	 */
	constructor(
		private readonly snippetCount: number,
		private readonly theme: Theme,
		private readonly keybindings: Pick<PickerKeybindings, "matches">,
		private readonly done: (index: number | undefined) => void,
		private readonly onChange: () => void = () => undefined,
		private readonly locale?: string,
	) {}

	/**
	 * Handles cancel and one-digit selection keybindings.
	 *
	 * @param data - Raw terminal input.
	 */
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

/**
 * Full snippet picker with keyboard and mouse selection plus a scrollable preview.
 * It owns transient navigation state and reports a selected zero-based index to `done`.
 *
 * @public
 */
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
	private searchActive = false;
	private searchQuery = "";
	private selectionBeforeSearch = 0;

	/**
	 * @param snippets - Immutable picker entries in display order.
	 * @param theme - Theme used to render controls and preview.
	 * @param keybindings - Pi keybinding resolver.
	 * @param getMaxRows - Supplies the current terminal row limit.
	 * @param done - Callback receiving a zero-based selection or cancellation.
	 * @param onChange - Callback requesting a re-render after state changes.
	 * @param locale - Requested UI locale.
	 */
	constructor(
		private readonly snippets: readonly CodeSnippet[],
		private readonly theme: Theme,
		private readonly keybindings: PickerKeybindings,
		private readonly getMaxRows: () => number,
		private readonly done: (index: number | undefined) => void,
		private readonly onChange: () => void = () => undefined,
		private readonly locale?: string,
	) {}

	/** @returns The currently selected zero-based snippet index. */
	getSelection(): number {
		return this.selectedIndex;
	}

	/** @returns The zero-based visual row at the top of the preview. */
	getPreviewOffset(): number {
		return this.previewOffset;
	}

	/** @returns The pane that currently receives navigation input. */
	getFocus(): "list" | "preview" {
		return this.focus;
	}

	private setFocus(focus: "list" | "preview"): void {
		if (this.focus === focus) return;
		this.focus = focus;
		this.onChange();
	}

	private visibleIndices(): number[] {
		if (!this.searchActive || !this.searchQuery) return this.snippets.map((_snippet, index) => index);
		const query = this.searchQuery.toLocaleLowerCase(this.locale);
		return this.snippets.flatMap((snippet, index) =>
			snippetSearchMetadata(snippet, index, this.locale).toLocaleLowerCase(this.locale).includes(query) ? [index] : [],
		);
	}

	private select(index: number): void {
		const visibleIndices = this.visibleIndices();
		const next = visibleIndices.includes(index) ? index : visibleIndices[0];
		if (next === undefined || next === this.selectedIndex) return;
		this.selectedIndex = next;
		this.previewOffset = 0;
		this.previewTotalRows = Math.max(1, this.snippets[next]!.code.split(/\r\n|\n|\r/).length);
		const visibleIndex = visibleIndices.indexOf(next);
		if (visibleIndex < this.listOffset) this.listOffset = visibleIndex;
		if (visibleIndex >= this.listOffset + MAX_VISIBLE_SNIPPETS) this.listOffset = visibleIndex - MAX_VISIBLE_SNIPPETS + 1;
		this.onChange();
	}

	private leaveSearch(): void {
		if (!this.searchActive) return;
		this.searchActive = false;
		this.searchQuery = "";
		this.listOffset = 0;
		this.select(this.selectionBeforeSearch);
		this.onChange();
	}

	private updateSearch(query: string): void {
		this.searchQuery = displaySearchQuery(query);
		this.listOffset = 0;
		if (!this.searchQuery) this.select(this.selectionBeforeSearch);
		else {
			const matches = this.visibleIndices();
			if (matches.length && !matches.includes(this.selectedIndex)) this.select(matches[0]!);
		}
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

	/**
	 * Routes keyboard input to selection, focus, cancellation, or preview scrolling.
	 *
	 * @param data - Raw terminal input.
	 */
	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) {
			if (this.searchActive) return this.leaveSearch();
			return this.done(undefined);
		}
		if (!this.searchActive && data === "/") {
			this.searchActive = true;
			this.selectionBeforeSearch = this.selectedIndex;
			this.onChange();
			return;
		}
		if (this.searchActive && (data === "\x7f" || data === "\b")) return this.updateSearch(this.searchQuery.slice(0, -1));
		if (this.searchActive && data.length === 1 && data >= " ") return this.updateSearch(this.searchQuery + data);
		const visibleIndices = this.visibleIndices();
		if (this.keybindings.matches(data, "tui.select.confirm")) {
			if (visibleIndices.includes(this.selectedIndex)) this.done(this.selectedIndex);
			return;
		}
		if (this.keybindings.matches(data, "tui.input.tab")) {
			this.setFocus(this.focus === "list" ? "preview" : "list");
			return;
		}
		if (this.keybindings.matches(data, "tui.select.up")) {
			return this.focus === "list" ? this.select(visibleIndices[Math.max(0, visibleIndices.indexOf(this.selectedIndex) - 1)] ?? this.selectedIndex) : this.scrollPreview(-1);
		}
		if (this.keybindings.matches(data, "tui.select.down")) {
			return this.focus === "list" ? this.select(visibleIndices[Math.min(visibleIndices.length - 1, visibleIndices.indexOf(this.selectedIndex) + 1)] ?? this.selectedIndex) : this.scrollPreview(1);
		}
		if (this.keybindings.matches(data, "tui.select.pageUp")) return this.scrollPreview(-this.previewVisibleRows);
		if (this.keybindings.matches(data, "tui.select.pageDown")) return this.scrollPreview(this.previewVisibleRows);
	}

	/**
	 * Handles preview scrolling and list clicks; a double-click confirms selection.
	 *
	 * @param event - Mouse event received from Pi-TUI.
	 * @returns Handling instructions, or `undefined` when the event is irrelevant.
	 */
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
			this.select(this.visibleIndices()[this.listOffset + event.y - this.listStartRow] ?? this.selectedIndex);
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
		const codeLines = highlightedSnippetLines(selected, this.theme, this.locale);
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
			const title = this.searchActive
				? translate("searchQuery", { query: this.searchQuery || "…" }, this.locale)
				: translate("compactTitle", this.locale);
			return [
				row(` ${this.theme.fg("accent", this.theme.bold(title))} ${this.theme.fg("dim", `${this.previewOffset + 1}/${this.previewTotalRows}`)}`),
				row(` ${snippetLabel(selected, this.selectedIndex, this.locale)}`),
				backgroundRow(` ${codeRow.code}`),
				row(` ${this.theme.fg("dim", translate("compactFooter", {
					arrows: `${this.keyLabel("tui.select.up")}/${this.keyLabel("tui.select.down")}`,
					confirm: this.keyLabel("tui.select.confirm"),
					cancelKey: this.keyLabel("tui.select.cancel"),
				}, this.locale))}`),
			].slice(0, availableRows);
		}

		const visibleIndices = this.visibleIndices();
		const searchRows = this.searchActive ? 1 : 0;
		const dynamicRows = availableRows - 9 - searchRows;
		const listRows = visibleIndices.length
			? Math.min(MAX_VISIBLE_SNIPPETS, visibleIndices.length, Math.max(1, Math.floor(dynamicRows / 2)))
			: 1;
		const showListStatus = visibleIndices.length > listRows && dynamicRows - listRows >= 2;
		this.previewVisibleRows = Math.min(
			MAX_PREVIEW_LINES,
			Math.max(1, dynamicRows - listRows - (showListStatus ? 1 : 0)),
		);
		const selectedVisibleIndex = visibleIndices.indexOf(this.selectedIndex);
		if (selectedVisibleIndex >= this.listOffset + listRows) this.listOffset = selectedVisibleIndex - listRows + 1;
		if (selectedVisibleIndex >= 0 && selectedVisibleIndex < this.listOffset) this.listOffset = selectedVisibleIndex;

		const title = this.searchActive
			? translate("searchQuery", { query: this.searchQuery || "…" }, this.locale)
			: `${translate("pickerTitle", {
				focus: translate(this.focus === "list" ? "listFocus" : "previewFocus", this.locale),
			}, this.locale)} · /${translate("search", this.locale)}`;
		const lines: string[] = [
			this.theme.fg("border", `╭${"─".repeat(innerWidth)}╮`),
			row(` ${this.theme.fg("accent", this.theme.bold(title))}`),
			rule(),
		];

		if (this.searchActive) lines.push(row(` ${this.theme.fg("dim", translate("searchQuery", { query: this.searchQuery || "…" }, this.locale))}`));
		this.listStartRow = lines.length;
		const visibleSnippetIndices = visibleIndices.slice(this.listOffset, this.listOffset + listRows);
		this.actualListRows = visibleSnippetIndices.length;
		for (let relativeIndex = 0; relativeIndex < visibleSnippetIndices.length; relativeIndex++) {
			const index = visibleSnippetIndices[relativeIndex]!;
			const label = snippetLabel(this.snippets[index]!, index, this.locale);
			lines.push(row(index === this.selectedIndex
				? this.theme.bg("selectedBg", this.theme.fg("accent", ` › ${label}`))
				: `   ${label}`));
		}
		if (visibleSnippetIndices.length === 0) {
			lines.push(row(` ${this.theme.fg("dim", translate("noMatches", this.locale))}`));
		} else if (showListStatus) {
			lines.push(row(` ${this.theme.fg("dim", translate("rangeOf", {
				start: this.listOffset + 1, end: this.listOffset + visibleSnippetIndices.length, total: visibleIndices.length,
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
		const searchHelp = this.searchActive ? translate("searchHint", this.locale) : `/${translate("search", this.locale)}`;
		lines.push(row(` ${this.theme.fg("dim", `${this.keyLabel("tui.input.tab")} ${translate("focus", this.locale)} · ${this.keyLabel("tui.select.up")}/${this.keyLabel("tui.select.down")} ${arrowAction} · ${this.keyLabel("tui.select.confirm")} ${translate("copy", this.locale)} · ${searchHelp} · ${this.keyLabel("tui.select.cancel")} ${translate("cancel", this.locale)}`)}`));
		lines.push(this.theme.fg("border", `╰${"─".repeat(innerWidth)}╯`));
		return lines;
	}

	invalidate(): void {}
}

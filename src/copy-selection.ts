/**
 * Coordinates explicit snippet-copy actions after commands and shortcuts.
 */
import { copyToClipboard, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OverlayOptions, TUI } from "@earendil-works/pi-tui";
import { isValidSnippetSelection, type RequestedSnippetIndex } from "./index-selection.js";
import { translate } from "./messages.js";
import { MAX_OVERLAY_HEIGHT, SnippetNumberPrompt, SnippetPicker } from "./pickers.js";
import { type PickerFactory } from "./picker-lifecycle.js";
import { displayErrorDetail, displayIndexDiagnostic, displayLanguage } from "./presentation.js";
import { latestAssistantSnippets, type CodeSnippet } from "./snippets.js";

/** Dependencies supplied by the extension composition root. */
export interface CopySelectionControllerOptions {
	locale?: string;
	isPickerActive(): boolean;
	openPicker(ctx: ExtensionContext, create: PickerFactory, overlayOptions: OverlayOptions): Promise<unknown>;
	refreshIndicator(ctx: ExtensionContext, snippets: readonly CodeSnippet[]): void;
}

/** Controls command and shortcut snippet-copy flows. */
export interface CopySelectionController {
	canCopy(ctx: ExtensionContext): boolean;
	chooseAndCopy(ctx: ExtensionContext, requestedIndex?: RequestedSnippetIndex): Promise<void>;
	quickCopyByNumber(ctx: ExtensionContext): Promise<void>;
}

/**
 * Creates explicit copy flows while leaving extension state and picker lifetime to the caller.
 */
export function createCopySelectionController(options: CopySelectionControllerOptions): CopySelectionController {
	const { locale } = options;

	const requestRender = (tui: TUI) => {
		try { tui.requestRender(); } catch { /* Rendering can recover on the next host refresh. */ }
	};

	const copySnippet = async (snippet: CodeSnippet, ctx: ExtensionContext) => {
		try {
			await copyToClipboard(snippet.code);
			ctx.ui.notify(translate("copied", { language: displayLanguage(snippet.language, locale) }, locale), "info");
		} catch (error) {
			const detail = error instanceof Error ? `: ${displayErrorDetail(error.message)}` : "";
			ctx.ui.notify(translate("copyFailed", { detail }, locale), "error");
		}
	};

	const availableSnippets = (ctx: ExtensionContext): CodeSnippet[] => {
		const snippets = latestAssistantSnippets(ctx.sessionManager.getBranch());
		options.refreshIndicator(ctx, snippets);
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
		if (options.isPickerActive() || !canCopy(ctx)) return;
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
			selectedIndex = await options.openPicker(
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
		if (options.isPickerActive() || !canCopy(ctx)) return;
		const snippets = availableSnippets(ctx);
		if (notifyIfEmpty(snippets, ctx)) return;
		if (snippets.length === 1) {
			await copySnippet(snippets[0]!, ctx);
			return;
		}

		let selectedIndex: unknown;
		try {
			selectedIndex = await options.openPicker(
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

	return { canCopy, chooseAndCopy, quickCopyByNumber };
}

/**
 * @packageDocumentation
 *
 * Pi extension entry point and public API re-exports. It renders assistant code
 * fences as safe panels and lets users explicitly copy each snippet.
 */
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { createCopySelectionController } from "./src/copy-selection.js";
import { parseSnippetIndex } from "./src/index-selection.js";
import { translate } from "./src/messages.js";
import { createPickerLifecycle } from "./src/picker-lifecycle.js";
import {
	decorateAssistantSnippets,
	displayIndexDiagnostic,
	displayMarkdown,
} from "./src/presentation.js";
import { refreshSnippetIndicator, SNIPPET_INDICATOR_KEY } from "./src/snippet-indicator.js";
import {
	isAssistantMessage,
	latestAssistantSnippets,
	snippetsFromAssistantMessage,
	type CodeSnippet,
} from "./src/snippets.js";

export { TRANSLATIONS, translate, validateTranslations } from "./src/messages.js";
export { formatKeyId, SnippetNumberPrompt, SnippetPicker } from "./src/pickers.js";
export { decorateAssistantSnippets, displaySearchQuery, snippetLabel, snippetSearchMetadata } from "./src/presentation.js";
export {
	extractFencedCodeBlocks,
	latestAssistantSnippets,
	snippetsFromAssistantMessage,
	type CodeSnippet,
} from "./src/snippets.js";

const SHORTCUT = "ctrl+shift+c";

/**
 * Registers rendering, lifecycle hooks, and explicit copy controls for a Pi session.
 *
 * @remarks Only `snippet.code` is supplied to the clipboard; display formatting,
 * labels, and terminal sanitization are never copied.
 *
 * @param pi - Extension API instance supplied by Pi.
 * @param locale - Optional requested UI locale.
 * @public
 */
export default function betterSnippetsExtension(pi: ExtensionAPI, locale?: string) {
	let latestSnippets: CodeSnippet[] = [];
	let conversationTheme: Theme | undefined;
	const pickerLifecycle = createPickerLifecycle();
	const refreshIndicator = (
		ctx: Parameters<typeof refreshSnippetIndicator>[0],
		snippets: readonly CodeSnippet[] = latestSnippets,
	) => {
		refreshSnippetIndicator(ctx, snippets.length, locale);
	};
	const copySelection = createCopySelectionController({
		locale,
		isPickerActive: () => pickerLifecycle.active,
		openPicker: (ctx, create, overlayOptions) => pickerLifecycle.open(ctx, create, overlayOptions),
		refreshIndicator,
	});

	pi.registerMarkdownTransformer((markdown, context) => {
		if (context.messageType !== "assistant") return markdown;
		return conversationTheme
			? decorateAssistantSnippets(markdown, context.availableWidth, conversationTheme, locale)
			: displayMarkdown(markdown);
	});

	pi.on("session_start", (_event, ctx) => {
		conversationTheme = ctx.ui.theme;
		latestSnippets = latestAssistantSnippets(ctx.sessionManager.getBranch());
		refreshIndicator(ctx);
	});

	pi.on("session_before_tree", () => {
		pickerLifecycle.cancel();
	});

	pi.on("session_tree", (_event, ctx) => {
		pickerLifecycle.cancel();
		latestSnippets = latestAssistantSnippets(ctx.sessionManager.getBranch());
		refreshIndicator(ctx);
	});

	pi.on("message_end", (event, ctx) => {
		if (!isAssistantMessage(event.message)) return;
		latestSnippets = snippetsFromAssistantMessage(event.message);
		refreshIndicator(ctx);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		pickerLifecycle.cancel();
		latestSnippets = [];
		conversationTheme = undefined;
		ctx.ui.setWidget(SNIPPET_INDICATOR_KEY, undefined);
	});

	pi.registerCommand("copy-snippet", {
		description: translate("commandDescription", locale),
		handler: async (args, ctx) => {
			if (!copySelection.canCopy(ctx)) return;
			const value = args.trim();
			if (value) {
				const requestedIndex = parseSnippetIndex(value);
				if (!requestedIndex) {
					ctx.ui.notify(`${translate("invalidIndex", { value: displayIndexDiagnostic(args) }, locale)}. ${translate("usage", locale)}`, "error");
					return;
				}
				await copySelection.chooseAndCopy(ctx, requestedIndex);
				return;
			}
			await copySelection.chooseAndCopy(ctx);
		},
	});

	// Pi resolves shortcut conflicts after registration and exposes no result; the widget always shows /copy-snippet as a fallback.
	pi.registerShortcut(SHORTCUT, {
		description: translate("shortcutDescription", locale),
		handler: async (ctx) => copySelection.quickCopyByNumber(ctx),
	});
}

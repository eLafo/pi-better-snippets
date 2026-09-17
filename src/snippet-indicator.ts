/**
 * Installs the footer indicator for snippets available in the latest assistant response.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { translate } from "./messages.js";

/** Stable key used to replace or clear the extension footer widget. */
export const SNIPPET_INDICATOR_KEY = "better-snippets";
const SHORTCUT = "ctrl+shift+c";

/**
 * Refreshes the snippet footer indicator for the current host mode and count.
 */
export function refreshSnippetIndicator(ctx: ExtensionContext, snippetCount: number, locale?: string): void {
	if (ctx.mode !== "tui" || snippetCount === 0) {
		ctx.ui.setWidget(SNIPPET_INDICATOR_KEY, undefined);
		return;
	}
	const text = snippetCount === 1
		? translate("widgetOne", { count: snippetCount, shortcut: SHORTCUT }, locale)
		: translate("widgetMany", { count: snippetCount, shortcut: SHORTCUT }, locale);
	ctx.ui.setWidget(
		SNIPPET_INDICATOR_KEY,
		(_tui, theme) => ({
			render: (width) => [theme.fg("dim", truncateToWidth(text, width, ""))],
			invalidate: () => undefined,
		}),
		{ placement: "belowEditor" },
	);
}

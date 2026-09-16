import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Deliberately conflicts with the extension shortcut for the installed Pi host smoke test. */
export default function shortcutConflictFixture(pi: ExtensionAPI): void {
	pi.registerShortcut("ctrl+shift+c", {
		description: "Host collision fixture",
		handler: () => undefined,
	});
}

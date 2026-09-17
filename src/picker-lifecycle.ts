/**
 * Owns the lifecycle of the one active custom picker overlay for an extension instance.
 */
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type {
	Component,
	KeybindingsManager,
	OverlayHandle,
	OverlayOptions,
	TUI,
} from "@earendil-works/pi-tui";

/** A picker component that can optionally release host resources on cancellation. */
export type PickerComponent = Component & { dispose?(): void };

/** Creates a picker component for Pi's custom-overlay API. */
export type PickerFactory = (
	tui: TUI,
	theme: Theme,
	keybindings: KeybindingsManager,
	done: (value: unknown) => void,
) => PickerComponent;

/** Controls one cancellable picker operation at a time. */
export interface PickerLifecycle {
	readonly active: boolean;
	open(ctx: ExtensionContext, create: PickerFactory, overlayOptions: OverlayOptions): Promise<unknown>;
	cancel(): void;
}

/**
 * Creates a controller that guarantees a cancelled picker settles with `undefined`.
 */
export function createPickerLifecycle(): PickerLifecycle {
	let activePicker: { cancel(): void } | undefined;

	return {
		get active() {
			return activePicker !== undefined;
		},
		cancel() {
			activePicker?.cancel();
		},
		async open(ctx, create, overlayOptions) {
			let done: ((value: unknown) => void) | undefined;
			let handle: OverlayHandle | undefined;
			let component: PickerComponent | undefined;
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
		},
	};
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type KeyId, visibleWidth } from "@earendil-works/pi-tui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { copyToClipboard, highlightCode } = vi.hoisted(() => ({
	copyToClipboard: vi.fn(async (_text: string) => undefined),
	highlightCode: vi.fn((code: string, language?: string) => code.split("\n").map((line) =>
		language ? `\x1b[35m${line}\x1b[39m` : line,
	)),
}));
vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => ({
	...(await importOriginal<typeof import("@earendil-works/pi-coding-agent")>()),
	copyToClipboard,
	highlightCode,
}));

import * as publicApi from "../index.js";
import type { CodeSnippet } from "../index.js";
import extension, {
	decorateAssistantSnippets,
	extractFencedCodeBlocks,
	formatKeyId,
	latestAssistantSnippets,
	SnippetNumberPrompt,
	SnippetPicker,
	snippetLabel,
	snippetSearchMetadata,
	TRANSLATIONS,
	translate,
	validateTranslations,
	snippetsFromAssistantMessage,
} from "../index.js";

type Handler = (event: any, ctx: any) => any;
type Command = { handler(args: string, ctx: any): Promise<void> };
type Shortcut = { handler(ctx: any): Promise<void> | void };
type MarkdownTransformer = (markdown: string, context: any) => string;

const handlers = new Map<string, Handler[]>();
const commands = new Map<string, Command>();
const shortcuts = new Map<string, Shortcut>();
const markdownTransformers: MarkdownTransformer[] = [];

const pi = {
	on(name: string, handler: Handler) {
		handlers.set(name, [...(handlers.get(name) ?? []), handler]);
	},
	registerCommand(name: string, command: Command) {
		commands.set(name, command);
	},
	registerShortcut(name: string, shortcut: Shortcut) {
		shortcuts.set(name, shortcut);
	},
	registerMarkdownTransformer(transformer: MarkdownTransformer) {
		markdownTransformers.push(transformer);
	},
} as unknown as ExtensionAPI;

extension(pi, "en");

function assistant(...texts: string[]) {
	return {
		role: "assistant",
		content: texts.map((text) => ({ type: "text", text })),
	};
}

function entry(message: unknown) {
	return { type: "message", message };
}

function createKeybindings(overrides: Record<string, string[]> = {}) {
	const keys: Record<string, string[]> = {
		"tui.input.tab": ["tab"],
		"tui.select.up": ["up"],
		"tui.select.down": ["down"],
		"tui.select.pageUp": ["pageUp"],
		"tui.select.pageDown": ["pageDown"],
		"tui.select.confirm": ["enter"],
		"tui.select.cancel": ["escape", "ctrl+c"],
		...overrides,
	};
	const dataByKey: Record<string, string> = {
		tab: "\t",
		up: "\x1b[A",
		down: "\x1b[B",
		pageUp: "\x1b[5~",
		pageDown: "\x1b[6~",
		enter: "\r",
		escape: "\x1b",
		"ctrl+c": "\x03",
		j: "j",
		k: "k",
		x: "x",
	};
	return {
		matches: (data: string, binding: string) => keys[binding]!.some((key) => dataByKey[key] === data),
		getKeys: (binding: string) => keys[binding]!,
	};
}

function createContext(entries: unknown[] = [], mode = "tui") {
	return {
		mode,
		hasUI: true,
		sessionManager: { getBranch: () => entries },
		ui: {
			theme: {
				bold: (text: string) => text,
				fg: (_color: string, text: string) => text,
				bg: (_color: string, text: string) => text,
			},
			notify: vi.fn(),
			custom: vi.fn(async (factory: any) => {
				let selected: number | undefined;
				const theme = {
					bold: (text: string) => text,
					fg: (_color: string, text: string) => text,
					bg: (_color: string, text: string) => text,
				};
				const component = factory(
					{ requestRender: vi.fn(), terminal: { rows: 30 } },
					theme,
					createKeybindings(),
					(value: number | undefined) => { selected = value; },
				);
				component.handleInput("\r");
				return selected;
			}),
			setWidget: vi.fn(),
		},
	};
}

async function emit(name: string, event: any, ctx: any) {
	for (const handler of handlers.get(name) ?? []) await handler(event, ctx);
}

function mockAmbientLocale(locale: string): void {
	vi.mocked(Intl.DateTimeFormat).mockReturnValue({
		resolvedOptions: () => ({ locale }),
	} as Intl.DateTimeFormat);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
		resolvedOptions: () => ({ locale: "en" }),
	} as Intl.DateTimeFormat);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("public module contract", () => {
	it("keeps the existing entry-point exports available", () => {
		const snippet: CodeSnippet = { code: "ok", info: "text", language: "text", startLine: 1, endLine: 3 };
		expect(snippet.code).toBe("ok");
		expect(Object.keys(publicApi).sort()).toEqual([
			"SnippetNumberPrompt",
			"SnippetPicker",
			"TRANSLATIONS",
			"decorateAssistantSnippets",
			"default",
			"displaySearchQuery",
			"extractFencedCodeBlocks",
			"formatKeyId",
			"latestAssistantSnippets",
			"snippetLabel",
			"snippetSearchMetadata",
			"snippetsFromAssistantMessage",
			"translate",
			"validateTranslations",
		].sort());
	});
});

describe("fenced snippet parsing", () => {
	it("extracts backtick and tilde blocks with language metadata", () => {
		const markdown = "Intro\n```ts file=demo.ts\nconst value = 1;\n```\n\n~~~bash\nprintf '%s' ok\n~~~~\n";
		expect(extractFencedCodeBlocks(markdown)).toEqual([
			{
				code: "const value = 1;",
				info: "ts file=demo.ts",
				language: "ts",
				startLine: 2,
				endLine: 4,
			},
			{
				code: "printf '%s' ok",
				info: "bash",
				language: "bash",
				startLine: 6,
				endLine: 8,
			},
		]);
	});

	it("preserves internal whitespace and CRLF while removing one structural final newline", () => {
		const [snippet] = extractFencedCodeBlocks("```text\r\n  first\r\n\r\nlast  \r\n```\r\n");
		expect(snippet?.code).toBe("  first\r\n\r\nlast  ");
	});

	it("requires a complete matching fence at least as long as the opener", () => {
		expect(extractFencedCodeBlocks("````js\n```\n````\n")[0]?.code).toBe("```");
		expect(extractFencedCodeBlocks("```js\nconst x = 1;\n~~~")).toEqual([]);
		expect(extractFencedCodeBlocks("```js\nconst x = 1;")).toEqual([]);
	});

	it("normalizes opener indentation, supports empty fences, and rejects backticks in backtick info strings", () => {
		expect(extractFencedCodeBlocks("   ~~~py\n   print(1)\n x = 2\n   ~~~")[0]?.code)
			.toBe("print(1)\nx = 2");
		expect(extractFencedCodeBlocks("   ~~~\n   ~~~")[0]?.code).toBe("");
		expect(extractFencedCodeBlocks("```js`bad\nvalue\n```" )).toEqual([]);
	});

	it("does not form a fence across separate assistant text blocks", () => {
		expect(snippetsFromAssistantMessage(assistant("```ts\nconst x = 1;", "```"))).toEqual([]);
	});

	it("extracts many mixed fences and preserves large and extreme bodies", () => {
		const fences = Array.from({ length: 64 }, (_, index) => {
			const marker = index % 2 ? "~~~" : "````";
			return `${marker}${index % 2 ? "bash" : "ts"}\nblock-${index}\n${marker}`;
		}).join("\nlabel outside\n");
		const largeBody = Array.from({ length: 256 }, () => "x".repeat(4_096)).join("\n");
		const extremeLine = "z".repeat(50_000);
		const parsed = extractFencedCodeBlocks(`${fences}\n\`\`\`text\n${largeBody}\n\`\`\`\n~~~text\n${extremeLine}\n~~~`);

		expect(parsed).toHaveLength(66);
		expect(parsed.slice(0, 64).map((snippet) => snippet.code)).toEqual(Array.from({ length: 64 }, (_, index) => `block-${index}`));
		expect(parsed[64]?.code).toBe(largeBody);
		expect(parsed[65]?.code).toBe(extremeLine);
	});

	it("keeps the distributed skill's labeled backtick and tilde output parser-compatible", () => {
		const skill = readFileSync(resolve(process.cwd(), "skills/copyable-snippets/SKILL.md"), "utf8");
		expect(skill).toContain("each independently usable snippet in its own fenced Markdown block");
		expect(skill).toContain("place it as a short plain-text label immediately before its block");
		const output = "src/demo.ts\n```ts\nexport const answer = 42;\n```\nconfig/example\n~~~json\n{\"ok\":true}\n~~~";
		expect(extractFencedCodeBlocks(output).map(({ language, code }) => ({ language, code }))).toEqual([
			{ language: "ts", code: "export const answer = 42;" },
			{ language: "json", code: "{\"ok\":true}" },
		]);
	});

	it("keeps decorated fence rows within widths one through five", () => {
		const theme = {
			fg: (_color: string, text: string) => text,
			bg: (_color: string, text: string) => text,
		} as any;
		for (let width = 1; width <= 5; width++) {
			const rows = decorateAssistantSnippets("```text\nwide\n```", width, theme).split("\n");
			expect(rows.every((row) => visibleWidth(row) <= width)).toBe(true);
		}
	});

	it("decorates complete fences as themed code panels without fence markers", () => {
		const theme = {
			fg: vi.fn((_color: string, text: string) => text),
			bg: vi.fn((_color: string, text: string) => text),
		} as any;
		const rendered = decorateAssistantSnippets("Before\n\n```bash\necho ok\n```\n\nAfter", 32, theme);

		expect(rendered).not.toContain("```");
		expect(rendered).toContain("Before");
		expect(rendered).toContain("╭─ \\[1\\] bash");
		expect(rendered).toContain("echo ok");
		expect(rendered).toContain("╰");
		expect(rendered).toContain("After");
		expect(theme.bg).toHaveBeenCalledWith("toolPendingBg", expect.any(String));
	});
});

describe("assistant selection", () => {
	it("uses only the latest assistant message on the active branch", () => {
		const entries = [
			entry(assistant("```old\none\n```")),
			entry({ role: "user", content: "continue" }),
			entry(assistant("```new\ntwo\n```")),
		];
		expect(latestAssistantSnippets(entries).map((snippet) => snippet.code)).toEqual(["two"]);
	});

	it("ignores thinking and tool calls", () => {
		const message = {
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "```secret\nno\n```" },
				{ type: "toolCall", name: "read" },
				{ type: "text", text: "```ts\nyes\n```" },
			],
		};
		expect(snippetsFromAssistantMessage(message).map((snippet) => snippet.code)).toEqual(["yes"]);
	});

	it("ignores null, primitive, and malformed assistant content blocks", () => {
		const message = {
			role: "assistant",
			content: [null, 1, "text", {}, { type: "text" }, { type: "text", text: 3 }, { type: "text", text: "```ts\nvalid\n```" }],
		};
		expect(snippetsFromAssistantMessage(message).map((snippet) => snippet.code)).toEqual(["valid"]);
	});

	it("builds bounded, informative selector labels", () => {
		const label = snippetLabel({ code: "\nconst answer = 42;\n", info: "ts", language: "ts", startLine: 1, endLine: 4 }, 1);
		expect(label).toBe("2. ts · 3 lines — const answer = 42;");
	});
});

describe("localized picker UI", () => {
	const theme = {
		bold: (text: string) => text,
		fg: (_color: string, text: string) => text,
		bg: (_color: string, text: string) => text,
	} as any;
	const snippets = [
		{ code: "café cafe\u0301 👨‍👩‍👧‍👦 עברית العربية\nsecond line", info: "ts", language: "ts", startLine: 1, endLine: 4 },
		{ code: "\u2066hidden\u2069 visible", info: "text", language: "text", startLine: 5, endLine: 7 },
	];

	it("canonicalizes supported locales and deterministically falls back to English", () => {
		expect(translate("cancel", "en")).toBe("cancel");
		expect(translate("cancel", "en-US")).toBe("cancel");
		for (const locale of ["es", "es-MX", "ES-mx"]) expect(translate("cancel", locale)).toBe("cancelar");
		expect(translate("snippetUnavailable", { number: 4 }, "es-MX")).toBe("El fragmento 4 no está disponible");
		expect(snippetLabel({ ...snippets[0]!, code: "one" }, 0, "es")).toContain("1 línea");
		expect(snippetLabel({ ...snippets[0]!, code: "one\ntwo" }, 0, "es")).toContain("2 líneas");
		for (const [ambient, omitted] of [["en-US", "cancel"], ["es-MX", "cancelar"]] as const) {
			mockAmbientLocale(ambient);
			expect(translate("cancel")).toBe(omitted);
			for (const locale of ["fr-FR", "\uD800"]) expect(translate("cancel", locale)).toBe("cancel");
		}
	});

	it("rejects missing or unexpected interpolation values at compile time and runtime", () => {
		if (false) {
			// @ts-expect-error placeholder-bearing keys require their typed values
			translate("snippetUnavailable");
			// @ts-expect-error keys without placeholders do not accept interpolation values
			translate("cancel", { value: "unexpected" });
			// @ts-expect-error placeholder-bearing keys reject unexpected values
			translate("copied", { language: "ts", detail: "unexpected" });
		}
		expect(() => (translate as (key: string, values: Record<string, string>) => string)("snippetUnavailable", {}))
			.toThrow("Invalid interpolation values");
		const broken = structuredClone(TRANSLATIONS);
		broken.es.copied = "Fragmento {language} {extra}";
		expect(() => validateTranslations(broken)).toThrow("Invalid es translation placeholders for copied");
		const missing = structuredClone(TRANSLATIONS);
		missing.en.copied = "Copied snippet";
		expect(() => validateTranslations(missing)).toThrow("Invalid en translation placeholders for copied");
		const duplicate = structuredClone(TRANSLATIONS);
		duplicate.en.copied = "Copied {language} {language}";
		expect(() => validateTranslations(duplicate)).toThrow("Invalid en translation placeholders for copied");
	});

	it("localizes every named Pi-TUI key while preserving literals and modifiers", () => {
		const expected: Array<[KeyId, string, string]> = [
			["escape", "Esc", "Esc"], ["esc", "Esc", "Esc"], ["enter", "Intro", "Enter"], ["return", "Intro", "Enter"], ["tab", "Tab", "Tab"], ["space", "Espacio", "Space"],
			["backspace", "Retroceso", "Backspace"], ["delete", "Supr", "Delete"], ["insert", "Insert", "Insert"], ["clear", "Borrar", "Clear"], ["home", "Inicio", "Home"], ["end", "Fin", "End"],
			["pageUp", "RePág", "PgUp"], ["pageDown", "AvPág", "PgDn"], ["up", "↑", "↑"], ["down", "↓", "↓"], ["left", "←", "←"], ["right", "→", "→"],
			["f1", "F1", "F1"], ["f2", "F2", "F2"], ["f3", "F3", "F3"], ["f4", "F4", "F4"], ["f5", "F5", "F5"], ["f6", "F6", "F6"], ["f7", "F7", "F7"], ["f8", "F8", "F8"], ["f9", "F9", "F9"], ["f10", "F10", "F10"], ["f11", "F11", "F11"], ["f12", "F12", "F12"],
			["ctrl+home", "Ctrl+Inicio", "Ctrl+Home"], ["shift+space", "Shift+Espacio", "Shift+Space"], ["alt+delete", "Alt+Supr", "Alt+Delete"], ["super+pageDown", "Super+AvPág", "Super+PgDn"], ["ctrl+shift+home", "Ctrl+Shift+Inicio", "Ctrl+Shift+Home"],
			["a", "a", "a"], ["1", "1", "1"], ["+", "+", "+"], ["/", "/", "/"], ["ctrl++", "Ctrl++", "Ctrl++"], ["alt+/", "Alt+/", "Alt+/"],
		];
		for (const [key, spanish, english] of expected) {
			expect(formatKeyId(key, "es-MX")).toBe(spanish);
			expect(formatKeyId(key, "en-US")).toBe(english);
		}
		const configured = createKeybindings({
			"tui.input.tab": ["space"],
			"tui.select.up": ["backspace"],
			"tui.select.down": ["home"],
			"tui.select.cancel": [],
		});
		const picker = new SnippetPicker(snippets, theme, configured as any, () => 24, vi.fn(), () => undefined, "es");
		const output = picker.render(120).join("\n");
		expect(output).toContain("Espacio foco · Retroceso/Inicio");
		expect(output).toContain("sin asignar cancelar");
	});

	it("substitutes every placeholder-bearing key in both catalogs", () => {
		const examples = [
			{ format: (locale: string) => translate("snippetUnavailable", { number: 7 }, locale), values: ["7"] },
			{ format: (locale: string) => translate("pressNumber", { range: "1-9" }, locale), values: ["1-9"] },
			{ format: (locale: string) => translate("copied", { language: "ts" }, locale), values: ["ts"] },
			{ format: (locale: string) => translate("copyFailed", { detail: ": error" }, locale), values: [": error"] },
			{ format: (locale: string) => translate("invalidIndex", { value: "x" }, locale), values: ["x"] },
			{ format: (locale: string) => translate("invalidSnippet", { value: "7", available: "1-2" }, locale), values: ["7", "1-2"] },
			{ format: (locale: string) => translate("lineCountOne", { count: 1 }, locale), values: ["1"] },
			{ format: (locale: string) => translate("lineCountMany", { count: 2 }, locale), values: ["2"] },
			{ format: (locale: string) => translate("snippetLabel", { index: 1, language: "ts", lines: "2", preview: "ok" }, locale), values: ["1", "ts", "2", "ok"] },
			{ format: (locale: string) => translate("promptHint", { range: "1", cancelKey: "Esc" }, locale), values: ["1", "Esc"] },
			{ format: (locale: string) => translate("promptHintMany", { range: "1-9", command: "/copy-snippet", cancelKey: "Esc" }, locale), values: ["1-9", "/copy-snippet", "Esc"] },
			{ format: (locale: string) => translate("pickerTitle", { focus: "lista" }, locale), values: ["lista"] },
			{ format: (locale: string) => translate("rangeOf", { start: 1, end: 2, total: 3 }, locale), values: ["1", "2", "3"] },
			{ format: (locale: string) => translate("previewLines", { start: 1, end: 2 }, locale), values: ["1", "2"] },
			{ format: (locale: string) => translate("compactFooter", { arrows: "↑/↓", confirm: "Intro", cancelKey: "Esc" }, locale), values: ["↑/↓", "Intro", "Esc"] },
			{ format: (locale: string) => translate("widgetOne", { count: 1, shortcut: "Ctrl+C" }, locale), values: ["1", "Ctrl+C"] },
			{ format: (locale: string) => translate("widgetMany", { count: 2, shortcut: "Ctrl+C" }, locale), values: ["2", "Ctrl+C"] },
		];
		for (const locale of ["en", "es"]) for (const example of examples) {
			const rendered = example.format(locale);
			for (const value of example.values) expect(rendered).toContain(value);
			expect(rendered).not.toMatch(/\{\w+\}/);
		}
	});

	it("keeps every Spanish picker and prompt row bounded at narrow widths", () => {
		const bindings = createKeybindings({ "tui.select.confirm": [] });
		const picker = new SnippetPicker(snippets, theme, bindings as any, () => 24, vi.fn(), () => undefined, "ES-mx");
		const prompt = new SnippetNumberPrompt(12, theme, bindings, vi.fn(), () => undefined, "es-MX");
		for (let width = 1; width <= 60; width++) {
			for (const row of [...picker.render(width), ...prompt.render(width)]) expect(visibleWidth(row)).toBeLessThanOrEqual(width);
		}
		const output = picker.render(60).join("\n");
		expect(output).toContain("Copiar fragmento");
		expect(output).toContain("café cafe\u0301 👨‍👩‍👧‍👦 עברית العربية");
		expect(output).toContain("👨‍👩‍👧‍👦");
		expect(output).not.toMatch(/[\u200B-\u200C\u200E-\u200F\u202A-\u202E\u2060-\u206F]/u);
		const unsafeLabel = snippetLabel(snippets[1]!, 1, "es");
		expect(unsafeLabel).toContain("�hidden� visible");
		expect(unsafeLabel).not.toMatch(/[\u200B-\u200C\u200E-\u200F\u202A-\u202E\u2060-\u206F]/u);
		expect(output).not.toMatch(/\b(?:snippet|preview|lines|scroll|copy|cancel|unbound)\b/i);
		picker.handleInput("\t");
		expect(picker.render(60).join("\n")).toContain("Vista previa");

		const compact = new SnippetPicker(snippets, theme, bindings as any, () => 8, vi.fn(), () => undefined, "es");
		expect(compact.render(60).join("\n")).toContain("Copiar fragmento · Vista previa");
		const errorPrompt = new SnippetNumberPrompt(2, theme, bindings, vi.fn(), () => undefined, "es");
		errorPrompt.handleInput("9");
		expect(errorPrompt.render(60).join("\n")).toContain("El fragmento 9 no está disponible");
		const failingTheme = { ...theme, fg: () => { throw new Error("fallo"); } };
		const fallbackPrompt = new SnippetNumberPrompt(2, failingTheme, bindings, vi.fn(), () => undefined, "es");
		const fallbackPicker = new SnippetPicker(snippets, failingTheme, bindings as any, () => 24, vi.fn(), () => undefined, "es");
		expect(errorPrompt.render(60).join("\n")).toContain("Pulsa");
		expect(fallbackPrompt.render(60).join("\n")).toContain("Selector numérico no disponible");
		expect(fallbackPicker.render(60).join("\n")).toContain("Vista previa no disponible");
		for (let width = 1; width <= 60; width++) {
			for (const row of [
				...picker.render(width), ...compact.render(width), ...prompt.render(width), ...errorPrompt.render(width),
				...fallbackPrompt.render(width), ...fallbackPicker.render(width),
			]) expect(visibleWidth(row)).toBeLessThanOrEqual(width);
		}
		expect(picker.render(60).join("\n")).toContain("Tab foco");
		expect(compact.render(60).join("\n")).toContain("desplazar");
	});

	it("uses the injected Spanish locale for widgets, notifications, and registered descriptions", async () => {
		const localHandlers = new Map<string, Handler[]>();
		let command!: Command & { description: string };
		let shortcut!: Shortcut & { description: string };
		const localPi = {
			on(name: string, handler: Handler) { localHandlers.set(name, [...(localHandlers.get(name) ?? []), handler]); },
			registerCommand(_name: string, registered: Command & { description: string }) { command = registered; },
			registerShortcut(_key: string, registered: Shortcut & { description: string }) { shortcut = registered; },
			registerMarkdownTransformer: () => undefined,
		} as unknown as ExtensionAPI;
		extension(localPi, "es-MX");
		expect(command.description).toContain("Selecciona y copia un fragmento");
		expect(shortcut.description).toContain("Copia un fragmento");

		const ctx = createContext([entry(assistant("```ts\nuno\n```", "```json\ndos\n```"))]);
		await command.handler("9", ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith("El fragmento 9 no existe (disponibles: 1-2)", "error");
		await command.handler("incorrecto", ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith("Número de fragmento no válido: incorrecto. Uso: /copy-snippet [número]", "error");
		await command.handler("1", ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith("Fragmento ts copiado al portapapeles", "info");
		copyToClipboard.mockRejectedValueOnce(new Error("portapapeles"));
		await command.handler("1", ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith("No se pudo copiar el fragmento: portapapeles", "error");
		const emptyContext = createContext();
		await command.handler("", emptyContext);
		expect(emptyContext.ui.notify).toHaveBeenLastCalledWith("La última respuesta del asistente no contiene fragmentos delimitados", "warning");
		const pickerFailure = createContext([entry(assistant("```ts\nuno\n```"))]);
		pickerFailure.ui.custom.mockRejectedValueOnce(new Error("sin selector"));
		await command.handler("", pickerFailure);
		expect(pickerFailure.ui.notify).toHaveBeenLastCalledWith("No se pudo abrir el selector de fragmentos. Inténtalo de nuevo", "error");
		const badSelection = createContext([entry(assistant("```ts\nuno\n```"))]);
		badSelection.ui.custom.mockResolvedValueOnce(-1);
		await command.handler("", badSelection);
		expect(badSelection.ui.notify).toHaveBeenLastCalledWith("No se pudo seleccionar ese fragmento. Inténtalo de nuevo", "error");
		const rpcContext = createContext([entry(assistant("```ts\nuno\n```"))], "rpc");
		await command.handler("1", rpcContext);
		expect(rpcContext.ui.notify).toHaveBeenLastCalledWith("La copia de fragmentos solo está disponible en la TUI interactiva", "warning");

		for (const handler of localHandlers.get("message_end") ?? []) await handler({ message: assistant("```ts\nuno\n```", "```json\ndos\n```") }, ctx);
		const pluralWidget = ctx.ui.setWidget.mock.calls.at(-1)![1];
		const renderPluralWidget = (width: number) => pluralWidget({}, { fg: (_color: string, text: string) => text }).render(width)[0];
		expect(renderPluralWidget(80)).toContain("2 fragmentos");
		for (const handler of localHandlers.get("message_end") ?? []) await handler({ message: assistant("```ts\nuno\n```") }, ctx);
		const singularWidget = ctx.ui.setWidget.mock.calls.at(-1)![1];
		const renderSingularWidget = (width: number) => singularWidget({}, { fg: (_color: string, text: string) => text }).render(width)[0];
		expect(renderSingularWidget(80)).toContain("1 fragmento");
		for (let width = 1; width <= 60; width++) {
			expect(visibleWidth(renderPluralWidget(width))).toBeLessThanOrEqual(width);
			expect(visibleWidth(renderSingularWidget(width))).toBeLessThanOrEqual(width);
		}
	});
});

describe("hostile assistant display values", () => {
	const theme = {
		bold: (text: string) => text,
		fg: (_color: string, text: string) => text,
		bg: (_color: string, text: string) => text,
	} as any;
	const keybindings = createKeybindings();
	const stripTrustedMockSgr = (value: string) => value.replaceAll("\x1b[35m", "").replaceAll("\x1b[39m", "");

	it("neutralizes control sequences before transcript and picker rendering while preserving trusted highlighter SGR", () => {
		const hostileCode = "safe\u0000\x1b[2J\x1b[?25l\x1b[1;2H\x9b31m\x1b]8;;https://example.test\x07\x1b]52;c;secret\x1b\\\x1bPpayload\x1b\\\u2066\nnext\u007f";
		const markdown = `\`\`\`ts\n${hostileCode}\n\`\`\``;
		const rendered = decorateAssistantSnippets(markdown, 200, theme);
		const snippet = extractFencedCodeBlocks(markdown)[0]!;
		const picker = new SnippetPicker([snippet], theme, keybindings as any, () => 24, vi.fn());
		const pickerOutput = picker.render(200).join("\n");

		for (const output of [rendered, pickerOutput]) {
			const withoutTrustedSgr = stripTrustedMockSgr(output);
			expect(output).toContain("\x1b[35m");
			expect(output).toContain("\x1b[39m");
			expect(withoutTrustedSgr).not.toMatch(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u);
		}
		expect(highlightCode).toHaveBeenCalledWith(expect.not.stringContaining("\x1b"), "ts");
	});

	it("sanitizes hostile language metadata without passing it to the highlighter", () => {
		const hostileLanguage = "ts\x1b[31m\x1b]8;;https://example.test\x1b\\\u202E\u200B";
		const markdown = `\`\`\`${hostileLanguage}\ncode\n\`\`\``;
		const rendered = decorateAssistantSnippets(markdown, 80, theme);
		const snippet = extractFencedCodeBlocks(markdown)[0]!;
		const pickerOutput = new SnippetPicker([snippet], theme, keybindings as any, () => 24, vi.fn()).render(80).join("\n");

		for (const output of [rendered, pickerOutput, snippetLabel(snippet, 0)]) {
			expect(stripTrustedMockSgr(output)).not.toMatch(/[\x1b\u0080-\u009F\u202A-\u202E\u200B]/u);
		}
		expect(highlightCode).toHaveBeenLastCalledWith(expect.any(String), undefined);
	});

	it("preserves safe Unicode text and complete emoji graphemes while neutralizing isolated ZWJ", () => {
		const family = "👨‍👩‍👧‍👦";
		const rainbowFlag = "🏳️‍🌈";
		const visibleText = "café cafe\u0301 עברית العربية";
		const safeLabel = snippetLabel({
			code: `${visibleText} ${family} ${rainbowFlag}`,
			info: "text",
			language: "text",
			startLine: 1,
			endLine: 3,
		}, 0);
		const isolatedZwjLabel = snippetLabel({ code: "left\u200Dright", info: "text", language: "text", startLine: 1, endLine: 3 }, 0);
		const combining = "e\u0301";
		const truncated = snippetLabel({ code: combining.repeat(80), info: "text", language: "text", startLine: 1, endLine: 3 }, 0);

		expect(safeLabel).toContain(visibleText);
		expect(safeLabel).toContain(family);
		expect(safeLabel).toContain(rainbowFlag);
		expect(isolatedZwjLabel).toContain("left�right");
		expect(truncated.endsWith(`${combining.repeat(71)}…`)).toBe(true);
	});

	it.each(["\u061C", "\u200E", "\u200F", "\u00AD", "\uFEFF", "\u2066", "\u2069", "\u202E", "\u200B", "\u200D"])(
		"neutralizes unsafe format character %j in display labels",
		(unsafe) => {
			const label = snippetLabel({ code: `left${unsafe}right`, info: "text", language: "text", startLine: 1, endLine: 3 }, 0, "en");
			expect(label).toContain("left�right");
			expect(label).not.toContain(unsafe);
		},
	);

	it("truncates emoji graphemes intact at both sides of the preview boundary", () => {
		const graphemes = ["👨‍👩‍👧‍👦", "🏳️‍🌈", "🇪🇸", "👍🏽"];
		for (const grapheme of graphemes) {
			const retained = snippetLabel({ code: `${"a".repeat(70)}${grapheme}xy`, info: "text", language: "text", startLine: 1, endLine: 3 }, 0, "en");
			const omitted = snippetLabel({ code: `${"a".repeat(71)}${grapheme}x`, info: "text", language: "text", startLine: 1, endLine: 3 }, 0, "en");
			expect(retained.split(" — ").at(-1)).toBe(`${"a".repeat(70)}${grapheme}…`);
			expect(omitted.split(" — ").at(-1)).toBe(`${"a".repeat(71)}…`);
		}
	});

	it("sanitizes large repeated joiners linearly while retaining complete family emoji", () => {
		const family = "👨‍👩‍👧‍👦";
		const isolatedJoiners = "\u200D".repeat(8_000);
		const familyCount = 500;
		const code = `${isolatedJoiners}${family.repeat(familyCount)}`;
		const markdown = `\`\`\`text\n${code}\n\`\`\``;
		const rendered = decorateAssistantSnippets(markdown, 20, theme);
		const highlightedCode = highlightCode.mock.calls.at(-1)![0] as string;

		expect(highlightedCode).toHaveLength(code.length);
		expect(highlightedCode.split("\u200D")).toHaveLength(familyCount * 3 + 1);
		expect(highlightedCode).toContain("�".repeat(100));
		expect(rendered.length).toBeLessThan(100_000);
	});

	it("bounds a pathological combining cluster without splitting surrogate pairs", () => {
		const pathological = `😀${"\u0301".repeat(100_000)}`;
		const markdown = `\`\`\`ts\n${pathological}\n\`\`\``;
		const rendered = decorateAssistantSnippets(markdown, 20, theme);
		const highlightedCode = highlightCode.mock.calls.at(-1)![0] as string;
		const unmatchedSurrogate = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF])/u;

		expect(highlightedCode.length).toBeLessThanOrEqual(16_384);
		expect(Array.from(highlightedCode).length).toBeLessThanOrEqual(16_384);
		expect(highlightedCode).not.toMatch(unmatchedSurrogate);
		expect(rendered.length).toBeLessThan(100_000);
		const picker = new SnippetPicker([extractFencedCodeBlocks(markdown)[0]!], theme, keybindings as any, () => 24, vi.fn());
		picker.render(20);
		expect((highlightCode.mock.calls.at(-1)![0] as string).length).toBeLessThanOrEqual(16_384);
	});

	it("bounds highlighting, language labels, and picker rows", () => {
		const invalidLanguage = `typescript-${"x".repeat(200)}\x1b[31m`;
		const hugeCode = "x".repeat(20_000);
		const snippet = { code: hugeCode, info: invalidLanguage, language: invalidLanguage, startLine: 1, endLine: 3 };
		const rendered = decorateAssistantSnippets(`\`\`\`${invalidLanguage}\n${hugeCode}\n\`\`\``, 80, theme);
		const highlightedCode = highlightCode.mock.calls.at(-1)![0] as string;
		const picker = new SnippetPicker([snippet], theme, keybindings as any, () => 24, vi.fn());
		const pickerRows = picker.render(24);
		const language64 = "a".repeat(64);
		const language65 = "b".repeat(65);

		expect(highlightedCode).toHaveLength(16_384);
		expect(highlightCode).toHaveBeenLastCalledWith(expect.any(String), undefined);
		expect(rendered.length).toBeLessThan(30_000);
		expect(snippetLabel({ code: "ok", info: language64, language: language64, startLine: 1, endLine: 3 }, 0)).toContain(language64);
		expect(snippetLabel({ code: "ok", info: language65, language: language65, startLine: 1, endLine: 3 }, 0)).toContain(`${"b".repeat(63)}…`);
		expect(pickerRows.every((row) => visibleWidth(row) <= 24)).toBe(true);
	});

	it("keeps sanitized replacement offsets aligned with mixed CRLF, tabs, and a suffix", () => {
		const markdown = `\`\`\`ts\r\n\tpadding\r\n${"\r\n".repeat(9)}\x1b[2J\r\n\`\`\`\r\ntrailing suffix`;
		const rendered = decorateAssistantSnippets(markdown, 80, theme);

		expect(rendered).toContain("trailing suffix");
		expect(stripTrustedMockSgr(rendered)).not.toContain("\x1b");
	});
});

describe("numeric quick-copy prompt", () => {
	const theme = {
		bold: (text: string) => text,
		fg: (_color: string, text: string) => text,
	} as any;
	const keybindings = createKeybindings();

	it("copies a valid snippet as soon as its number is pressed", () => {
		const done = vi.fn();
		const prompt = new SnippetNumberPrompt(3, theme, keybindings, done);
		prompt.handleInput("2");
		expect(done).toHaveBeenCalledWith(1);
	});

	it("keeps waiting after an unavailable number and supports cancellation", () => {
		const done = vi.fn();
		const onChange = vi.fn();
		const prompt = new SnippetNumberPrompt(2, theme, keybindings, done, onChange);
		prompt.handleInput("3");
		expect(done).not.toHaveBeenCalled();
		expect(onChange).toHaveBeenCalledOnce();
		expect(prompt.render(48).join("\n")).toContain("Snippet 3 is not available");
		prompt.handleInput("\x1b");
		expect(done).toHaveBeenCalledWith(undefined);
	});

	it("advertises the command fallback when more than nine snippets exist", () => {
		const prompt = new SnippetNumberPrompt(12, theme, keybindings, vi.fn());
		expect(prompt.render(48).join("\n")).toContain("/copy-snippet 10+");
	});
});

describe("snippet picker", () => {
	const theme = {
		bold: (text: string) => text,
		fg: (_color: string, text: string) => text,
		bg: vi.fn((_color: string, text: string) => text),
	} as any;
	const keybindings = createKeybindings();
	const snippets = [
		{ code: "one", info: "ts", language: "ts", startLine: 1, endLine: 3 },
		{ code: Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n"), info: "text", language: "text", startLine: 4, endLine: 17 },
	];

	it("renders the selected snippet content in a bounded floating view", () => {
		const picker = new SnippetPicker(snippets, theme, keybindings as any, () => 24, vi.fn());
		const rendered = picker.render(72).join("\n");
		expect(rendered).toContain("Copy snippet");
		expect(rendered).toContain("/search");
		expect(rendered).toContain("╭─ Preview · ts");
		expect(rendered).toContain("one");
		expect(rendered).toContain("╰─ Rows 1-1 of 1");
		expect(rendered).toContain("Enter copy");
		expect(theme.bg).toHaveBeenCalledWith("toolPendingBg", expect.stringContaining("one"));
	});

	it("syntax-highlights the full preview using the fenced language", () => {
		const highlighted = [{
			code: "const answer = 42;\nconsole.log(answer);",
			info: "ts",
			language: "ts",
			startLine: 1,
			endLine: 4,
		}];
		const picker = new SnippetPicker(highlighted, theme, keybindings as any, () => 24, vi.fn());
		const rendered = picker.render(72).join("\n");

		expect(highlightCode).toHaveBeenCalledWith(highlighted[0]!.code, "ts");
		expect(rendered).toContain("\x1b[35mconst answer = 42;\x1b[39m");
	});

	it("filters by safe number, language, and preview metadata only after entering search mode", () => {
		const done = vi.fn();
		const picker = new SnippetPicker([
			{ code: "not searchable beyond its preview\nprivate-token", info: "ts", language: "TypeScript", startLine: 1, endLine: 3 },
			{ code: "matched preview", info: "py", language: "Python", startLine: 4, endLine: 6 },
		], theme, keybindings as any, () => 24, done);
		expect(picker.render(72).join("\n")).toContain("TypeScript");
		picker.handleInput("/");
		picker.handleInput("2");
		expect(picker.getSelection()).toBe(1);
		expect(picker.render(72).join("\n")).toContain("Search: 2");
		picker.handleInput("\r");
		expect(done).toHaveBeenCalledWith(1);

		const bodyPicker = new SnippetPicker([{ code: "visible\nprivate-token", info: "ts", language: "ts", startLine: 1, endLine: 3 }], theme, keybindings as any, () => 24, vi.fn());
		bodyPicker.handleInput("/");
		for (const character of "private-token") bodyPicker.handleInput(character);
		expect(bodyPicker.render(72).join("\n")).toContain("No matching snippets");
	});

	it("restores the normal list and selection when search is cleared or left", () => {
		const picker = new SnippetPicker(snippets, theme, keybindings as any, () => 24, vi.fn());
		picker.handleInput("\x1b[B");
		picker.handleInput("/");
		picker.handleInput("o");
		expect(picker.getSelection()).toBe(0);
		picker.handleInput("\x7f");
		expect(picker.getSelection()).toBe(1);
		picker.handleInput("o");
		picker.handleInput("\x1b");
		expect(picker.getSelection()).toBe(1);
		expect(picker.render(72).join("\n")).toContain("2. text");
	});

	it("keeps filtered search metadata and narrow layouts terminal-safe", () => {
		const hostile = { code: `first\x1b]8;;https://bad\x07\n${"x".repeat(500)}`, info: "\x1b[31mjs", language: "\x1b[31mjs", startLine: 1, endLine: 3 };
		expect(snippetSearchMetadata(hostile, 0)).not.toMatch(/[\x00-\x1f\x7f]/);
		const picker = new SnippetPicker([hostile], theme, keybindings as any, () => 8, vi.fn(), () => undefined, "es");
		picker.handleInput("/");
		picker.handleInput("\x1b[31m");
		for (let width = 1; width <= 20; width++) expect(picker.render(width).every((row) => visibleWidth(row) <= width)).toBe(true);
		expect(picker.render(60).join("\n")).toContain("Buscar:");
	});

	it("uses Tab to focus the preview and arrows to scroll it", () => {
		const onChange = vi.fn();
		const picker = new SnippetPicker(snippets, theme, keybindings as any, () => 24, vi.fn(), onChange);
		picker.handleInput("\x1b[B");
		expect(picker.getSelection()).toBe(1);
		picker.render(72);
		picker.handleInput("\t");
		expect(picker.getFocus()).toBe("preview");
		picker.handleInput("\x1b[B");
		expect(picker.getSelection()).toBe(1);
		expect(picker.getPreviewOffset()).toBe(1);
		picker.handleInput("\t");
		expect(picker.getFocus()).toBe("list");
		expect(onChange).toHaveBeenCalledTimes(4);
	});

	it("uses signed logical wheel deltas and ignores absent or zero deltas", () => {
		const code = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join("\n");
		const picker = new SnippetPicker([{ code, info: "text", language: "text", startLine: 1, endLine: 42 }], theme, keybindings as any, () => 24, vi.fn());
		picker.render(72);
		expect(picker.getFocus()).toBe("list");
		expect(picker.handleMouse({ type: "wheel" } as any)).toBeUndefined();
		expect(picker.handleMouse({ type: "wheel", wheelDelta: 0 } as any)).toBeUndefined();
		expect(picker.getFocus()).toBe("list");
		expect(picker.getPreviewOffset()).toBe(0);
		expect(picker.handleMouse({ type: "wheel", wheelDelta: 5 } as any)).toEqual({ handled: true, focus: true, render: true });
		expect(picker.getPreviewOffset()).toBe(5);
		picker.handleMouse({ type: "wheel", wheelDelta: 7 } as any);
		expect(picker.getPreviewOffset()).toBe(12);
		picker.handleMouse({ type: "wheel", wheelDelta: -3 } as any);
		expect(picker.getPreviewOffset()).toBe(9);
		picker.handleMouse({ type: "wheel", wheelDelta: -50 } as any);
		expect(picker.getPreviewOffset()).toBe(0);
	});

	it("supports mouse selection and double-click confirmation", () => {
		const done = vi.fn();
		const picker = new SnippetPicker(snippets, theme, keybindings as any, () => 24, done);
		picker.render(72);
		picker.handleMouse({ type: "click", button: "left", x: 4, y: 4, clickCount: 1 } as any);
		expect(picker.getSelection()).toBe(1);
		picker.handleMouse({ type: "click", button: "left", x: 4, y: 4, clickCount: 2 } as any);
		expect(done).toHaveBeenCalledWith(1);
	});

	it("adapts list and preview rows when an open terminal shrinks", () => {
		const many = Array.from({ length: 10 }, (_, index) => ({
			code: `snippet ${index + 1}`,
			info: "text",
			language: "text",
			startLine: index * 3 + 1,
			endLine: index * 3 + 3,
		}));
		let rows = 24;
		const picker = new SnippetPicker(many, theme, keybindings as any, () => rows, vi.fn());
		expect(picker.render(72)).toHaveLength(24);
		rows = 12;
		const rendered = picker.render(72);
		expect(rendered.length).toBeLessThanOrEqual(12);
		expect(rendered.join("\n")).toContain("Preview · text");
		expect(rendered.at(-1)).toContain("╰");
	});

	it("does not treat short-layout preview rows as snippet mouse targets", () => {
		const many = Array.from({ length: 10 }, (_, index) => ({
			code: `snippet ${index + 1}`,
			info: "text",
			language: "text",
			startLine: index * 3 + 1,
			endLine: index * 3 + 3,
		}));
		const done = vi.fn();
		const picker = new SnippetPicker(many, theme, keybindings as any, () => 12, done);
		picker.render(72);
		expect(picker.handleMouse({ type: "click", button: "left", x: 4, y: 5, clickCount: 2 } as any))
			.toBeUndefined();
		expect(picker.getSelection()).toBe(0);
		expect(done).not.toHaveBeenCalled();
	});

	it("sweeps narrow and expanded widths with tabs, wide Unicode, and resize changes", () => {
		const longUnicode = [{
			code: `\t界 emoji 👨‍👩‍👧‍👦 cafe\u0301 עברית العربية ${"x".repeat(200)}\n${Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")}`,
			info: "text", language: "text", startLine: 1, endLine: 23,
		}];
		let rows = 24;
		const picker = new SnippetPicker(longUnicode, theme, keybindings as any, () => rows, vi.fn());
		for (let width = 1; width <= 20; width++) {
			expect(picker.render(width).every((row) => visibleWidth(row) <= width)).toBe(true);
		}
		expect(picker.render(20).every((row) => visibleWidth(row) <= 20)).toBe(true);
		expect(picker.render(80).every((row) => visibleWidth(row) <= 80)).toBe(true);
		rows = 8;
		expect(picker.render(20).length).toBeLessThanOrEqual(8);
		rows = 24;
		const expanded = picker.render(80);
		expect(expanded.length).toBeGreaterThan(8);
		expect(expanded.length).toBeLessThanOrEqual(24);
		expect(expanded.every((row) => visibleWidth(row) <= 80)).toBe(true);
	});

	it("wraps long lines so the entire content can be previewed", () => {
		const long = [{ code: `start-${"x".repeat(80)}-end`, info: "text", language: "text", startLine: 1, endLine: 3 }];
		const picker = new SnippetPicker(long, theme, keybindings as any, () => 24, vi.fn());
		const rendered = picker.render(40).join("\n");
		expect(rendered).toContain("start-");
		expect(rendered).toContain("-end");

		const compact = new SnippetPicker(long, theme, keybindings as any, () => 8, vi.fn());
		expect(compact.render(40).join("\n")).toContain("start-");
		compact.handleInput("\x1b[6~");
		compact.handleInput("\x1b[6~");
		compact.handleInput("\x1b[6~");
		expect(compact.render(40).join("\n")).toContain("-end");
	});

	it("honors configured selector bindings including Ctrl+C cancellation", () => {
		const configured = createKeybindings({
			"tui.select.down": ["j"],
			"tui.select.confirm": ["x"],
		});
		const done = vi.fn();
		const picker = new SnippetPicker(snippets, theme, configured as any, () => 24, done);
		picker.handleInput("\x1b[B");
		expect(picker.getSelection()).toBe(0);
		picker.handleInput("j");
		expect(picker.getSelection()).toBe(1);
		picker.handleInput("x");
		expect(done).toHaveBeenCalledWith(1);

		const cancel = vi.fn();
		new SnippetPicker(snippets, theme, configured as any, () => 24, cancel).handleInput("\x03");
		expect(cancel).toHaveBeenCalledWith(undefined);
	});
});

describe("extension integration", () => {
	it("registers lifecycle hooks, command, shortcut, and Markdown transformer", () => {
		expect(commands.has("copy-snippet")).toBe(true);
		expect(shortcuts.has("ctrl+shift+c")).toBe(true);
		expect(handlers.has("message_end")).toBe(true);
		expect(handlers.has("session_tree")).toBe(true);
		expect(handlers.has("session_shutdown")).toBe(true);
		expect(markdownTransformers).toHaveLength(1);
	});

	it("decorates only assistant Markdown after the session starts", async () => {
		const ctx = createContext();
		await emit("session_start", {}, ctx);
		const transform = markdownTransformers[0]!;
		const markdown = "```ts\nconst answer = 42;\n```";

		expect(transform(markdown, { messageType: "user", availableWidth: 40 })).toBe(markdown);
		expect(transform(markdown, { messageType: "assistant-thinking", availableWidth: 40 })).toBe(markdown);
		expect(transform(markdown, { messageType: "assistant", availableWidth: 40 })).not.toContain("```");
	});

	it("previews even the only snippet before copying", async () => {
		const ctx = createContext([entry(assistant("```ts\nconst x = 1;\n```"))]);
		await commands.get("copy-snippet")!.handler("", ctx);
		expect(ctx.ui.custom).toHaveBeenCalledWith(
			expect.any(Function),
			expect.objectContaining({ overlay: true }),
		);
		expect(copyToClipboard).toHaveBeenCalledWith("const x = 1;");
		expect(ctx.ui.notify).toHaveBeenCalledWith("Copied ts snippet to the clipboard", "info");
	});

	it("copies the pressed snippet number from the quick prompt", async () => {
		const ctx = createContext([entry(assistant("```ts\none\n```\n```json\ntwo\n```"))]);
		ctx.ui.custom.mockResolvedValueOnce(1);
		await shortcuts.get("ctrl+shift+c")!.handler(ctx);
		expect(copyToClipboard).toHaveBeenLastCalledWith("two");
		expect(ctx.ui.custom).toHaveBeenCalledWith(
			expect.any(Function),
			expect.objectContaining({
				overlay: true,
				overlayOptions: expect.objectContaining({ width: 48 }),
			}),
		);

		await commands.get("copy-snippet")!.handler("1", ctx);
		expect(copyToClipboard).toHaveBeenLastCalledWith("one");
	});

	it("copies a sole snippet immediately without opening the prompt", async () => {
		const ctx = createContext([entry(assistant("```ts\none\n```"))]);
		await shortcuts.get("ctrl+shift+c")!.handler(ctx);
		expect(copyToClipboard).toHaveBeenCalledWith("one");
		expect(ctx.ui.custom).not.toHaveBeenCalled();
	});

	it("preserves hostile snippet bodies exactly for clipboard copying while sanitizing notifications", async () => {
		const rawCode = "\u0000\x1b[2J\x1b]52;c;secret\x07\u202E\u200B👍🏽\r\n\tend";
		const rawLanguage = "ts\x1b[31m\u202E";
		const ctx = createContext([entry(assistant(`\`\`\`${rawLanguage}\n${rawCode}\n\`\`\``))]);
		await commands.get("copy-snippet")!.handler("1", ctx);
		expect(copyToClipboard).toHaveBeenLastCalledWith(rawCode);
		expect(ctx.ui.notify.mock.calls.at(-1)![0]).not.toContain("\x1b");
		expect(ctx.ui.notify.mock.calls.at(-1)![0]).not.toContain("\u202E");
	});

	it("copies from the picker snapshot if a newer assistant message arrives", async () => {
		let entries = [entry(assistant("```ts\none\n```\n```json\ntwo\n```"))];
		const ctx = createContext(entries);
		ctx.sessionManager.getBranch = () => entries;
		let resolveSelection!: (value: number) => void;
		ctx.ui.custom.mockImplementation(() => new Promise((resolve) => { resolveSelection = resolve; }));

		const pending = shortcuts.get("ctrl+shift+c")!.handler(ctx);
		await vi.waitFor(() => expect(ctx.ui.custom).toHaveBeenCalledOnce());
		entries = [entry(assistant("```bash\nreplacement\n```"))];
		await emit("message_end", { message: assistant("```bash\nreplacement\n```") }, ctx);
		resolveSelection(1);
		await pending;

		expect(copyToClipboard).toHaveBeenLastCalledWith("two");
	});

	it("cancels open picker dialogs on tree changes and every shutdown reason", async () => {
		const theme = { bold: (text: string) => text, fg: (_color: string, text: string) => text, bg: (_color: string, text: string) => text };
		const installDeferredDialog = (ctx: ReturnType<typeof createContext>) => {
			const handle = { hide: vi.fn() };
			let component: SnippetPicker | SnippetNumberPrompt | undefined;
			(ctx.ui.custom as any).mockImplementationOnce((factory: any, options: any) => new Promise((resolve) => {
				component = factory({ requestRender: vi.fn(), terminal: { rows: 30 } }, theme, createKeybindings(), resolve);
				options.onHandle(handle);
			}));
			return { handle, get component() { return component; } };
		};

		let entries: unknown[] = [entry(assistant("```ts\none\n```\n```json\ntwo\n```"))];
		const treeContext = createContext(entries);
		treeContext.sessionManager.getBranch = () => entries;
		const treeDialog = installDeferredDialog(treeContext);
		const copiesBeforeTree = copyToClipboard.mock.calls.length;
		const treePending = shortcuts.get("ctrl+shift+c")!.handler(treeContext);
		await vi.waitFor(() => expect(treeContext.ui.custom).toHaveBeenCalledOnce());
		entries = [entry(assistant("no snippets"))];
		await emit("session_before_tree", { signal: new AbortController().signal }, treeContext);
		await emit("session_tree", {}, treeContext);
		treeDialog.component?.handleInput("2");
		await treePending;
		expect(treeDialog.handle.hide).toHaveBeenCalledOnce();
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeTree);
		expect(treeContext.ui.setWidget).toHaveBeenLastCalledWith("better-snippets", undefined);
		entries = [entry(assistant("```ts\nfresh\n```"))];
		await commands.get("copy-snippet")!.handler("", treeContext);
		expect(copyToClipboard).toHaveBeenLastCalledWith("fresh");

		for (const reason of ["quit", "reload", "new", "resume", "fork"] as const) {
			const ctx = createContext([entry(assistant("```ts\none\n```"))]);
			const dialog = installDeferredDialog(ctx);
			const copiesBeforeShutdown = copyToClipboard.mock.calls.length;
			const pending = commands.get("copy-snippet")!.handler("", ctx);
			await vi.waitFor(() => expect(ctx.ui.custom).toHaveBeenCalledOnce());
			await emit("session_shutdown", { reason }, ctx);
			await pending;
			expect(dialog.handle.hide).toHaveBeenCalledOnce();
			expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeShutdown);
			expect(ctx.ui.setWidget).toHaveBeenLastCalledWith("better-snippets", undefined);
			await commands.get("copy-snippet")!.handler("1", ctx);
			expect(copyToClipboard).toHaveBeenLastCalledWith("one");
		}
	});

	it("contains request-render failures from an open picker and permits recovery", async () => {
		const ctx = createContext([entry(assistant("```ts\none\n```"))]);
		let installed!: SnippetPicker;
		(ctx.ui.custom as any).mockImplementationOnce((factory: any) => new Promise((resolve) => {
			installed = factory(
				{ requestRender: () => { throw new Error("render unavailable"); }, terminal: { rows: 30 } },
				{ bold: (text: string) => text, fg: (_color: string, text: string) => text, bg: (_color: string, text: string) => text },
				createKeybindings(),
				resolve,
			);
		}));
		const copiesBefore = copyToClipboard.mock.calls.length;
		const pending = commands.get("copy-snippet")!.handler("", ctx);
		await vi.waitFor(() => expect(ctx.ui.custom).toHaveBeenCalledOnce());
		expect(() => installed.handleInput("\t")).not.toThrow();
		installed.handleInput("\x1b");
		await pending;
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBefore);
		await commands.get("copy-snippet")!.handler("1", ctx);
		expect(copyToClipboard).toHaveBeenLastCalledWith("one");
	});

	it("registers the Pi shortcut without a collision query and keeps the command fallback usable", async () => {
		const registered: Array<{ key: string; description: string }> = [];
		let command!: Command;
		const localPi = {
			on: () => undefined,
			registerCommand: (_name: string, value: Command) => { command = value; },
			registerShortcut: (key: string, value: { description: string }) => { registered.push({ key, description: value.description }); },
			registerMarkdownTransformer: () => undefined,
		} as unknown as ExtensionAPI;
		extension(localPi, "en");
		expect(registered).toEqual([{ key: "ctrl+shift+c", description: "Copy a fenced snippet by pressing its number; /copy-snippet is always available" }]);
		const ctx = createContext([entry(assistant("```ts\nfallback\n```"))]);
		await command.handler("1", ctx);
		expect(copyToClipboard).toHaveBeenLastCalledWith("fallback");
	});

	it("reports missing snippets, invalid indices, and clipboard failures", async () => {
		const empty = createContext([entry(assistant("No code here"))]);
		await commands.get("copy-snippet")!.handler("", empty);
		expect(empty.ui.notify).toHaveBeenCalledWith(
			"The latest assistant response has no fenced snippets",
			"warning",
		);

		const ctx = createContext([entry(assistant("```ts\none\n```"))]);
		await commands.get("copy-snippet")!.handler("2", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith("Snippet 2 does not exist (available: 1-1)", "error");

		copyToClipboard.mockRejectedValueOnce(new Error("unavailable"));
		await commands.get("copy-snippet")!.handler("1", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith("Could not copy the snippet: unavailable", "error");
	});

	it("accepts only safe command indexes and bounds hostile index diagnostics", async () => {
		const ctx = createContext([entry(assistant("```ts\none\n```"))]);
		const command = commands.get("copy-snippet")!;

		await command.handler(String(Number.MAX_SAFE_INTEGER), ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith(
			"Snippet 9007199254740991 does not exist (available: 1-1)",
			"error",
		);

		await command.handler("9007199254740992", ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith(
			"Invalid snippet number: 9007199254740992. Usage: /copy-snippet [number]",
			"error",
		);

		await command.handler("01", ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith(
			"Invalid snippet number: 01. Usage: /copy-snippet [number]",
			"error",
		);

		const hundredsOfDigits = "9".repeat(500);
		await command.handler(hundredsOfDigits, ctx);
		const [diagnostic, level] = ctx.ui.notify.mock.calls.at(-1)!;
		expect(level).toBe("error");
		expect(diagnostic).toMatch(/^Invalid snippet number: 9{63}…\. Usage:/);
		expect(diagnostic).not.toContain("Infinity");
		expect(copyToClipboard).not.toHaveBeenCalled();
	});

	it("reports custom failures and contains deferred picker rendering failures", async () => {
		const ctx = createContext([entry(assistant("```ts\none\n```"))]);
		const command = commands.get("copy-snippet")!;
		const copiesBeforeCustomFailure = copyToClipboard.mock.calls.length;
		ctx.ui.custom.mockRejectedValueOnce(new Error("dialog unavailable"));

		await command.handler("", ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith("Could not open the snippet picker. Please try again", "error");
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeCustomFailure);
		await command.handler("", ctx);
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeCustomFailure + 1);
		expect(copyToClipboard).toHaveBeenLastCalledWith("one");

		const renderFailure = createContext([entry(assistant("```ts\none\n```"))]);
		const copiesBeforeRenderFailure = copyToClipboard.mock.calls.length;
		let installed!: SnippetPicker;
		renderFailure.ui.custom.mockImplementationOnce((factory: any) => new Promise((resolve) => {
			installed = factory(
				{ requestRender: vi.fn(), terminal: { rows: 30 } },
				{ bold: (text: string) => text, fg: (_color: string, text: string) => text, bg: (_color: string, text: string) => text },
				createKeybindings(),
				resolve,
			);
		}));
		const pending = command.handler("", renderFailure);
		await vi.waitFor(() => expect(renderFailure.ui.custom).toHaveBeenCalledOnce());
		highlightCode.mockImplementationOnce(() => { throw new Error("render failed"); });
		const fallback = installed.render(80);
		expect(fallback.join("\n")).toContain("Snippet preview unavailable. Press Esc to cancel");
		expect(fallback.every((row) => visibleWidth(row) <= 80 && !row.includes("\x1b"))).toBe(true);
		installed.handleInput("\x1b");
		await pending;
		expect(renderFailure.ui.notify).not.toHaveBeenCalled();
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeRenderFailure);
		await command.handler("", renderFailure);
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeRenderFailure + 1);
		expect(copyToClipboard).toHaveBeenLastCalledWith("one");
	});

	it.each([-1, Number.NaN, 0.5, 1, null])("rejects malformed picker selection %p and recovers", async (selection) => {
		const ctx = createContext([entry(assistant("```ts\none\n```"))]);
		const command = commands.get("copy-snippet")!;
		const copiesBeforeMalformedSelection = copyToClipboard.mock.calls.length;
		ctx.ui.custom.mockResolvedValueOnce(selection as number | undefined);

		await command.handler("", ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith("Could not select that snippet. Please try again", "error");
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeMalformedSelection);
		await command.handler("", ctx);
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeMalformedSelection + 1);
		expect(copyToClipboard).toHaveBeenLastCalledWith("one");
	});

	it("recovers the shortcut picker after custom and malformed-selection failures", async () => {
		const ctx = createContext([entry(assistant("```ts\none\n```\n```json\ntwo\n```"))]);
		const shortcut = shortcuts.get("ctrl+shift+c")!;
		const copiesBeforeCustomFailure = copyToClipboard.mock.calls.length;
		ctx.ui.custom.mockRejectedValueOnce(new Error("dialog unavailable"));

		await shortcut.handler(ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith("Could not open the snippet picker. Please try again", "error");
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeCustomFailure);
		ctx.ui.custom.mockResolvedValueOnce(1);
		await shortcut.handler(ctx);
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeCustomFailure + 1);
		expect(copyToClipboard).toHaveBeenLastCalledWith("two");

		const copiesBeforeMalformedSelection = copyToClipboard.mock.calls.length;
		ctx.ui.custom.mockResolvedValueOnce(Number.NaN);
		await shortcut.handler(ctx);
		expect(ctx.ui.notify).toHaveBeenLastCalledWith("Could not select that snippet. Please try again", "error");
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeMalformedSelection);
		ctx.ui.custom.mockResolvedValueOnce(0);
		await shortcut.handler(ctx);
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeMalformedSelection + 1);
		expect(copyToClipboard).toHaveBeenLastCalledWith("one");
	});

	it("contains deferred shortcut prompt rendering failures and recovers after cancellation", async () => {
		const ctx = createContext([entry(assistant("```ts\none\n```\n```json\ntwo\n```"))]);
		const shortcut = shortcuts.get("ctrl+shift+c")!;
		let installed!: SnippetNumberPrompt;
		ctx.ui.custom.mockImplementationOnce((factory: any) => new Promise((resolve) => {
			installed = factory(
				{ requestRender: vi.fn(), terminal: { rows: 30 } },
				{
					bold: (text: string) => text,
					fg: () => { throw new Error("render failed"); },
					bg: (_color: string, text: string) => text,
				},
				createKeybindings(),
				resolve,
			);
		}));

		const copiesBeforeRenderFailure = copyToClipboard.mock.calls.length;
		const pending = shortcut.handler(ctx);
		await vi.waitFor(() => expect(ctx.ui.custom).toHaveBeenCalledOnce());
		const fallback = installed.render(80);
		expect(fallback.join("\n")).toContain("Snippet number picker unavailable. Press Esc to cancel");
		expect(fallback.every((row) => visibleWidth(row) <= 80 && !row.includes("\x1b"))).toBe(true);
		installed.handleInput("\x1b");
		await pending;
		expect(ctx.ui.notify).not.toHaveBeenCalled();
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeRenderFailure);

		ctx.ui.custom.mockResolvedValueOnce(1);
		await shortcut.handler(ctx);
		expect(copyToClipboard.mock.calls).toHaveLength(copiesBeforeRenderFailure + 1);
		expect(copyToClipboard).toHaveBeenLastCalledWith("two");
	});

	it("reports every command argument and never accesses clipboard in RPC mode", async () => {
		const ctx = createContext([entry(assistant("```ts\none\n```"))], "rpc");
		const command = commands.get("copy-snippet")!;
		for (const args of ["1", "not-a-number", "9".repeat(500)]) await command.handler(args, ctx);
		expect(copyToClipboard).not.toHaveBeenCalled();
		expect(ctx.ui.notify).toHaveBeenCalledTimes(3);
		for (const call of ctx.ui.notify.mock.calls) {
			expect(call).toEqual(["Snippet copying is only available in the interactive TUI", "warning"]);
		}
	});

	it.each(["json", "print"])("rejects every command argument observably before parsing in %s mode", async (mode) => {
		const ctx = createContext([entry(assistant("```ts\none\n```"))], mode);
		const command = commands.get("copy-snippet")!;
		for (const args of ["1", "not-a-number", "9007199254740992", "9".repeat(500)]) {
			await expect(command.handler(args, ctx))
				.rejects.toThrow("Snippet copying is only available in the interactive TUI");
		}
		expect(copyToClipboard).not.toHaveBeenCalled();
		expect(ctx.ui.notify).not.toHaveBeenCalled();
	});

	it("shows a dim standalone footer line and hides it when empty", async () => {
		const ctx = createContext();
		await emit("message_end", { message: assistant("```bash\necho ok\n```\n```json\n{}\n```") }, ctx);
		expect(ctx.ui.setWidget).toHaveBeenCalledWith(
			"better-snippets",
			expect.any(Function),
			{ placement: "belowEditor" },
		);
		const factory = ctx.ui.setWidget.mock.calls.at(-1)![1];
		const dim = vi.fn((_color: string, text: string) => `<dim>${text}</dim>`);
		const component = factory({}, { fg: dim });
		expect(component.render(80)).toEqual(["<dim>2 snippets · ctrl+shift+c → number · /copy-snippet fallback</dim>"]);
		expect(dim).toHaveBeenCalledWith("dim", "2 snippets · ctrl+shift+c → number · /copy-snippet fallback");

		await emit("message_end", { message: assistant("```bash\necho ok\n```") }, ctx);
		const singularFactory = ctx.ui.setWidget.mock.calls.at(-1)![1];
		expect(singularFactory({}, { fg: dim }).render(80))
			.toEqual(["<dim>1 snippet · ctrl+shift+c copy · /copy-snippet fallback</dim>"]);

		await emit("message_end", { message: assistant("No snippets") }, ctx);
		expect(ctx.ui.setWidget).toHaveBeenLastCalledWith("better-snippets", undefined);
	});
});

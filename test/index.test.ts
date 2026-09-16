import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import extension, {
	decorateAssistantSnippets,
	extractFencedCodeBlocks,
	latestAssistantSnippets,
	SnippetNumberPrompt,
	SnippetPicker,
	snippetLabel,
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

extension(pi);

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

beforeEach(() => {
	vi.clearAllMocks();
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

	it("builds bounded, informative selector labels", () => {
		const label = snippetLabel({ code: "\nconst answer = 42;\n", info: "ts", language: "ts", startLine: 1, endLine: 4 }, 1);
		expect(label).toBe("2. ts · 3 lines — const answer = 42;");
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

	it("does not write clipboard escape sequences in RPC mode", async () => {
		const ctx = createContext([entry(assistant("```ts\none\n```"))], "rpc");
		await commands.get("copy-snippet")!.handler("1", ctx);
		expect(copyToClipboard).not.toHaveBeenCalled();
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			"Snippet copying is only available in the interactive TUI",
			"warning",
		);
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
		expect(component.render(80)).toEqual(["<dim>2 snippets · ctrl+shift+c → number</dim>"]);
		expect(dim).toHaveBeenCalledWith("dim", "2 snippets · ctrl+shift+c → number");

		await emit("message_end", { message: assistant("```bash\necho ok\n```") }, ctx);
		const singularFactory = ctx.ui.setWidget.mock.calls.at(-1)![1];
		expect(singularFactory({}, { fg: dim }).render(80))
			.toEqual(["<dim>1 snippet · ctrl+shift+c copy</dim>"]);

		await emit("message_end", { message: assistant("No snippets") }, ctx);
		expect(ctx.ui.setWidget).toHaveBeenLastCalledWith("better-snippets", undefined);
	});
});

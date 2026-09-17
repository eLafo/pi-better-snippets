import { describe, expect, it } from "vitest";
import { isValidSnippetSelection, parseSnippetIndex } from "../src/index-selection.js";

describe("parseSnippetIndex", () => {
	it("accepts canonical positive, exactly representable indexes", () => {
		expect(parseSnippetIndex("1")).toEqual({ value: 1, input: "1" });
		expect(parseSnippetIndex(String(Number.MAX_SAFE_INTEGER))).toEqual({
			value: Number.MAX_SAFE_INTEGER,
			input: String(Number.MAX_SAFE_INTEGER),
		});
	});

	it.each(["", "0", "01", "-1", "1.5", "one", "9007199254740992", "9".repeat(64)])
		("rejects non-canonical or unsafe input %j", (input) => {
			expect(parseSnippetIndex(input)).toBeUndefined();
		});
});

describe("isValidSnippetSelection", () => {
	it.each([0, 1])("accepts in-range zero-based indexes: %p", (selection) => {
		expect(isValidSnippetSelection(selection, 2)).toBe(true);
	});

	it.each([-1, 2, Number.NaN, Infinity, 0.5, "0", null, undefined])
		("rejects invalid picker result: %p", (selection) => {
			expect(isValidSnippetSelection(selection, 2)).toBe(false);
		});
});

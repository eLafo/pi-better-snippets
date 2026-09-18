/**
 * @packageDocumentation
 *
 * Typed English and Spanish UI catalogs with runtime interpolation validation.
 * The message-key type encodes each key's required placeholder names.
 */
type MessageArgs = {
	emptySnippet: never; emptyPreview: never; plainText: never;
	snippetUnavailable: { number: number }; copyByNumber: never; pressNumber: { range: string };
	cancel: never; preview: never; rows: never; focus: never; select: never; scroll: never; copy: never;
	copied: { language: string }; copyFailed: { detail: string }; tuiOnly: never; noSnippets: never;
	usage: never; invalidIndex: { value: string }; invalidSnippet: { value: string; available: string };
	pickerFailed: never; pickerRenderFailed: never; numberPromptRenderFailed: never; invalidSelection: never;
	lineCountOne: { count: number }; lineCountMany: { count: number };
	snippetLabel: { index: number; language: string; lines: string; preview: string };
	promptHint: { range: string; cancelKey: string }; promptHintMany: { range: string; command: string; cancelKey: string };
	keyPageUp: never; keyPageDown: never; keyEnter: never; keyEscape: never; keyUnbound: never;
	keyTab: never; keySpace: never; keyBackspace: never; keyDelete: never; keyInsert: never; keyClear: never; keyHome: never; keyEnd: never;
	keyUp: never; keyDown: never; keyLeft: never; keyRight: never;
	keyF1: never; keyF2: never; keyF3: never; keyF4: never; keyF5: never; keyF6: never; keyF7: never; keyF8: never; keyF9: never; keyF10: never; keyF11: never; keyF12: never;
	compactTitle: never; pickerTitle: { focus: string }; listFocus: never; previewFocus: never;
	search: never; searchHint: never; searchQuery: { query: string }; noMatches: never;
	rangeOf: { start: number; end: number; total: number }; previewLines: { start: number; end: number };
	compactFooter: { arrows: string; confirm: string; cancelKey: string };
	widgetOne: { count: number; shortcut: string }; widgetMany: { count: number; shortcut: string };
	commandDescription: never; shortcutDescription: never;
};
type MessageKey = keyof MessageArgs;
type MessageKeyWithArgs = { [K in MessageKey]: MessageArgs[K] extends never ? never : K }[MessageKey];
export type MessageKeyWithoutArgs = Exclude<MessageKey, MessageKeyWithArgs>;

type TranslationCatalog = { [K in MessageKey]: string };
/**
 * Complete source catalog for the supported locales.
 *
 * @remarks Use {@link validateTranslations} to check replacement catalogs.
 * @public
 */
export const TRANSLATIONS = {
	en: {
		emptySnippet: "(empty snippet)", emptyPreview: "(empty)", plainText: "text",
		snippetUnavailable: "Snippet {number} is not available", copyByNumber: "Copy snippet by number", pressNumber: "Press {range}", cancel: "cancel", preview: "Preview", rows: "Rows", focus: "focus", select: "select", scroll: "scroll", copy: "copy",
		copied: "Copied {language} snippet to the clipboard", copyFailed: "Could not copy the snippet{detail}", tuiOnly: "Snippet copying is only available in the interactive TUI", noSnippets: "The latest assistant response has no fenced snippets", usage: "Usage: /copy-snippet [number]", invalidIndex: "Invalid snippet number: {value}", invalidSnippet: "Snippet {value} does not exist (available: {available})", pickerFailed: "Could not open the snippet picker. Please try again", pickerRenderFailed: "Snippet preview unavailable. Press Esc to cancel", numberPromptRenderFailed: "Snippet number picker unavailable. Press Esc to cancel", invalidSelection: "Could not select that snippet. Please try again",
		lineCountOne: "{count} line", lineCountMany: "{count} lines", snippetLabel: "{index}. {language} · {lines} — {preview}", promptHint: "{range} · {cancelKey} cancel", promptHintMany: "{range} · {command} · {cancelKey} cancel", keyPageUp: "PgUp", keyPageDown: "PgDn", keyEnter: "Enter", keyEscape: "Esc", keyUnbound: "unbound", keyTab: "Tab", keySpace: "Space", keyBackspace: "Backspace", keyDelete: "Delete", keyInsert: "Insert", keyClear: "Clear", keyHome: "Home", keyEnd: "End", keyUp: "↑", keyDown: "↓", keyLeft: "←", keyRight: "→", keyF1: "F1", keyF2: "F2", keyF3: "F3", keyF4: "F4", keyF5: "F5", keyF6: "F6", keyF7: "F7", keyF8: "F8", keyF9: "F9", keyF10: "F10", keyF11: "F11", keyF12: "F12", compactTitle: "Copy snippet · Preview", pickerTitle: "Copy snippet · {focus}", listFocus: "list", previewFocus: "preview", search: "search", searchHint: "/ search · Esc clear", searchQuery: "Search: {query}", noMatches: "No matching snippets", rangeOf: "{start}-{end} of {total}", previewLines: "lines {start}-{end}", compactFooter: "{arrows} scroll · {confirm} copy · {cancelKey} cancel", widgetOne: "{count} snippet · {shortcut} picker · /copy-snippet fallback", widgetMany: "{count} snippets · {shortcut} picker · /copy-snippet fallback", commandDescription: "Select and copy a fenced snippet from the latest assistant response", shortcutDescription: "Open the fenced snippet picker; /copy-snippet is always available",
	},
	es: {
		emptySnippet: "(fragmento vacío)", emptyPreview: "(vacío)", plainText: "texto",
		snippetUnavailable: "El fragmento {number} no está disponible", copyByNumber: "Copiar fragmento por número", pressNumber: "Pulsa {range}", cancel: "cancelar", preview: "Vista previa", rows: "Filas", focus: "foco", select: "seleccionar", scroll: "desplazar", copy: "copiar",
		copied: "Fragmento {language} copiado al portapapeles", copyFailed: "No se pudo copiar el fragmento{detail}", tuiOnly: "La copia de fragmentos solo está disponible en la TUI interactiva", noSnippets: "La última respuesta del asistente no contiene fragmentos delimitados", usage: "Uso: /copy-snippet [número]", invalidIndex: "Número de fragmento no válido: {value}", invalidSnippet: "El fragmento {value} no existe (disponibles: {available})", pickerFailed: "No se pudo abrir el selector de fragmentos. Inténtalo de nuevo", pickerRenderFailed: "Vista previa no disponible. Pulsa Esc para cancelar", numberPromptRenderFailed: "Selector numérico no disponible. Pulsa Esc para cancelar", invalidSelection: "No se pudo seleccionar ese fragmento. Inténtalo de nuevo",
		lineCountOne: "{count} línea", lineCountMany: "{count} líneas", snippetLabel: "{index}. {language} · {lines} — {preview}", promptHint: "{range} · {cancelKey} cancelar", promptHintMany: "{range} · {command} · {cancelKey} cancelar", keyPageUp: "RePág", keyPageDown: "AvPág", keyEnter: "Intro", keyEscape: "Esc", keyUnbound: "sin asignar", keyTab: "Tab", keySpace: "Espacio", keyBackspace: "Retroceso", keyDelete: "Supr", keyInsert: "Insert", keyClear: "Borrar", keyHome: "Inicio", keyEnd: "Fin", keyUp: "↑", keyDown: "↓", keyLeft: "←", keyRight: "→", keyF1: "F1", keyF2: "F2", keyF3: "F3", keyF4: "F4", keyF5: "F5", keyF6: "F6", keyF7: "F7", keyF8: "F8", keyF9: "F9", keyF10: "F10", keyF11: "F11", keyF12: "F12", compactTitle: "Copiar fragmento · Vista previa", pickerTitle: "Copiar fragmento · {focus}", listFocus: "lista", previewFocus: "vista previa", search: "buscar", searchHint: "/ buscar · Esc limpiar", searchQuery: "Buscar: {query}", noMatches: "No hay fragmentos coincidentes", rangeOf: "{start}-{end} de {total}", previewLines: "líneas {start}-{end}", compactFooter: "{arrows} desplazar · {confirm} copiar · {cancelKey} cancelar", widgetOne: "{count} fragmento · selector {shortcut} · alternativa /copy-snippet", widgetMany: "{count} fragmentos · selector {shortcut} · alternativa /copy-snippet", commandDescription: "Selecciona y copia un fragmento delimitado de la última respuesta del asistente", shortcutDescription: "Abre el selector de fragmentos delimitados; /copy-snippet siempre está disponible",
	},
} satisfies Record<"en" | "es", TranslationCatalog>;

const MESSAGE_PLACEHOLDERS: { [K in MessageKey]: readonly (keyof MessageArgs[K])[] } = {
	emptySnippet: [], emptyPreview: [], plainText: [], snippetUnavailable: ["number"], copyByNumber: [], pressNumber: ["range"], cancel: [], preview: [], rows: [], focus: [], select: [], scroll: [], copy: [], copied: ["language"], copyFailed: ["detail"], tuiOnly: [], noSnippets: [], usage: [], invalidIndex: ["value"], invalidSnippet: ["value", "available"], pickerFailed: [], pickerRenderFailed: [], numberPromptRenderFailed: [], invalidSelection: [], lineCountOne: ["count"], lineCountMany: ["count"], snippetLabel: ["index", "language", "lines", "preview"], promptHint: ["range", "cancelKey"], promptHintMany: ["range", "command", "cancelKey"], keyPageUp: [], keyPageDown: [], keyEnter: [], keyEscape: [], keyUnbound: [], keyTab: [], keySpace: [], keyBackspace: [], keyDelete: [], keyInsert: [], keyClear: [], keyHome: [], keyEnd: [], keyUp: [], keyDown: [], keyLeft: [], keyRight: [], keyF1: [], keyF2: [], keyF3: [], keyF4: [], keyF5: [], keyF6: [], keyF7: [], keyF8: [], keyF9: [], keyF10: [], keyF11: [], keyF12: [], compactTitle: [], pickerTitle: ["focus"], listFocus: [], previewFocus: [], search: [], searchHint: [], searchQuery: ["query"], noMatches: [], rangeOf: ["start", "end", "total"], previewLines: ["start", "end"], compactFooter: ["arrows", "confirm", "cancelKey"], widgetOne: ["count", "shortcut"], widgetMany: ["count", "shortcut"], commandDescription: [], shortcutDescription: [],
};

/**
 * Resolves a requested or host locale to a supported base language.
 *
 * @param locale - Optional BCP 47 locale supplied by Pi or the caller.
 * @returns `es` for Spanish variants; `en` for all other or malformed values.
 */
function resolveLanguage(locale?: string): "en" | "es" {
	const candidate = locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
	try {
		const language = Intl.getCanonicalLocales(candidate)[0]?.split("-", 1)[0]?.toLowerCase();
		return language === "es" ? "es" : "en";
	} catch {
		return "en";
	}
}

/**
 * Validates catalog completeness and interpolation-placeholder contracts.
 *
 * @param catalog - Catalog to validate; defaults to {@link TRANSLATIONS}.
 * @throws {@link Error} When a translation is absent or its placeholders differ.
 * @public
 */
export function validateTranslations(catalog: Record<"en" | "es", TranslationCatalog> = TRANSLATIONS): void {
	for (const language of ["en", "es"] as const) for (const key of Object.keys(MESSAGE_PLACEHOLDERS) as MessageKey[]) {
		const template = catalog[language][key];
		if (typeof template !== "string") throw new Error(`Missing ${language} translation for ${key}`);
		const placeholders = template.match(/\{(\w+)\}/g)?.map((value) => value.slice(1, -1)) ?? [];
		const expected = MESSAGE_PLACEHOLDERS[key] as readonly string[];
		if (placeholders.length !== expected.length || expected.some((name) => placeholders.filter((value) => value === name).length !== 1)) {
			throw new Error(`Invalid ${language} translation placeholders for ${key}`);
		}
	}
}

/**
 * Interpolates exactly the placeholders declared for a localized message.
 *
 * @param key - Typed catalog key.
 * @param values - Interpolation values supplied by the public overloads.
 * @param locale - Requested UI locale.
 * @returns Resolved localized UI text.
 * @throws {@link Error} When supplied values do not match the template.
 */
function translateImplementation(key: MessageKey, values: Record<string, string | number>, locale?: string): string {
	const template = TRANSLATIONS[resolveLanguage(locale)][key];
	const expected = new Set(template.match(/\{(\w+)\}/g)?.map((value) => value.slice(1, -1)));
	if (Object.keys(values).some((name) => !expected.has(name)) || [...expected].some((name) => !Object.hasOwn(values, name))) {
		throw new Error(`Invalid interpolation values for ${key}`);
	}
	return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name]));
}

/**
 * Resolves UI text with canonical locale selection and checked interpolation values.
 *
 * @typeParam K - Catalog key, which determines whether values are required.
 * @param key - Message key to resolve.
 * @param valuesOrLocale - Interpolation values, or a locale for keys without values.
 * @param locale - Requested UI locale when interpolation values are provided.
 * @returns Localized text with all placeholders replaced.
 * @throws {@link Error} When runtime interpolation values are invalid.
 * @public
 */
export function translate<K extends MessageKeyWithoutArgs>(key: K, locale?: string): string;
export function translate<K extends MessageKeyWithArgs>(key: K, values: MessageArgs[K], locale?: string): string;
export function translate(key: MessageKey, valuesOrLocale?: Record<string, string | number> | string, locale?: string): string {
	return translateImplementation(key, typeof valuesOrLocale === "string" ? {} : valuesOrLocale ?? {}, typeof valuesOrLocale === "string" ? valuesOrLocale : locale);
}

validateTranslations();

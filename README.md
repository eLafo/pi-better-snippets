# pi-better-snippets

[![Pi package](https://img.shields.io/badge/pi-package-6b5cff)](https://pi.dev/packages)

Pi extension that renders fenced code blocks in assistant responses as syntax-highlighted panels and lets you copy each snippet independently.

## Requirements

- Node.js `>=22.19.0`.
- Pi coding agent and Pi TUI host peers. The distributed package accepts the host peer contract (`*`); Pi coding agent/TUI `0.85.1` is the currently tested baseline. Later host versions require CI evidence and are not guaranteed by this README.
- An interactive Pi TUI session for the picker and clipboard actions. Copying is not available in print, JSON, or RPC-only use.

The public Git repository and npm publication are external release gates. This repository does not claim that the public Git URL or npm package is currently available; verify availability before relying on either installation source.

## Install

Review the source before installing. Pi packages execute with the permissions of the Pi process, and assistant responses can contain untrusted content.

Install the npm package globally:

```sh
pi install npm:@elafo/pi-better-snippets
```

Install the npm package for the current project only:

```sh
pi install -l npm:@elafo/pi-better-snippets
```

Install from the public Git source globally:

```sh
pi install git:github.com/eLafo/pi-better-snippets
```

Install the Git source for the current project only:

```sh
pi install -l git:github.com/eLafo/pi-better-snippets
```

Use one source, rather than installing both copies. Public Git and npm availability must be verified as part of a release; a local checkout or package archive is not evidence that either public source is published.

## Update

Update one installed package, preserving its global or project scope:

```sh
pi update npm:@elafo/pi-better-snippets
# or
pi update git:github.com/eLafo/pi-better-snippets
```

To update all installed packages, use `pi update --extensions`. A Git installation pinned to a tag or commit does not move to a newer ref automatically; install the new ref explicitly, for example `pi install git:github.com/eLafo/pi-better-snippets@<tag>`.

## Use

- `Ctrl+Shift+C`, then `1`–`9`: copies the corresponding snippet from the latest assistant response.
- With one snippet, `Ctrl+Shift+C` copies it immediately.
- `/copy-snippet`: opens a picker showing the snippets and a preview. The picker supports navigation, paging, selection, and cancellation; it is **not searchable**.
- `/copy-snippet <n>`: copies snippet *n*, including snippets after the ninth.

`/copy-snippet` is the shortcut fallback when the key binding is unavailable or conflicts with another Pi binding.

The extension preserves the original Markdown in the session. It only changes its terminal rendering and copies the content inside complete backtick or tilde fences.

The picker labels, one-line previews, and rendered panels are sanitized and bounded display text. They can omit or truncate content, including a suffix that is not visible in the preview. An explicit copy action instead sends the complete raw body of the selected fence to the OS clipboard, including any control characters or other unseen content in that body. Never treat the preview as a complete safety review: paste into a safe text editor and inspect the full content before execution or sharing.

### Safety and clipboard privacy

Snippets originate in potentially untrusted assistant responses. Review the selected code and its language metadata before executing, sharing, or storing it. The extension does not vouch for the safety of assistant-generated content.

Copying happens only after an explicit user action through the shortcut or `/copy-snippet`. Only the selected fence body is sent to the clipboard: fence markers, language labels, picker text, and explanations are excluded. The selected body may contain anything present in the assistant response, including secrets or terminal-control text, so review it before copying.

The operating system clipboard and clipboard managers may expose, retain, synchronize, or store copied text in clipboard history. The extension does not control that persistence or clear history; use the privacy controls provided by your OS or clipboard manager.

## Localization

Interface text selects Spanish when the system locale language is `es` (including variants such as `es-MX`) and English for other locales or invalid locale values. The current bundled catalog supports only English and Spanish; it does not automatically add arbitrary new locales. Some technical key labels remain as provided by the current UI catalog.

The bundled [`copyable-snippets`](./skills/copyable-snippets/SKILL.md) skill helps Pi format user-requested content as separate, clean fenced blocks. It activates for explicit copyable/clipboard-ready requests, not merely because an ordinary answer contains code.

## Uninstall

Remove a global installation:

```sh
pi remove npm:@elafo/pi-better-snippets
# or, for a Git installation:
pi remove git:github.com/eLafo/pi-better-snippets
```

Remove a project-local installation with `-l`:

```sh
pi remove -l npm:@elafo/pi-better-snippets
# or
pi remove -l git:github.com/eLafo/pi-better-snippets
```

Restart Pi after changing package settings. If both sources were installed, remove each source separately.

## Troubleshooting

- **Wrong runtime or tested host baseline:** run `node --version` and `pi --version`. Upgrade Node to `22.19.0` or newer; Pi coding agent/TUI `0.85.1` is the currently tested baseline. Later host versions need CI evidence and are not guaranteed.
- **The extension is not loaded:** run `pi list`, confirm the package is installed in the intended global or project scope, then run `pi update <source>` and restart an interactive `pi` session. Project-local installs may require `--approve` when Pi asks for trust.
- **The picker does not appear:** use an interactive `pi` TUI, not `pi -p`, JSON, or RPC-only mode. Try `/copy-snippet`, which is the documented shortcut fallback, and confirm that the latest assistant response contains complete fenced blocks.
- **Copying fails:** check that the OS clipboard provider is available and that Pi can access it. Retry the explicit copy action and inspect the reported error; the extension does not silently retry or clear clipboard history.
- **Unexpected language:** set the desired locale before starting Pi (for example, `LANG=es_MX.UTF-8 pi`) and restart Pi. Only `es*` locales select Spanish; all other locales select English.
- **Install or update errors:** verify the requested npm/Git source is publicly available and that the network can reach it. Public availability is a release gate and is not implied by this checkout.

## Develop

```sh
npm install
npm run typecheck
npm test
npm run check
pi -e .
```

`npm run check` runs the typecheck and test suite. To inspect the distribution archive without creating it, run `npm pack --dry-run`. The expected npm archive is intentionally limited to the five-file distribution allowlist: `package.json`, `index.ts`, `README.md`, `LICENSE`, and `skills/copyable-snippets/SKILL.md`.

## License

[MIT](./LICENSE)

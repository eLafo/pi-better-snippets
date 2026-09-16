# pi-better-snippets

[![Pi package](https://img.shields.io/badge/pi-package-6b5cff)](https://pi.dev/packages)

Pi extension that renders fenced code blocks in assistant responses as syntax-highlighted panels and lets you copy each snippet independently.

## Install

Install the public Git package globally:

```sh
pi install git:github.com/eLafo/pi-better-snippets
```

For a project-only installation, use `pi install -l git:github.com/eLafo/pi-better-snippets`. Pi packages execute with the permissions of your Pi process; review the source before installing.

## Use

- `Ctrl+Shift+C`, then `1`–`9`: copies the corresponding snippet from the latest assistant response.
- With one snippet, `Ctrl+Shift+C` copies it immediately.
- `/copy-snippet`: opens a searchable preview picker.
- `/copy-snippet <n>`: copies snippet *n*, including snippets after the ninth.

The extension preserves the original Markdown in the session. It only changes its terminal rendering and copies the content inside complete backtick or tilde fences.

## Localization

Interface text automatically uses Spanish on `es*` system locales and English otherwise. Translations are centralized in `TRANSLATIONS` in [`index.ts`](./index.ts), so new locales can be added without changing the UI logic.

The bundled [`copyable-snippets`](./skills/copyable-snippets/SKILL.md) skill helps Pi format user-requested content as separate, clean fenced blocks.

## Develop

```sh
npm install
npm run check
pi -e .
```

## License

[MIT](./LICENSE)

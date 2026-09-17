# AGENTS.md

## Project

Pi extension that renders fenced code blocks in assistant responses as syntax-highlighted panels and lets users explicitly copy each snippet.

## Key paths

- `index.ts`: extension implementation.
- `test/`: automated tests.
- `skills/copyable-snippets/`: distributed Pi skill.
- `scripts/`: CI, package, and dependency-security verification.
- `DEVELOPMENT.md`: setup, detailed quality checklist, dependency review, and release process.

## Commands

- `npm run check`: required validation for normal changes.
- `npm test`: test suite.
- `npm pack --dry-run`: inspect package contents when packaging changes.

## Change rules

- Keep the extension small and dependency-free unless a dependency is justified.
- Treat assistant text, language labels, and rendered snippet content as untrusted.
- Clipboard writes must be explicit, user initiated, and contain only the snippet body.
- Preserve safe behavior outside Pi TUI/RPC.
- Keep distributed skill output compatible with the fence parser.
- Use English in maintained source, documentation, and messages, except localization resources.

## Testing and scope

- Add or update focused tests for changed parsing, UI, lifecycle, or error behavior.
- Run `npm run check` before finishing.
- Follow `DEVELOPMENT.md` for package, dependency, CI, or release changes.
- Avoid speculative features and broad refactors; prefer the smallest change that solves the stated problem.

# Development

This document is for maintaining the source repository. It is not part of the npm package.

## Setup and validation

Use Node.js `>=22.19.0` and npm `11.19.0`.

```sh
npm install
npm run check
pi -e .
```

Useful focused commands:

- `npm test`: run tests.
- `npm run typecheck`: typecheck without emitting files.
- `npm run test:coverage`: run tests with coverage thresholds.
- `npm run verify:package`: inspect the package allowlist.
- `npm run verify:lifecycle`: verify the reviewed dependency lifecycle inventory.
- `npm run smoke:no-dev`: install the packed extension without development dependencies and load it with Pi.
- `npm run host:load`: test host-mode loading.

`npm run check` runs verifier fixtures, typechecking, coverage, package allowlist verification, lifecycle review, action pin verification, and production and full dependency audits. Coverage thresholds are 95% lines, 90% functions, 80% branches, and 90% statements.

The npm archive intentionally contains only `package.json`, `index.ts`, `README.md`, `LICENSE`, and `skills/copyable-snippets/SKILL.md`.

## Dependency lifecycle review

`npm run verify:lifecycle` is a fail-closed supply-chain check. It compares the root manifest, installed resolved manifests, and `package-lock.json` against `scripts/lifecycle-review.json`.

When changing dependencies or the lockfile:

1. Run `npm ci --ignore-scripts`.
2. Review every lifecycle command and implicit `hasInstallScript` case introduced, removed, or changed.
3. Update `scripts/lifecycle-review.json` only after that review.
4. Run `npm run verify:lifecycle` before and after normal `npm ci`.

`--ignore-scripts` alone is not lifecycle-safety evidence. The inventory also covers platform-specific and lock-only packages.

## Release

Release Please derives versions, changelog entries, release pull requests, tags, and GitHub Releases from Conventional Commits. npm publication is a separate, explicitly authorized action.

Before enabling Release Please, configure a repository-scoped `RELEASE_PLEASE_TOKEN` with only the permissions needed to write contents, pull requests, issues, and labels. Protect `main` with review and the CI workflow checks.

For a release:

1. Merge Conventional Commits into `main`; Release Please opens or updates the release pull request.
2. Review the proposed version, `CHANGELOG.md`, `package.json`, and `package-lock.json`.
3. Require the complete CI suite.
4. Verify that GitHub private vulnerability reporting is enabled and the reporting URL in `SECURITY.md` accepts a private report. Record the date, verifier, and a link or identifier for the check in the release pull request description or comments.
5. Merge only when checks, review, and the security-reporting check pass.
6. Verify the generated `vX.Y.Z` tag targets the merged release commit and its GitHub Release notes match the committed changelog.

Do not manually create competing tags, move a published tag, or replace a published artifact. Correct a defective release with a new SemVer version.

This repository does not publish to npm automatically and stores no npm publication token. After explicit owner authorization, check out the exact release tag in a clean environment; run `npm ci --ignore-scripts` and `node scripts/verify-lifecycle.mjs`, then normal `npm ci`, `npm run verify:lifecycle`, and `npm run check`. Run `npm pack` once, inspect and hash that tarball, publish that exact tarball, and verify the npm and Git installation paths from clean Pi homes. Prefer npm Trusted Publishing over a long-lived token for any future automation.

## Quality checklist

Use the relevant sections for the change at hand. Apply the complete checklist before a public release.

### Release and distribution

- [ ] `npm run check` passes in a clean environment.
- [ ] `npm pack --dry-run` contains only the intended files.
- [ ] Installation is tested from npm and Git, following the README.
- [ ] The extension is tested with the minimum declared Node and Pi versions and the latest compatible version.
- [ ] `package.json` correctly declares name, version, license, engines, peer dependencies, extensions, and skills.
- [ ] The package contains no secrets, logs, coverage data, `node_modules`, or local files.
- [ ] There are no unexpected installation or publishing scripts.
- [ ] Production and development dependency audits have no unaccepted critical or high vulnerabilities.
- [ ] The license is included in the tarball and is compatible with distributed dependencies and assets.
- [ ] Publishing occurs from an attributable, tagged, reproducible commit, not untracked files.
- [ ] Published extension and skill paths exist within the tarball.
- [ ] Used ESM, TypeScript, and Pi APIs are compatible with the declared version range.
- [ ] The extension is tested without development dependencies installed.
- [ ] The README documents requirements, installation, updates, uninstallation, and basic troubleshooting.
- [ ] Repository, bugs, homepage, and author or maintainer metadata are present where applicable.
- [ ] Versioning, changelog, and release/tag processes are defined.

### Functionality, UI, and safety

- [ ] Clipboard copying is explicit, user-initiated, and copies only the snippet body.
- [ ] Behavior outside TUI/RPC is safe and reports errors appropriately.
- [ ] Hostile code and language input is tested: control characters, ANSI/CSI/OSC, bidi, invisible Unicode, extreme line lengths, and invalid language names.
- [ ] Untrusted assistant content cannot inject terminal controls or corrupt visual layout.
- [ ] Tests cover backtick and tilde fences, varying fence lengths, CRLF, indentation, and incomplete fences.
- [ ] Snippets are extracted only from the correct assistant message and valid text blocks.
- [ ] Multiple snippets, empty content, large snippets, and many snippets are tested.
- [ ] Narrow terminals, resizing, long lines, tabs, and wrapping are tested.
- [ ] Invalid and large numeric indexes and selection limits are tested.
- [ ] Keyboard navigation, mouse interaction, double-click, confirmation, cancellation, and `Ctrl+C` are tested.
- [ ] Configurable shortcuts and collisions with Pi shortcuts are tested.
- [ ] Lifecycle hooks leave no residual state, widgets, or listeners.
- [ ] Clipboard, rendering, and selection errors are understandable and do not block Pi.
- [ ] Imports receive no unnecessary access to network, filesystem, shell, processes, credentials, or telemetry.

### Documentation and localization

- [ ] Maintained documentation, code, comments, public names, and messages are English, except UI translations and localization resources.
- [ ] Documented commands, shortcuts, text, and behavior exist.
- [ ] Unimplemented claims are corrected.
- [ ] Documentation explains that copied content comes from potentially untrusted responses and documents clipboard privacy.
- [ ] The distributed skill produces parser-compatible fences and does not activate for ordinary answers containing code.
- [ ] Labels, explanations, and metadata stay outside copied content.
- [ ] All UI surfaces are translated.
- [ ] Spanish has no unintended hardcoded English; `en`, `es`, variants such as `es-MX`, and fallback locales are tested.
- [ ] Translation keys are complete and typed; placeholders work.
- [ ] Unicode, accented, RTL/bidi, and long text are tested, including Spanish in narrow layouts.

### Maintainability and governance

- [ ] Code has strict types, separated responsibilities, and no significant duplication.
- [ ] Tests cover parser, UI, lifecycle, and error paths sufficiently.
- [ ] CI performs clean installation, typecheck, tests, packaging, and audit.
- [ ] Dependencies and CI tooling are reviewed and reasonably pinned.
- [ ] Vulnerability reporting and response processes exist.
- [ ] Permission changes, clipboard behavior, and attack surface are reviewed for every release.

# AGENTS.md

## Quality Checklist for Third-Party Distribution

### Release Blockers

- [ ] `npm run check` passes in a clean environment.
- [ ] `npm pack --dry-run` contains only the intended files.
- [ ] Installation is tested from npm and Git, following the README.
- [ ] The extension is tested with the minimum declared Node and Pi versions, as well as the latest compatible version.
- [ ] `package.json` correctly declares the name, version, license, `engines`, `peerDependencies`, extensions, and skills.
- [ ] The package contains no secrets, logs, coverage data, `node_modules`, or local files.
- [ ] All imports are reviewed: no unnecessary access to the network, filesystem, shell, processes, credentials, or telemetry.
- [ ] There are no unexpected installation or publishing scripts.
- [ ] Production and development dependency audits have no unaccepted critical or high vulnerabilities.
- [ ] Clipboard copying is always explicit, user-initiated, and copies only the snippet body.
- [ ] Behavior outside TUI/RPC is safe and reports errors appropriately.
- [ ] Hostile code and language input is tested: control characters, ANSI/CSI/OSC, bidi, invisible Unicode, extreme line lengths, and invalid language names.
- [ ] Untrusted assistant content cannot inject terminal controls or corrupt the visual layout.
- [ ] The license is included in the tarball and is compatible with all distributed dependencies and assets.
- [ ] Publishing occurs from an attributable, tagged, reproducible commit—not from untracked files.

### Functionality and Regression

- [ ] Tests cover backtick and tilde fences, varying fence lengths, CRLF, indentation, and incomplete fences.
- [ ] Snippets are extracted only from the correct assistant message and valid text blocks.
- [ ] Multiple snippets, empty content, large snippets, and many snippets are tested.
- [ ] Narrow terminals, resizing, long lines, tabs, and wrapping are tested.
- [ ] Invalid and large numeric indexes, along with selection limits, are tested.
- [ ] Keyboard navigation, mouse interaction, double-click, confirmation, cancellation, and `Ctrl+C` are tested.
- [ ] Configurable shortcuts and potential collisions with Pi shortcuts are tested.
- [ ] Lifecycle hooks do not leave residual state, widgets, or listeners.
- [ ] Clipboard, rendering, and selection errors are understandable and do not block Pi.

### Compatibility and Packaging

- [ ] Published extension and skill paths exist within the tarball.
- [ ] The ESM, TypeScript, and Pi APIs used are compatible with the declared version range.
- [ ] The extension is tested without development dependencies installed.
- [ ] The README specifies requirements, installation, updates, uninstallation, and basic troubleshooting.
- [ ] The package includes `repository`, `bugs`, `homepage`, and author/maintainer metadata where applicable.
- [ ] A semantic versioning policy, changelog, and release/tag publishing process exist.

### Documentation and User Experience

- [ ] Documentation, code (including comments, public names, and messages), and maintained repository files are in English, except UI translations and their localization resources.
- [ ] Every documented command, shortcut, text, and behavior actually exists.
- [ ] Unimplemented functional claims are corrected—for example, describe the picker as searchable only if it is searchable.
- [ ] Documentation explains that copied content originates from potentially untrusted responses.
- [ ] Clipboard privacy behavior is documented.
- [ ] The distributed skill produces fences compatible with the parser.
- [ ] Labels, explanations, and metadata remain outside copied content.
- [ ] The skill does not activate inappropriately for ordinary answers containing code.

### Translations and Internationalization

- [ ] All UI surfaces are translated: compact picker, standard picker, footer, errors, help, and actions.
- [ ] No English text remains hardcoded when the locale is Spanish.
- [ ] `en`, `es`, variants such as `es-MX`, and a fallback locale are tested.
- [ ] Translation keys are complete, typed, and contain no broken placeholders.
- [ ] Translations use consistent terminology, clear wording, and inclusive language.
- [ ] Spanish text is validated in narrow layouts.
- [ ] Unicode, accented characters, RTL/bidi text, and long text are tested.

### Maintainability and Governance

- [ ] Code uses strict types, separated responsibilities, and has no significant duplication.
- [ ] Test coverage sufficiently covers the parser, UI, lifecycle, and error paths.
- [ ] CI runs a clean installation, typecheck, tests, packaging, and audit.
- [ ] Dependencies and CI tooling are reviewed and reasonably pinned.
- [ ] A process exists for reporting vulnerabilities and responding to issues.
- [ ] Permission changes, clipboard behavior, and attack surface are reviewed for every release.

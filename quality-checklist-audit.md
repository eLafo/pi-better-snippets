# Definitive Quality Audit — Third-Party Distribution

**Repository:** `/Users/elafo/workspace/elafo/pi-better-snippets`  
**Audited HEAD:** `266702a63491f746d054d19bd6bef43bce46e644`  
**Primary contract:** `AGENTS.md:3-72`  
**Audit mode:** The delegated audit was read-only and observed a clean tree before this report was copied into the repository. The present working tree contains the untracked `quality-checklist-audit.md`; no Git metadata, package, credential, or remote state was modified.

## 1. Executive summary and release verdict

# Release verdict: **BLOCK**

| Status | Count |
|---|---:|
| PASS | 14 |
| FAIL | 20 |
| PARTIAL | 17 |
| NOT TESTED | 0 |
| NOT APPLICABLE | 0 |
| **Total** | **51** |

The package passes an isolated clean install/check, produces a five-file tarball, has no high or critical audit findings, and correctly limits clipboard writes to explicit user actions and the raw fence body. Fence parsing and core synthetic picker interactions also have meaningful test coverage.

Release is blocked because:

1. Untrusted assistant fence metadata can preserve terminal CSI controls during automatic transcript rendering (`index.ts:99-170,535-537,665-668`).
2. The required hostile-input security matrix is absent (`test/index.test.ts:135-217,260-378`).
3. The public npm package returns E404, and the documented Git repository returns “Repository not found.”
4. JSON/print mode rejects copying silently because the host notifier is a no-op (`index.ts:575-579`; `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js:88-117`).
5. The exact minimum Node version has not been tested.
6. Transitive lifecycle scripts exist but were not fully reviewed (`package-lock.json:1045-1051,1646-1652,2179-2185,2967-2974`).
7. No release tag, public remote, CI gate, vulnerability-reporting process, changelog, or operational evidence/enforcement for the existing per-release attack-surface checklist exists.
8. Spanish localization is incomplete and locale, Unicode, RTL/bidi, and narrow-layout tests are absent.
9. Installation without development dependencies was demonstrated, but the extension was not loaded or exercised in that no-dev environment.
10. Required safety/privacy documentation and public maintainer/support metadata are absent.

### Challenge disposition

All three independent challenges were valid and incorporated:

- **Row 8 downgraded from PASS to PARTIAL.** The checklist does not limit lifecycle-script review to the root manifest. The lockfile marks four resolved transitive packages with `hasInstallScript` (`package-lock.json:1045-1051,1646-1652,2179-2185,2967-2974`). Installed manifests confirm install-time hooks for `@google/genai`, `esbuild`, and `protobufjs`; optional `fsevents` has the publishing lifecycle hook `prepublishOnly`, not a confirmed `preinstall`, `install`, or `postinstall` hook.
- **Row 17 downgraded from PASS to PARTIAL.** `isAssistantMessage` validates only that `content` is an array, then extraction dereferences arbitrary elements (`index.ts:190-202`); `content: [null]` is a concrete counterexample.
- **Row 27 downgraded from PASS to PARTIAL.** `npm install --omit=dev` proves installation, not extension discovery, initialization, or behavior without development dependencies.

No challenge item was rejected.

---

## 2. Complete ordered checklist matrix

### Release Blockers

| # | Checklist item | Status | Evidence and conclusion | Required remediation / verification |
|---:|---|---|---|---|
| 1 | `npm run check` passes in a clean environment. | **PASS** | An isolated tree was created from `git archive HEAD`; `npm ci` exited 0 and `npm run check` exited 0, with TypeScript passing and Vitest reporting 1 file/29 tests passed. Scripts are defined at `package.json:29-32`. | Preserve this check and automate it in CI. |
| 2 | `npm pack --dry-run` contains only the intended files. | **PASS** | `npm pack --dry-run` exited 0 and listed exactly `LICENSE`, `README.md`, `index.ts`, `package.json`, and `skills/copyable-snippets/SKILL.md`. This agrees with the allowlist and Pi paths at `package.json:15-28`. | Enforce the five-file allowlist in release CI. |
| 3 | Installation is tested from npm and Git, following the README. | **FAIL** | README documents `pi install git:github.com/eLafo/pi-better-snippets` (`README.md:7-15`). `git ls-remote https://github.com/eLafo/pi-better-snippets.git HEAD refs/tags/*` exited 128 with “Repository not found.” `npm view @elafo/pi-better-snippets@0.1.0 version dist.tarball time --json` exited 1/E404. Local checkout/tarball installs succeeded but do not satisfy public npm and Git installation. | Make the Git repository accessible, publish the intended npm version, then run the exact public installation instructions in clean temporary homes. |
| 4 | The extension is tested with the minimum declared Node and Pi versions, as well as the latest compatible version. | **PARTIAL** | Node `>=22.19.0` and Pi/TUI `^0.85.1` are declared at `package.json:34-47`. Pi 0.85.1 loaded under Node 26.8.1 via `pi -e /Users/elafo/workspace/elafo/pi-better-snippets --help`, exit 0. Registry evidence recorded Pi 0.85.1 as the floor/latest available version, but exact Node 22.19.0 was unavailable and not exercised. | Test clean install, check, and host load on Node 22.19.0 and the explicitly chosen latest-supported Node, against minimum/latest admitted Pi versions. |
| 5 | `package.json` correctly declares the name, version, license, `engines`, `peerDependencies`, extensions, and skills. | **PASS** | Name/version are at `package.json:2-3`, license at `:14`, extension/skill paths at `:21-28`, peers at `:34-36`, and Node engine at `:45-47`. `npm pkg get license` exited 0 and returned `"MIT"`. | None for this row. Public project/contact metadata is assessed separately in row 29. |
| 6 | The package contains no secrets, logs, coverage data, `node_modules`, or local files. | **PASS** | Actual tar enumeration and dry-run each contained only the five intended files. `.gitignore:1-4` covers `node_modules/`, `coverage/`, `.DS_Store`, and logs. A bounded candidate-secret scan of every publishable text file exited 1, meaning plain `grep` selected no matching lines. | Add automated archive allowlisting and secret scanning. The pattern scan cannot guarantee detection of unknown secret formats. |
| 7 | All imports are reviewed: no unnecessary access to the network, filesystem, shell, processes, credentials, or telemetry. | **PASS** | Production imports are limited to Pi coding-agent and TUI APIs (`index.ts:1-13`). Clipboard use is isolated to the explicit clipboard path (`index.ts:558-565,582-663`). No extension-owned network, filesystem, credential, or telemetry import exists. The locked host clipboard helper uses platform process/OSC facilities for the requested clipboard feature and supplies text through input rather than command-string interpolation. | Re-review the resolved host clipboard implementation whenever Pi peers or the lockfile change. |
| 8 | There are no unexpected installation or publishing scripts. | **PARTIAL** | Root scripts are only `test`, `typecheck`, and `check` (`package.json:29-32`; `npm pkg get scripts`, exit 0). The lockfile marks four transitive packages with `hasInstallScript`: `@google/genai`, `esbuild`, `protobufjs`, and optional `fsevents` (`package-lock.json:1045-1051,1646-1652,2179-2185,2967-2974`). Installed manifests confirm `@google/genai` `preinstall` (`node_modules/@earendil-works/pi-coding-agent/node_modules/@google/genai/package.json:62-67`), `esbuild` `postinstall` (`.../esbuild/package.json:8-10`), and `protobufjs` `postinstall` plus publishing hooks (`.../protobufjs/package.json:36-57`). The resolved `fsevents` manifest has `prepublishOnly`, a publishing lifecycle hook, but no confirmed install-time `preinstall`, `install`, or `postinstall` hook. No complete hook review was recorded. | Review every resolved lifecycle hook, including optional platform packages; document why it is expected and constrain changes through lockfile review/CI. |
| 9 | Production and development dependency audits have no unaccepted critical or high vulnerabilities. | **PASS** | `npm audit --omit=dev --audit-level=high` exited 0 with zero vulnerabilities. `npm audit --include=dev --audit-level=high` exited 0 at the requested threshold and reported only two moderate Vitest-chain findings. | Update Vitest when compatible or document a time-bounded acceptance of the moderate advisory. Repeat audits at release time. |
| 10 | Clipboard copying is always explicit, user-initiated, and copies only the snippet body. | **PASS** | The sole production write is `copyToClipboard(snippet.code)` (`index.ts:558-565`), reachable through registered command/shortcut flows (`index.ts:587-663,689-704`). Parser output separates body, info, and language (`index.ts:117-125`). Exact copied bodies are asserted at `test/index.test.ts:414-460`. | Retain exact-argument tests; add an opt-in real OS clipboard smoke test. |
| 11 | Behavior outside TUI/RPC is safe and reports errors appropriately. | **FAIL** | `canCopy` prevents clipboard access outside TUI and calls `notify` (`index.ts:575-579`). RPC is tested (`test/index.test.ts:479-487`), but Pi’s JSON/print no-UI context implements `notify` as a no-op (`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js:88-117`). Those modes reject the operation silently. | Use an observable command-error path when UI is unavailable, and test RPC, JSON, and print modes for no clipboard access plus visible error reporting. |
| 12 | Hostile code and language input is tested: control characters, ANSI/CSI/OSC, bidi, invisible Unicode, extreme line lengths, and invalid language names. | **FAIL** | Existing tests cover ordinary parsing and layout but supply no hostile C0/C1, attacker-provided CSI/OSC, bidi controls, invisible Unicode, invalid/control-bearing language identifiers, or genuinely extreme lines (`test/index.test.ts:135-217,260-378`). The ANSI assertion at `test/index.test.ts:278-291` uses trusted mock-generated SGR. | Add table-driven hostile-body and info-string tests. Assert that rendered output contains no untrusted controls while clipboard output preserves the exact body. |
| 13 | Untrusted assistant content cannot inject terminal controls or corrupt the visual layout. | **FAIL** | Fence info accepts arbitrary non-newline text and its first token becomes `language` (`index.ts:99-125`). `ANSI_SEQUENCE` recognizes CSI and `escapeMarkdownOutsideAnsi` deliberately preserves it (`index.ts:132-138`). The raw language enters decorated labels (`index.ts:158-170`), and assistant Markdown is automatically transformed after session start (`index.ts:535-537,665-668`). Picker labels/previews also interpolate untrusted language/body (`index.ts:220-228,391-405,465-523`). A fence info string containing `\x1b[2J` therefore reaches rendering unchanged. | Establish a display-only sanitization boundary for code and language. Preserve raw `snippet.code` only for explicit clipboard output and add hostile terminal-control regressions. |
| 14 | The license is included in the tarball and is compatible with all distributed dependencies and assets. | **PASS** | `LICENSE` is selected at `package.json:15-20` and appears in dry-run/actual tar listings. The tarball contains only project-owned files and this package distributes no third-party dependencies or assets; Pi peers and development dependencies are host/development inputs rather than distributed artifacts. | Recheck the tarball contents and licensing whenever bundled dependencies or third-party assets are added. |
| 15 | Publishing occurs from an attributable, tagged, reproducible commit—not from untracked files. | **FAIL** | During the delegated audit, `git status --short --branch` exited 0 and showed clean `main`; HEAD had author and committer attribution. Afterward, this report was copied into the repository and the present tree contains `?? quality-checklist-audit.md`. Independently, `git tag --contains HEAD` exited 0 with no output, `git remote -v` exited 0 with no remotes, and no release provenance or reproducibility process exists. | Track and review the report, then publish only from a clean commit with an attributable annotated tag and recorded reproducible pack/publish provenance. |

### Functionality and Regression

| # | Checklist item | Status | Evidence and conclusion | Required remediation / verification |
|---:|---|---|---|---|
| 16 | Tests cover backtick and tilde fences, varying fence lengths, CRLF, indentation, and incomplete fences. | **PASS** | Parser implementation is at `index.ts:75-125`. Tests cover both fence markers, different lengths, CRLF, three-space indentation, empty fences, mismatched markers, and missing closers (`test/index.test.ts:135-172`). The clean test run exited 0. | Retain these cases. |
| 17 | Snippets are extracted only from the correct assistant message and valid text blocks. | **PARTIAL** | Latest-assistant selection and exclusion of valid thinking/tool blocks are tested (`index.ts:191-216`; `test/index.test.ts:174-176,194-215`). However, `isAssistantMessage` validates only that `content` is an array, then `snippetsFromAssistantMessage` dereferences `block.type` (`index.ts:190-202`). An assistant payload with `content: [null]` passes the guard and throws rather than rejecting an invalid block. | Validate every content element as a non-null object with appropriate fields; add null, primitive, and malformed-block regressions. |
| 18 | Multiple snippets, empty content, large snippets, and many snippets are tested. | **PARTIAL** | Multiple and empty snippets are covered (`test/index.test.ts:135-171,421-436`). Ten snippets are used in picker layout tests (`test/index.test.ts:319-351`), but they are manually constructed. No large-body extraction or many-fences-in-one-response test exists; current long-line coverage is about 90 characters (`test/index.test.ts:354-367`). | Add many-fence extraction, large multiline body, extreme single-line, and integration-render tests. |
| 19 | Narrow terminals, resizing, long lines, tabs, and wrapping are tested. | **PARTIAL** | Width bounding, tab normalization, wrapping, and responsive height logic exist (`index.ts:141-176,391-405,424-524`). Tests cover width 40, wrapped scrolling, and row shrink from 24 to 12 (`test/index.test.ts:319-366`). Snippet tabs, width expansion, widths 1–20, wide Unicode, and extreme lines are not covered. | Add those synthetic cases and one real TUI resize smoke test. |
| 20 | Invalid and large numeric indexes, along with selection limits, are tested. | **PARTIAL** | Prompt/command validation is at `index.ts:260-287,592-599,689-698`; tests cover ordinary valid/unavailable and missing indices (`test/index.test.ts:230-251,462-477`). No large-number case exists. `Number(value)` can round values above `MAX_SAFE_INTEGER` or produce `Infinity`, causing inaccurate diagnostics. | Require a safe integer or use `BigInt`, preserve the original input in errors, and test safe-integer boundaries plus hundreds-of-digits values. |
| 21 | Keyboard navigation, mouse interaction, double-click, confirmation, cancellation, and `Ctrl+C` are tested. | **PASS** | Implementation covers configured cancel/confirm, Tab, arrows, paging, wheel, click, and double-click (`index.ts:354-388`). Tests cover arrows/Tab, click/double-click, compact mouse exclusion, Enter, Escape, and Ctrl+C (`test/index.test.ts:293-317,337-385,414-420`). | Add wheel-direction and real-terminal smoke tests as defense in depth. |
| 22 | Configurable shortcuts and potential collisions with Pi shortcuts are tested. | **PARTIAL** | Picker actions use `KeybindingsManager` and remapped keys are tested (`index.ts:235-246,354-421`; `test/index.test.ts:369-385`). The extension shortcut is fixed as `ctrl+shift+c` (`index.ts:14,701-704`), and there is no collision fixture. The footer always advertises it (`index.ts:545-555`). | Test host collision/registration behavior and ensure `/copy-snippet` remains visibly documented as the reliable fallback. |
| 23 | Lifecycle hooks do not leave residual state, widgets, or listeners. | **PARTIAL** | Shutdown clears local state and the widget (`index.ts:665-687`), and the extension registers no timers or terminal listeners. Tests only verify handler registration (`test/index.test.ts:390-396`); they do not exercise shutdown/tree changes, open-picker teardown, pending custom dialogs, or reopening. | Emit lifecycle events while each picker is open; verify cancellation, widget cleanup, state reset, command completion, and successful reopening. |
| 24 | Clipboard, rendering, and selection errors are understandable and do not block Pi. | **PARTIAL** | Clipboard, empty-result, and ordinary selection errors are notified (`index.ts:558-565,581-599`) and tested (`test/index.test.ts:462-477`). Picker guards reset in `finally` (`index.ts:602-627,639-662`). Rendering/highlighting exceptions, `ui.custom` rejection, malformed returned selections, and recovery are untested. | Inject rendering and custom-UI failures; assert clear feedback, guard reset, and successful subsequent use. |

### Compatibility and Packaging

| # | Checklist item | Status | Evidence and conclusion | Required remediation / verification |
|---:|---|---|---|---|
| 25 | Published extension and skill paths exist within the tarball. | **PASS** | `package.json:21-28` declares `./index.ts` and `./skills`; actual tar enumeration contained `package/index.ts` and `package/skills/copyable-snippets/SKILL.md`. | Keep archive-path assertions in CI. |
| 26 | The ESM, TypeScript, and Pi APIs used are compatible with the declared version range. | **PARTIAL** | ESM and peer declarations are at `package.json:6,34-47`; strict NodeNext configuration is at `tsconfig.json:1-15`. Typecheck and a host-load smoke test passed against exact Pi/TUI 0.85.1. Exact minimum Node and future versions admitted by `^0.85.1` were not tested. | Add minimum/latest compatibility jobs or narrow ranges to versions actually supported. |
| 27 | The extension is tested without development dependencies installed. | **PARTIAL** | `npm install --ignore-scripts --omit=dev <local-tarball>` exited 0, with TypeScript, Vitest, and `@types/node` absent. However, no Pi host-load or extension behavior was run against that installed no-dev package; the separate `pi -e` command targeted the development checkout. | From the no-dev environment, have Pi discover and initialize the installed package and exercise a minimal extension path. |
| 28 | The README specifies requirements, installation, updates, uninstallation, and basic troubleshooting. | **FAIL** | The complete README documents Git installation and development (`README.md:7-15,32-38`) but has no requirements, update, uninstall, or troubleshooting sections (`README.md:1-42`). | Add Requirements, npm/Git Install and Update, Uninstall, and Troubleshooting sections. |
| 29 | The package includes `repository`, `bugs`, `homepage`, and author/maintainer metadata where applicable. | **FAIL** | Complete `package.json:1-48` has none of these fields; a direct property check returned false for `repository`, `bugs`, `homepage`, `author`, and `maintainers`. | Add applicable canonical source, issue tracker, homepage, and maintainer metadata. |
| 30 | A semantic versioning policy, changelog, and release/tag publishing process exist. | **FAIL** | `package.json:3` contains a semver-shaped version, but repository inventory contains no changelog or release-process document, and no tag contains HEAD. | Add a changelog, SemVer policy, and clean-tree/tag/package/publish process. |

### Documentation and User Experience

| # | Checklist item | Status | Evidence and conclusion | Required remediation / verification |
|---:|---|---|---|---|
| 31 | Documentation, code (including comments, public names, and messages), and maintained repository files are in English, except UI translations and their localization resources. | **PASS** | README and skill are English (`README.md:1-42`; `skills/copyable-snippets/SKILL.md:1-18`). Spanish prose is confined to the translation catalogue (`index.ts:39-54`). | Retain this separation. |
| 32 | Every documented command, shortcut, text, and behavior actually exists. | **FAIL** | Command and shortcut registrations exist (`index.ts:689-704`), but README describes `/copy-snippet` as a “searchable preview picker” (`README.md:21`). Picker input supports navigation/focus/confirm/cancel but no search or filtering (`index.ts:354-369`). | Remove “searchable” or implement and test search. |
| 33 | Unimplemented functional claims are corrected—for example, describe the picker as searchable only if it is searchable. | **FAIL** | The searchable claim contradicts `index.ts:354-369`. README also says locales can be added without UI-logic changes (`README.md:28`), while locale routing is hardcoded to English/Spanish (`index.ts:39,49-52`). | Correct both claims or implement generalized locale selection and picker search. |
| 34 | Documentation explains that copied content originates from potentially untrusted responses. | **FAIL** | README’s only safety statement concerns package execution permissions (`README.md:15`). It does not warn that copied text is extracted from assistant responses (`index.ts:198-201,558-565`). | Add a prominent warning to review assistant-generated content before execution or sharing. |
| 35 | Clipboard privacy behavior is documented. | **FAIL** | README discusses copying (`README.md:17-24`) but not explicit initiation, body-only copying, OS clipboard exposure, persistence, or clipboard-history implications. | Document the data copied and OS/clipboard-manager privacy implications. |
| 36 | The distributed skill produces fences compatible with the parser. | **PARTIAL** | The skill requests fenced Markdown with language identifiers (`skills/copyable-snippets/SKILL.md:8-16`), and the parser accepts that form (`index.ts:93-127`). Parser fixtures cover both marker styles (`test/index.test.ts:135-180`). No installed-skill/model-adherence test exists. | Add an integration fixture showing installed-skill output is parser-consumable. |
| 37 | Labels, explanations, and metadata remain outside copied content. | **PASS** | The skill requires labels/explanations outside fences (`skills/copyable-snippets/SKILL.md:12-16`). Parser separates body and metadata (`index.ts:117-125`), and only `snippet.code` is copied (`index.ts:558-565`), asserted at `test/index.test.ts:414-442`. | Preserve exact clipboard-argument assertions. |
| 38 | The skill does not activate inappropriately for ordinary answers containing code. | **PASS** | Activation is limited to explicit copyable/clipboard-ready requests, and ordinary responses merely containing code are expressly excluded (`skills/copyable-snippets/SKILL.md:3,8,18`). | Add host-level skill-selection testing if Pi supplies a deterministic harness. |

### Translations and Internationalization

| # | Checklist item | Status | Evidence and conclusion | Required remediation / verification |
|---:|---|---|---|---|
| 39 | All UI surfaces are translated: compact picker, standard picker, footer, errors, help, and actions. | **FAIL** | Hardcoded English remains in selector labels, key names, compact/standard headings and counts, footer, invalid-index error, and command/help descriptions (`index.ts:221-228,407-421,453-554,593-597,689-704`). | Add typed catalogue entries for every user-visible string and route all surfaces through translation. |
| 40 | No English text remains hardcoded when the locale is Spanish. | **FAIL** | Compact view, standard view, counts, focus labels, footer, and invalid-index errors remain English regardless of locale (`index.ts:466-469,484-505,519,545-547,595`). | Localize all literals, including plural/count templates, focus state, key fallback text, and actions. |
| 41 | `en`, `es`, variants such as `es-MX`, and a fallback locale are tested. | **FAIL** | Locale routing exists at `index.ts:49-53`, but the sole test file contains no controlled locale setup or locale assertions (`test/index.test.ts:1-510`). Current English assertions depend on ambient locale. | Test `en`, `es`, `es-MX`, mixed-case `ES-mx`, and a fallback such as `fr-FR`. |
| 42 | Translation keys are complete, typed, and contain no broken placeholders. | **PARTIAL** | `Record<"en" \| "es", Record<MessageKey,string>>` enforces current key presence (`index.ts:21-47`), and visible placeholder names agree across locales. Per-key interpolation arguments are not typed and missing names silently become empty (`index.ts:49-53`); no placeholder tests exist. | Define per-key value types and test every placeholder-bearing key in both locales. |
| 43 | Translations use consistent terminology, clear wording, and inclusive language. | **PARTIAL** | The Spanish catalogue consistently uses “fragmento” and avoids gendered user references (`index.ts:39-47`). However, untranslated `snippet`, `preview`, `scroll`, `copy`, `cancel`, `line(s)`, and `of` appear in Spanish workflows (`index.ts:221-228,466-519,545-547`). No native-language review evidence exists. | Complete localization and perform a documented Spanish-language review. |
| 44 | Spanish text is validated in narrow layouts. | **FAIL** | Layout uses width-aware helpers (`index.ts:267-287,424-470`), but the only narrow-layout test is English/ASCII (`test/index.test.ts:354-367`). | Render all Spanish picker/footer/error surfaces at narrow widths and assert bounded width and usable action text. |
| 45 | Unicode, accented characters, RTL/bidi text, and long text are tested. | **FAIL** | Accented catalogue strings exist (`index.ts:44`), but no targeted accent, combining, emoji, RTL/bidi, or Unicode-long-text tests exist. `preview()` truncates by UTF-16 code unit with `.slice(0, 69)` (`index.ts:220-222`), which can split a surrogate pair. | Use grapheme-safe truncation and test accents, combining marks, emoji boundaries, RTL/bidi, invisibles, and long Unicode strings. |

### Maintainability and Governance

| # | Checklist item | Status | Evidence and conclusion | Required remediation / verification |
|---:|---|---|---|---|
| 46 | Code uses strict types, separated responsibilities, and has no significant duplication. | **PARTIAL** | `strict: true` is enabled (`tsconfig.json:2-10`) and typecheck passes. The assistant-message guard is unsound for malformed content (`index.ts:190-202`). Parser, UI, translation, clipboard, and lifecycle occupy one 704-line module, with repeated picker/fitting flow (`index.ts:15-704`). Tests also rely on broad `any` casts (`test/index.test.ts:26-29,49,106,127`). | Fix the invalid narrowing first; then extract small shared fitting/picker helpers and strengthen test-fake types. |
| 47 | Test coverage sufficiently covers the parser, UI, lifecycle, and error paths. | **PARTIAL** | Twenty-nine tests pass and cover substantial parser/UI/copy behavior (`test/index.test.ts:135-510`). Missing areas include malformed content, shutdown/tree behavior, renderer/custom-UI rejection and recovery, hostile input, locales, and real no-dev loading. No coverage provider or threshold exists (`package.json:29-32`). | Add the missing behavioral cases and measured branch/function coverage with justified thresholds. |
| 48 | CI runs a clean installation, typecheck, tests, packaging, and audit. | **FAIL** | Repository inventory found no CI configuration. `check` performs only typecheck and tests (`package.json:29-32`), omitting clean install, packaging, and audits. | Add pinned CI for `npm ci`, typecheck, tests/coverage, package allowlist, production/full audits, and compatibility jobs. |
| 49 | Dependencies and CI tooling are reviewed and reasonably pinned. | **PARTIAL** | Direct development dependencies are exact (`package.json:38-43`), and lockfile v3 records resolved versions and integrity (`package-lock.json:1-29`). Three transitive packages have confirmed install-time hooks, while optional `fsevents` has a publishing lifecycle hook; no complete lifecycle review exists. No CI tooling or dependency-review policy exists. | Pin CI actions by full commit SHA and require lockfile/lifecycle-script review plus scheduled audits. |
| 50 | A process exists for reporting vulnerabilities and responding to issues. | **FAIL** | No `SECURITY.md`, governance/contributor security document, issue metadata, or reporting guidance exists; README and manifest contain none (`README.md:1-42`; `package.json:1-48`). | Add `SECURITY.md` with a private reporting channel, supported versions, response expectations, and disclosure policy. |
| 51 | Permission changes, clipboard behavior, and attack surface are reviewed for every release. | **FAIL** | `AGENTS.md` is a tracked quality checklist and includes this requirement (`AGENTS.md:3,72`), with related component checks in its release-blocker section. However, no completed release record, enforcement mechanism, CI gate, or operational evidence shows that permissions, clipboard behavior, imports, terminal rendering, dependencies, and package contents are reviewed for every release. | Operationalize the existing checklist with required per-release evidence, ownership, and an enforced release gate. |

---

## 3. Release blockers

The unresolved items in the explicit **Release Blockers** section of `AGENTS.md:5-21` are:

1. **Row 3 — FAIL:** Public npm and Git installation cannot be completed.
2. **Row 4 — PARTIAL:** Exact minimum Node and complete supported-version testing are absent.
3. **Row 8 — PARTIAL:** Three confirmed install-time hooks and the optional `fsevents` publishing hook lack a complete lifecycle review.
4. **Row 11 — FAIL:** JSON/print commands fail silently.
5. **Row 12 — FAIL:** Required hostile-input tests are absent.
6. **Row 13 — FAIL:** Untrusted assistant content can inject terminal controls.
7. **Row 15 — FAIL:** HEAD is not covered by a tagged, reproducible, remote-attributable release process, and the newly copied report is not yet tracked.

Additional checklist-wide failures independently make the package unsuitable for third-party distribution: incomplete localization, absent CI/security/release governance, missing public metadata, inaccurate README claims, and missing user-facing safety/privacy documentation.

---

## 4. P0/P1/P2 findings

### P0

1. **Live terminal-control injection from assistant fence metadata**
   - **Location:** `index.ts:99-170,535-537,665-668`.
   - **Evidence:** The raw first info-string token becomes `language`; all CSI sequences matched by `ANSI_SEQUENCE` are preserved. The resulting label is included in automatic assistant Markdown decoration after session start.
   - **Impact:** A hostile response can clear or move the terminal, alter cursor state, or conceal/reorder visible content without requiring picker interaction.
   - **Smallest fix:** Sanitize all untrusted display fields before highlighting/interpolation; preserve the raw body only for explicit clipboard copying.

### P1

1. **Required hostile-input regression matrix is absent** (`test/index.test.ts:135-217,260-378`).
2. **Public npm and documented Git installation are unavailable** (`README.md:7-15`; npm exit 1/E404; Git exit 128).
3. **JSON/print mode failures are silent** (`index.ts:575-579`; host `runner.js:88-117`).
4. **Minimum/latest compatibility evidence is incomplete** (`package.json:34-47`).
5. **Transitive lifecycle hooks were not completely reviewed** (`package-lock.json:1045-1051,1646-1652,2179-2185,2967-2974`): three packages have confirmed install-time hooks, while optional `fsevents` has `prepublishOnly`.
6. **No-dev installation was not followed by extension discovery or initialization** (install command exit 0; separate host load targeted the development checkout).
7. **Spanish localization is materially incomplete and required locale/layout tests are absent** (`index.ts:221-228,453-554,593-597,689-704`; `test/index.test.ts:1-510`).
8. **CI release gating is absent** (`package.json:29-32`; no CI file in repository inventory).
9. **Release provenance, changelog, SemVer policy, and operational evidence for the existing per-release security checklist are absent.**
10. **Security reporting and public support/maintainer metadata are absent** (`README.md:1-42`; `package.json:1-48`).
11. **Untrusted-response and clipboard-privacy documentation is absent** (`README.md:7-24`).
12. **README omits requirements, update, uninstall, and troubleshooting guidance** (`README.md:1-42`).
13. **Lifecycle and renderer/custom-dialog recovery are insufficiently tested** (`index.ts:600-687`; `test/index.test.ts:389-510`).

### P2

1. **Malformed assistant blocks can throw during extraction**
   - `index.ts:190-202`; `content: [null]` passes the array guard and is dereferenced.
2. **Large numeric indexes can round or become `Infinity`**
   - `index.ts:592-597,689-698`.
3. **Unicode preview truncation can split surrogate pairs**
   - `index.ts:220-222`.
4. **Shortcut collision behavior is untested and the footer may advertise an unavailable shortcut**
   - `index.ts:545-555,701-704`.
5. **README inaccurately claims search and generalized locale extensibility**
   - `README.md:21,28`; `index.ts:39,49-52,354-369`.
6. **Large/many-snippet and extreme-layout coverage is incomplete**
   - `test/index.test.ts:135-176,319-367`.
7. **Translation interpolation is not type-safe per key**
   - `index.ts:49-53`.
8. **Production responsibilities and interaction flow are concentrated and duplicated**
   - `index.ts:15-704`.
9. **Installed-skill/model adherence is not tested**
   - `skills/copyable-snippets/SKILL.md:1-18`; `test/index.test.ts:1-510`.

---

## 5. Prioritized remediation plan

1. **Create the untrusted-display boundary.**
   - Sanitize code and language for rendering while retaining the original body only for clipboard output.
2. **Add adversarial security regressions.**
   - Cover C0/C1, CSI, OSC, bidi, invisible Unicode, invalid/long language identifiers, and extreme bodies.
3. **Fix non-interactive reporting.**
   - Use an observable error channel in JSON/print mode and test all host modes.
4. **Harden extraction and Unicode handling.**
   - Validate every content block, reject malformed runtime values safely, and use grapheme-safe truncation.
5. **Complete localization.**
   - Move all visible literals into the typed catalogue; add `en`, `es`, `es-MX`, fallback, Spanish narrow-layout, RTL/bidi, and Unicode tests.
6. **Close functional test gaps.**
   - Add lifecycle teardown, custom-dialog/render failure recovery, large numeric input, collision, tab, resize, wide-character, large-body, and many-fence tests.
7. **Verify real installation environments.**
   - Load and initialize the tarball with no development dependencies; run exact Node 22.19.0 and chosen latest-supported Node/Pi combinations.
8. **Correct documentation and metadata.**
   - Remove false claims; add requirements, updates, uninstall, troubleshooting, untrusted-content warning, clipboard privacy, canonical links, and maintainer data.
9. **Add governance artifacts and operationalize release review.**
   - Add `SECURITY.md`, changelog, and a SemVer/release policy; require completed evidence and ownership for the existing `AGENTS.md` per-release security checklist.
10. **Add pinned CI.**
    - Gate clean install, typecheck, tests/coverage, package allowlist, lifecycle-script review, audits, and compatibility jobs.
11. **Complete dependency lifecycle and advisory review.**
    - Review all resolved lifecycle hooks and resolve or explicitly accept moderate advisories. Reassess distributed licenses if bundled dependencies or third-party assets are introduced.
12. **Establish public distribution and provenance last.**
    - Make the repository available, validate public Git installation, create an attributable release tag, publish npm from that tag, and validate npm installation.

---

## 6. Commands, tests, and environment evidence

The final audit had read/search tools only and did not rerun shell commands. The following results were recorded by the packaging/inventory audits. Where generated temporary paths or exact registry query arguments were not retained, that limitation is stated rather than reconstructed.

### Environment

- Audit date recorded by packaging worker: **2026-09-16**.
- Platform recorded: **Darwin arm64**.
- Node recorded: **v26.8.1**.
- npm recorded: **11.19.0**.
- Git recorded: **2.45.1**.
- `pi --version` — **exit 0**, output `0.85.1`.
- Exact commands/status used to collect Node/npm/Git/OS version strings were not preserved in the audit artifact; only their recorded values are available.

### Repository and provenance

| Command | Exit/status | Result |
|---|---:|---|
| `git status --short --branch` | 0 | During the delegated audit: `## main`, clean before and after packaging checks. After this report was copied into the repository, the current output includes `?? quality-checklist-audit.md`. |
| `git tag --contains HEAD` | 0 | No tags. |
| `git remote -v` | 0 | No remotes. |
| `git ls-remote https://github.com/eLafo/pi-better-snippets.git HEAD refs/tags/*` | 128 | Repository not found. |

HEAD was recorded as `266702a63491f746d054d19bd6bef43bce46e644`, tree `20a5f81fdb1132bdf3150d8d1acec40e52754dc4`. The commit had author/committer attribution. Exact `git show` arguments were not retained.

### Clean check and tests

| Command | Exit/status | Result |
|---|---:|---|
| `git archive HEAD \| tar -x -C /tmp/pi-better-snippets-clean.*` | 0 | Isolated tracked tree created. Exact generated suffix was not retained. |
| `npm ci` in isolated tree | 0 | Clean dependency installation succeeded. |
| `npm run check` in isolated tree | 0 | TypeScript passed; Vitest reported 1 file and 29 tests passed. |
| `npm run check` in checkout inventory | 0 | TypeScript and the same 29 tests passed. |

No coverage command or threshold was run.

### Packaging and metadata

| Command | Exit/status | Result |
|---|---:|---|
| `npm pack --dry-run` | 0 | Exactly five intended files; 9.9 kB packed, 32.1 kB unpacked. |
| `npm pack --pack-destination /tmp/...` | 0 | Tarball created. Exact generated path was not retained. |
| `tar -tzf <generated-tarball>` | 0 | Same five package files. |
| `npm pkg get license` | 0 | `"MIT"`. |
| `npm pkg get scripts` | 0 | Only `test`, `typecheck`, and `check`. |

### Secret scan

Recorded exact scan:

```text
grep -nEI '(api[_-]?key|secret|password|token|BEGIN ... PRIVATE KEY|aws_access_key_id|npm_)' index.ts README.md LICENSE skills/copyable-snippets/SKILL.md package.json
```

**Exit 1; no candidate-secret matches were reported.** For plain `grep`, exit 1 means no lines were selected; exit 0 would mean at least one match. This was a bounded pattern scan.

### Vulnerability audits

| Command | Exit/status | Result |
|---|---:|---|
| `npm audit --omit=dev --audit-level=high` | 0 | Zero vulnerabilities. |
| `npm audit --include=dev --audit-level=high` | 0 | No high/critical findings; two moderate Vitest-chain findings. |

### Compatibility and installation

| Command | Exit/status | Result |
|---|---:|---|
| `pi -e /Users/elafo/workspace/elafo/pi-better-snippets --help` | 0 | Checkout loaded sufficiently for help output under Pi 0.85.1/Node 26.8.1. |
| `npm view @elafo/pi-better-snippets@0.1.0 version dist.tarball time --json` | 1 | E404/package not found. |
| `HOME=/tmp/... pi install -l /Users/elafo/workspace/elafo/pi-better-snippets --approve` | 0 | Local-link install succeeded; exact temporary home suffix was not retained. |
| `npm install --ignore-scripts --omit=dev /tmp/.../elafo-pi-better-snippets-0.1.0.tgz` | 0 | Local packed installation succeeded without TypeScript, Vitest, or `@types/node`. |

Registry queries for Pi/TUI version, engine, and license metadata were recorded as exit 0, but their exact command argument strings were not preserved. Consequently, they support only partial compatibility evidence and are not treated as a substitute for the missing version matrix.

### Rerunnable command templates

These templates reproduce the command shape with fresh temporary paths; they are not substitutes for the historical paths or outputs that were not retained. They pin the clean-tree checks to the audited HEAD recorded above.

Clean archive, install, and check:

```bash
repo=/Users/elafo/workspace/elafo/pi-better-snippets
audited_head=266702a63491f746d054d19bd6bef43bce46e644
clean_dir=$(mktemp -d "${TMPDIR:-/tmp}/pi-better-snippets-clean.XXXXXX")
git -C "$repo" archive "$audited_head" | tar -x -C "$clean_dir"
(
  cd "$clean_dir"
  npm ci
  npm run check
)
```

Package dry-run, actual tarball, and file listing:

```bash
repo=/Users/elafo/workspace/elafo/pi-better-snippets
pack_dir=$(mktemp -d "${TMPDIR:-/tmp}/pi-better-snippets-pack.XXXXXX")
(
  cd "$repo"
  npm pack --dry-run
  npm pack --pack-destination "$pack_dir"
)
tarball="$pack_dir/elafo-pi-better-snippets-0.1.0.tgz"
tar -tzf "$tarball"
```

Local tarball installation without development dependencies:

```bash
repo=/Users/elafo/workspace/elafo/pi-better-snippets
pack_dir=$(mktemp -d "${TMPDIR:-/tmp}/pi-better-snippets-pack.XXXXXX")
(
  cd "$repo"
  npm pack --pack-destination "$pack_dir"
)
tarball="$pack_dir/elafo-pi-better-snippets-0.1.0.tgz"
install_dir=$(mktemp -d "${TMPDIR:-/tmp}/pi-better-snippets-nodev.XXXXXX")
mkdir "$install_dir/app"
(
  cd "$install_dir/app"
  npm init -y >/dev/null
  npm install --ignore-scripts --omit=dev "$tarball"
  npm ls --depth=0
)
```

Remove the generated temporary directories after inspection. The tarball name follows the audited package name/version; update the template if either changes.

---

## 7. Untested/manual checks and residual risks

### Untested or manual checks

1. Exact README Git installation after the repository becomes accessible.
2. Installation of the published npm release.
3. Clean check and host-load under exact Node 22.19.0.
4. Testing against every released Pi/TUI version admitted by peer ranges.
5. Pi discovery and initialization of the no-dev tarball installation.
6. Real OS clipboard behavior on supported platforms.
7. Real TUI resizing, widths 1–20, mouse wheel, shortcut collisions, and open-picker shutdown.
8. Hostile C0/C1, CSI, OSC, bidi, invisible Unicode, invalid language, and extreme input cases.
9. Installed skill activation and model adherence.
10. Native Spanish language/usability review.
11. Review of every resolved transitive lifecycle hook.
12. Reproducible publication from a clean attributable tag.
13. Coverage measurement and enforcement.

### Residual risks

- The real OS clipboard implementation was mocked in tests; platform-specific behavior remains unverified.
- Pi peers are host-supplied, and future versions admitted by `^0.85.1` could change rendering, clipboard, or extension behavior.
- Dependency audits are time-sensitive and must be repeated at release.
- Two moderate development dependency advisories remain unresolved or undocumented as accepted.
- The candidate-secret scan was pattern-bounded.
- Synthetic UI tests do not establish behavior across terminal emulators, Unicode-width implementations, mouse modes, or real resize events.
- Static skill instructions align with the parser, but actual model output and activation are unverified.
- No publication can currently be tied to a public remote or release tag.
- Until rendering sanitization is implemented, merely displaying a hostile assistant fenced block in the TUI remains unsafe.

## Final review verdict

- **Correct:** Clean check, package allowlist, core manifest fields, explicit body-only clipboard data flow, ordinary fence parsing, synthetic picker interactions, dependency audit threshold, and English repository-language policy have affirmative evidence.
- **Finding:** The terminal-control injection, hostile-input test gap, public-install failures, silent non-interactive behavior, incomplete compatibility/localization, and absent release/security governance block distribution.
- **Merge verdict:** **BLOCK**.
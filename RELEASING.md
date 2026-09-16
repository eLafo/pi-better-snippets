# Release process

This document is the release gate for `@elafo/pi-better-snippets`. It describes evidence that must be attached to the exact commit being released. A release is blocked when any required check is missing, fails, or cannot be reproduced.

**Current status:** No public `0.1.0` release is claimed or supported. The current checkout intentionally keeps its work under `Unreleased`. Exact-head CI enforcement is pending the immediately following CI work item; this document defines that required gate but the repository does not enforce it yet. Row 51 is therefore not yet enforced.

## Release status and ownership

Public repository access, npm publication, and GitHub private vulnerability reporting are external gates. This repository does **not** claim that the public Git repository, npm package, private reporting channel, or public installation verification is complete. Do not treat a local checkout, local tarball, or a green local test run as public-release evidence.

The release owner is accountable for the evidence record and final sign-off. The owner must be attributable in Git and must not publish from an untracked or dirty worktree. Only the authorized release owner may push the release tag or publish to npm, after explicit confirmation of the reviewed SHA, tarball hash, registry, and provenance identity.

## Version policy

Versions follow [Semantic Versioning](https://semver.org/):

- **Patch** (`0.1.x`) is for backward-compatible fixes, documentation, and security fixes that do not change the public behavior contract.
- **Minor** (`0.x.0`) is for backward-compatible features while the package is before 1.0.0.
- **Major** (`x.0.0`) is for incompatible public API, package, runtime, or behavior changes. Before 1.0.0, a breaking change may still require a minor version when SemVer's pre-1.0 convention applies; record that decision in the changelog.

Update `CHANGELOG.md` and `package.json` together. Never reuse a released version, overwrite a tag, or publish a package from an uncommitted version change. Keep unreleased work under `Unreleased` until the release finalization step below.

## Required sequence

1. **Start from a clean, attributable base.** Confirm the release owner, Git author and committer identity, current branch, and clean worktree. Do not release from untracked files, generated files, credentials, local reports, or unrelated changes.
2. **Finalize the release before committing or tagging it.** At release time, move the relevant entries from `CHANGELOG.md`'s `Unreleased` section into a dated `[X.Y.Z] - YYYY-MM-DD` section, set `package.json` to the same `X.Y.Z`, and keep the changes together. The release commit must describe the version as dated and released-to-be-published, not as unreleased. Review the final diff, run `git diff --check`, and commit this final release state with an attributable message such as `Release vX.Y.Z`. Do not apply this transformation to the current pre-release checkout until an actual release is authorized.
3. **Run local exact-head checks on the release commit.** Capture `RELEASE_SHA=$(git rev-parse HEAD)` and verify the worktree is clean and the version/changelog agree. Run `npm ci` and `npm run check` with Node `22.19.0` (the declared minimum) and with the selected latest supported Node. Load the extension with Pi coding agent/TUI `0.85.1` (the currently tested baseline). Later host versions are not guaranteed until CI evidence exists. Record `node --version`, `npm --version`, `pi --version`, operating system/platform, dependency versions, commands, and results, and require every result to refer to `RELEASE_SHA`.
4. **Review lifecycle and dependencies.** Review the root scripts, `package-lock.json`, and every resolved dependency manifest for install, postinstall, prepare, prepublish, and related lifecycle hooks. Run `npm audit --omit=dev --audit-level=high` and `npm audit --include=dev --audit-level=high`; record advisories, decisions, and any time-bounded accepted risk. Review dependency and lockfile changes rather than relying only on the root manifest.
5. **Review the attack surface.** Confirm that production imports are limited to the Pi coding-agent and TUI APIs needed by the extension; no unapproved network, filesystem, shell, process, credential, or telemetry access was added. Verify that clipboard writes remain explicit, user-initiated, and pass only the selected raw fence body. Review terminal rendering and display sanitization for assistant-controlled language, body, ANSI/CSI/OSC, bidi, invisible Unicode, and extreme input. Review Pi permissions, lifecycle hooks, error paths, and any changed host APIs. Record the reviewer and evidence for every change.
6. **Verify security reporting before any publication.** Following `SECURITY.md`, verify that GitHub private vulnerability reporting is enabled for the public repository and that the private reporting URL accepts a test/report workflow without exposing vulnerability details. Record the verification owner, date, and link. Stop publication if this gate cannot be verified.
7. **Verify the npm allowlist locally.** Run `npm pack --dry-run` on `RELEASE_SHA` and compare the file list exactly with this five-file distribution allowlist: `package.json`, `index.ts`, `README.md`, `LICENSE`, and `skills/copyable-snippets/SKILL.md`. Changelog, security, release, audit, test, lock, and local files must not enter the archive unless the allowlist is intentionally changed and the distribution reason is recorded. Stop if the archive contains any other file.
8. **Create an annotated tag only after local exact-head checks pass.** The tag must point at `RELEASE_SHA` and use an attributable identity, for example `git tag -a vX.Y.Z -m "Release vX.Y.Z"`. Verify `git rev-parse vX.Y.Z^{commit}` equals `RELEASE_SHA` and verify `git tag -v` where signing is configured. Do not create a tag on a dirty tree, tag the still-unreleased checkout, or move an existing release tag.
9. **Push and verify the immutable remote tag before remote CI or publication.** Only the authorized release owner may run this explicit, non-force push after confirming the tag and SHA:

   ```sh
   git push --atomic origin refs/tags/vX.Y.Z:refs/tags/vX.Y.Z
   REMOTE_TAG_SHA="$(git ls-remote origin 'refs/tags/vX.Y.Z^{}' | cut -f1)"
   test "$REMOTE_TAG_SHA" = "$(git rev-parse vX.Y.Z^{commit})"
   ```

   The remote must reject tag replacement; never use `--force`. Record the remote name, tag ref, reviewed `RELEASE_SHA`, returned remote SHA, and command output. If the remote tag is absent or resolves to another SHA, stop before remote exact-head CI, public Git installation, or npm publication.
10. **Run the remote exact-head CI gate.** CI must check out the remote tag, assert that it resolves to `RELEASE_SHA`, and run clean installation, typecheck, tests, packaging/allowlist, dependency audits, and the required compatibility jobs. Publication is blocked if CI is absent, runs another SHA, or reports any failure. Exact-head enforcement is pending the immediately following CI work item; until that work is complete, row 51 remains not enforced and publication is blocked.
11. **Create and hash exactly one reviewed tarball.** After the tagged commit and remote exact-head CI gate pass, use the declared npm version and run `npm pack` once. Record the resulting filename and SHA-256 hash, for example:

    ```sh
    npm pack
    sha256sum elafo-pi-better-snippets-0.1.0.tgz
    ```

    Do not rebuild, modify, or replace this tarball after hashing. The tarball must match the allowlist, `RELEASE_SHA`, and the reviewed tag.
12. **Publish that exact tarball with provenance.** After explicit release-owner confirmation of the tag SHA, CI URL, tarball filename/hash, registry, and npm identity, publish the hashed file—not a second package build—using the exact public/provenance command:

    ```sh
    npm publish ./elafo-pi-better-snippets-0.1.0.tgz --access public --provenance
    ```

    Record the npm publication result, package version, registry URL, integrity, tarball filename/hash, tag SHA, and provenance output. A failed publication is not evidence of success.
13. **Verify public installations after publication.** Only after publication succeeds, install the exact Git tag in a clean temporary Pi home and install the exact npm version in another clean temporary Pi home. Run `pi list`, start Pi, load the extension, and exercise a minimal fenced-snippet picker/copy path. Record the exact public URLs, versions, temporary-home commands, and results. A local path or local tarball does not satisfy this gate.
14. **Declare completion.** Mark the version supported only after the public Git and npm installations pass, all release evidence is linked, and the release owner signs off. The dated changelog entry and matching package version were finalized before the release commit; do not return them to `Unreleased` or imply publication before this step.

## Reproducibility

The release owner must reproduce the local checks from a clean checkout of `RELEASE_SHA` using Node `22.19.0` and npm `11.19.0` (or the documented selected latest compatibility environment), `npm ci`, and the locked dependency graph. Record the commit SHA, Node version, npm version, OS/platform, Pi/TUI versions, lockfile hash, archive file list, one tarball filename and SHA-256 hash, source revision, and commands. A second clean checkout must produce matching source and package evidence under the same toolchain. The one tarball published in step 12 must be the tarball created and hashed in step 11.

## Failure and rollback rule

Stop the release on any failed check, changed HEAD, dirty worktree, unexpected archive entry, unresolved high/critical advisory, unverified private reporting channel, missing attack-surface sign-off, missing exact-head CI gate, mismatched local or remote tag, failed publication, or failed public installation. Preserve the command output and do not retry publication until the cause is understood and the evidence is rerun.

If a publication has already occurred, do not replace or silently mutate the published artifact. For a package defect, use the next SemVer patch (or the documented appropriate version), update the changelog, create a new reviewed tarball, and repeat the full gate. For a compromised credential or security issue, follow `SECURITY.md`, revoke or rotate the affected credential, notify affected users as appropriate, and record the incident and corrective release.

## Per-release evidence template

Copy this section into the release record and complete every field before declaring the release complete.

### Identity and status

- **Version:** `<version>`
- **Release commit / `RELEASE_SHA`:** `<full commit SHA>`
- **Annotated tag:** `<tag>`
- **Tag target SHA:** `<full tag target SHA>`
- **Remote tag SHA:** `<full remote dereferenced tag SHA>`
- **Owner:** `<name and attributable Git identity>`
- **Reviewer/sign-off:** `<name(s)>`
- **Authority confirmation:** `<name, registry, tag SHA, tarball hash, and date>`
- **Status:** `blocked | ready for CI | ready to publish | published | failed`
- **Public Git gate:** `not claimed | verified (link)`
- **Public npm gate:** `not claimed | verified (link)`
- **Private reporting gate:** `not verified | verified (link)`
- **Changelog entry:** `<path and link>`

### Environment and artifact

- **Node version:** `<version>`
- **npm version:** `<version>`
- **Package manager declaration:** `npm@11.19.0`
- **OS/platform:** `<system and architecture>`
- **Pi version:** `<version>`
- **Pi TUI version:** `<version>`
- **Tarball filename:** `<exact filename>`
- **Tarball SHA-256:** `<hash>`
- **CI URL:** `<immutable exact-head CI URL>`
- **Publication evidence:** `<registry URL, version, integrity, provenance link/output>`
- **Public Git install evidence:** `<URL and result>`
- **Public npm install evidence:** `<URL and result>`

### Commands and results

| Check | Command | Environment | Result | Evidence link |
| --- | --- | --- | --- | --- |
| Clean install | `npm ci` | Node `<version>`, npm `<version>`, `<OS/platform>` | `<pass/fail>` | `<link>` |
| Release finalization | `git diff --check`; version/changelog review; attributable commit | `RELEASE_SHA` | `<pass/fail>` | `<link>` |
| Minimum compatibility | `npm run check` and `pi -e .` | Node `22.19.0`, Pi/TUI `0.85.1` | `<pass/fail>` | `<link>` |
| Latest compatibility | `npm run check` and `pi -e .` | Node `<latest>`, Pi/TUI `<latest tested>` | `<pass/fail/not-run>` | `<link>` |
| Tests | `npm test` | `<environment>` | `<pass/fail>` | `<link>` |
| Package allowlist | `npm pack --dry-run` | `<environment>` | `<pass/fail; exact five files>` | `<link>` |
| Production audit | `npm audit --omit=dev --audit-level=high` | `<environment>` | `<pass/fail; advisories>` | `<link>` |
| Full audit | `npm audit --include=dev --audit-level=high` | `<environment>` | `<pass/fail; decisions>` | `<link>` |
| Reproducibility | `<clean checkout, npm ci, and hash commands>` | `<toolchain and OS/platform>` | `<pass/fail; hashes>` | `<link>` |
| Local exact-head checks | `<commands asserting HEAD = RELEASE_SHA>` | `<RELEASE_SHA>` | `<pass/fail>` | `<link>` |
| Annotated tag | `git tag -a vX.Y.Z ...` and `git rev-parse vX.Y.Z^{commit}` | `<RELEASE_SHA>` | `<pass/fail; tag SHA>` | `<link>` |
| Immutable tag push | `git push --atomic origin refs/tags/vX.Y.Z:refs/tags/vX.Y.Z` | `<remote>` | `<pass/fail>` | `<link>` |
| Remote tag verification | `git ls-remote origin refs/tags/vX.Y.Z^{}` | `<remote>` | `<pass/fail; remote SHA>` | `<link>` |
| Exact-head CI | `<immutable CI URL>` | `<remote tag/commit>` | `<pass/fail/not-enforced>` | `<link>` |
| Exact tarball | `npm pack` then `sha256sum <filename>` | `<Node/npm/OS>` | `<pass/fail; filename/hash>` | `<link>` |
| Publication | `npm publish ./<exact-tarball>.tgz --access public --provenance` | `<registry and identity>` | `<pass/fail; integrity/provenance>` | `<link>` |
| Git install | `<clean temporary-home commands>` | `<public tag URL>` | `<pass/fail>` | `<link>` |
| npm install | `<clean temporary-home commands>` | `<public version>` | `<pass/fail>` | `<link>` |

### Review sign-offs

- **Lifecycle/dependencies:** owner `<name>`; resolved hooks reviewed `<yes/no>`; lockfile and advisories `<result/link>`.
- **Permissions/imports:** owner `<name>`; production imports and Pi permissions reviewed `<yes/no>`; evidence `<link>`.
- **Clipboard:** owner `<name>`; explicit action, complete raw body, and body-only argument verified `<yes/no>`; evidence `<link>`.
- **Terminal/input safety:** owner `<name>`; sanitized bounded previews, raw clipboard distinction, ANSI/CSI/OSC, bidi, invisible Unicode, hostile language, and long-input review `<yes/no>`; evidence `<link>`.
- **Package contents:** owner `<name>`; exact five-file allowlist verified `<yes/no>`; evidence `<link>`.
- **Private reporting:** owner `<name>`; GitHub private reporting enabled and verified `<yes/no>`; evidence `<link>`.
- **Remote tag:** owner `<name>`; immutable push and dereferenced remote SHA verified `<yes/no>`; evidence `<link>`.
- **Public artifacts:** owner `<name>`; Git and npm installation evidence `<verified/not claimed>`; evidence `<link>`.
- **Exact-head CI enforcement:** owner `<name>`; enforced `<yes/no/pending CI work item>`; evidence `<link>`.
- **Final release decision:** owner `<name>`; all blockers closed `<yes/no>`; date `<YYYY-MM-DD>`.

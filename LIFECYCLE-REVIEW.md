# Resolved dependency lifecycle review

`npm run verify:lifecycle` is fail-closed supply-chain review. It reads the root manifest, every installed resolved `node_modules/**/package.json`, and `package-lock.json`. The canonical hook set in `scripts/lifecycle-review.json` is: `preinstall`, `install`, `postinstall`, `prepublish`, `preprepare`, `prepare`, `postprepare`, `prepack`, `postpack`, `prepublishOnly`, `preversion`, `version`, `postversion`, `publish`, `postpublish`, `prestart`, `start`, `poststart`, `prestop`, `stop`, `poststop`, `prerestart`, `restart`, `postrestart`, and npm's `dependencies` hook.

The root package has a separately reviewed record for its complete `package.json` `scripts` object, not merely canonical lifecycle names. Any added, removed, or changed root script—including `precheck` and `preverify`—requires explicit inventory review. The obsolete custom release-evidence scripts were removed when release orchestration moved to Release Please; this does not add an npm lifecycle hook or consumer-install behavior. The inventory currently contains the root record, 52 installed manifests, one Darwin optional lock-only manifest record, four exact `hasInstallScript` lock records, and 261 complete lock package fingerprints. Each fingerprint fixes path, version, integrity, optional/OS/CPU metadata, link state, and resolved source where applicable. A new root hook, installed hook, package path, command, version, integrity, platform/link/resolved field, implicit install case, or `hasInstallScript` entry fails verification—even if an optional package is absent on the current platform.

## Consumer-install execution and implicit install metadata

The exact lock inventory includes every `hasInstallScript: true` package, even if it has no explicit lifecycle command or is unavailable on the current platform:

| Resolved package | Consumer-install behavior and attack surface |
| --- | --- |
| `@google/genai@1.52.0` beneath Pi coding agent | `preinstall: echo 'preinstall: no-op'`; explicitly harmless but still reviewed. |
| `esbuild@0.28.1` beneath Pi coding agent | `postinstall: node install.js`; selects/downloads a platform binary, so filesystem, process, and network behavior require review. |
| `protobufjs@7.6.5` beneath Pi coding agent | `postinstall: node scripts/postinstall`; arbitrary upstream Node code runs during consumer installation. |
| `fsevents@2.3.3` | Optional Darwin package. Its manifest has no explicit install hook, but lock metadata marks `hasInstallScript` and npm may use the native `node-gyp rebuild` default. Its exact lock record remains required when the manifest is absent off-platform. |

## Package/publish-only hooks

The remaining reviewed hooks are non-consumer package, publish, version, or local start/stop operations. They do not imply consumer-install execution, but each can execute arbitrary upstream shell/Node code when its upstream lifecycle runs. The machine-enforced JSON inventory records every command exactly, including all Pi packages (`pi-coding-agent`, `pi-tui`, `chord`, `pi-agent-core`, `pi-ai`, `pi-telemetry`), `lightningcss`, Google/AWS dependencies, build/test dependencies, and both nested/direct `yaml@2.9.0` manifests.

## Installation and review order

CI installs/asserts npm `11.19.0`, runs `npm ci --ignore-scripts`, and verifies this inventory **before** any dependency lifecycle hook can run. It then runs normal `npm ci` and verifies again. This order applies to the locked baseline, registry-latest, and tagged jobs; the registry-latest job validates the locked baseline before installing mutable latest hosts. Linked/workspace lock entries must be installed symlinks whose real targets remain inside the repository, match the lock resolved target, and expose the reviewed manifest hooks; loops and escaping targets fail. Latest-host and no-dev compatibility installs use `--ignore-scripts` because they are load tests, not lifecycle execution evidence. Local release checks must follow the same order. `--ignore-scripts` alone is never lifecycle safety evidence.

Update `scripts/lifecycle-review.json` and this document in the same reviewed dependency/lockfile change. A reviewer must explicitly approve every lifecycle or attack-surface difference.

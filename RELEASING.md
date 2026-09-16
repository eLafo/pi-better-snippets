# Release process

This project uses [Release Please](https://github.com/googleapis/release-please) to derive versions from Conventional Commits, maintain the changelog, create release pull requests, and create GitHub tags and releases. npm publication remains a separate, explicitly authorized operation.

## Repository setup

Before enabling the workflow, configure the repository as follows:

1. Create a fine-grained personal access token that can write repository contents, pull requests, issues, and labels.
2. Store it as the Actions secret `RELEASE_PLEASE_TOKEN`.
3. Ensure the token's actor can create release pull requests and GitHub releases.
4. Protect `main`: require review and all jobs from `.github/workflows/ci.yml` before merging.

A dedicated token is required because pull requests and tags created with the repository's default `GITHUB_TOKEN` do not trigger subsequent GitHub Actions workflows. The token must be scoped only to this repository and rotated according to the owner's credential policy.

## Versioning and changelog

Commits merged into `main` must follow Conventional Commits:

- `fix:` produces a patch release.
- `feat:` produces a minor release.
- `feat!:`, `fix!:`, or a `BREAKING CHANGE:` footer produces a major release.
- Other commit types are included according to Release Please's Node release strategy but do not necessarily cause a version bump.

The configuration lives in `release-please-config.json`; `.release-please-manifest.json` records the last released version. The initial release is configured as `0.1.0`, and tags use the `vX.Y.Z` format.

Do not manually edit a version proposed in a release pull request unless intentionally overriding Release Please. Do not manually create a competing release tag or edit generated release notes in a way that disagrees with the committed changelog.

## Release sequence

1. Merge conventional commits into `main`.
2. The `release-please` workflow opens or updates the release pull request.
3. Review the proposed version, `CHANGELOG.md`, `package.json`, and `package-lock.json`.
4. Require the complete CI suite on the release pull request, including typechecking, coverage, package allowlist verification, lifecycle review, action pin verification, dependency audits, no-development-dependency smoke testing, and host compatibility.
5. Merge the release pull request only when every required check and review passes.
6. On the resulting `main` push, Release Please creates the `vX.Y.Z` tag and matching GitHub Release.
7. Verify that the tag targets the merged release commit and that the GitHub Release notes match the committed changelog.

The Release Please action is pinned to a full commit SHA. Updating it requires reviewing the upstream release and changing that SHA in a normal pull request.

## npm publication

This repository does not currently publish to npm automatically and stores no npm publication token. Creating a GitHub Release does not authorize npm publication.

After explicit owner authorization:

1. Check out the exact `vX.Y.Z` tag in a clean environment.
2. Use npm `11.19.0` and a supported Node version.
3. Run `npm ci --ignore-scripts` and `node scripts/verify-lifecycle.mjs` before allowing dependency lifecycle scripts.
4. Run normal `npm ci`, `npm run verify:lifecycle`, and `npm run check`.
5. Run `npm pack` once, inspect and hash the resulting tarball, then publish that exact tarball with public access.
6. Verify the exact npm version and Git tag installation paths described in `README.md` from clean Pi homes.

Prefer npm Trusted Publishing for future publication automation rather than a long-lived npm token. Such automation must use a protected GitHub environment and must be reviewed separately before it is enabled.

## Failure and rollback

Do not merge a release pull request with failing or missing checks. Never move or replace a published tag or npm artifact. If a release is defective, correct it with conventional commits and publish a new SemVer version. A GitHub Release may be marked as a prerelease or documented as withdrawn, but its original tag and artifact history must remain auditable.

---
description: Resolve a GitHub issue with an evidence-backed pull request
argument-hint: "<issue-number-or-URL>"
---
Resolve GitHub issue $1 end to end. Use the issue as the authoritative scope. Write all content published on GitHub (issue comments and pull-request title/body) in English.

## Clarification gate
1. Read the issue and its comments before planning or changing code.
2. Identify acceptance criteria, constraints, compatibility requirements, and open decisions.
3. If information needed to implement safely is missing or ambiguous, ask concise, concrete questions directly on the issue and stop until answered. Do not guess.
4. Record confirmed decisions in the PR body.

## Plan
1. Read repository instructions, development documentation, relevant source/tests, and current git state.
2. Create a concise plan derived from the issue: expected behavior, implementation seams, safety/compatibility considerations, tests, and documentation.
3. Include the plan in the PR body.

## Delegated workflow
Before implementation, use Pi subagents to run a dynamically composed workflow. Do not use a static task list or a foreground CLI fallback.

1. Read the Pi subagents workflow guidance and list available executable agents/capabilities.
2. Create exactly one top-level asynchronous `workflowScript` for this issue. Compose the child runs dynamically from the confirmed issue scope, rather than hard-coding a generic workflow.
3. Use distinct, bounded roles: an implementation lane with sole write authority, plus a fresh-context, read-only review lane after the implementation and validation barrier. Add narrowly scoped research or validation children only when the issue needs them.
4. Give every child its objective, repository/ref, authority boundary, relevant constraints, acceptance criteria, validation, expected report, and stop/ask conditions. The parent retains decision-making, commits, and GitHub publication authority.
5. If subagent infrastructure or child tooling fails, stop and report the exact failure and repository/branch state; do not silently switch execution protocols.

## Development
1. Before editing, create and switch to a dedicated branch from the current upstream base. If implementation work already exists on the base branch, create the dedicated branch immediately and continue only there; never include unrelated working-tree changes.
2. Implement only the accepted issue scope and follow repository-specific safety and compatibility rules.
3. Update or add focused tests for changed behavior, failure paths, and relevant regressions.
4. Update user-facing or developer documentation when behavior, configuration, or workflow changes.

## Checklist and validation
- [ ] Scope and open decisions are confirmed in the issue.
- [ ] The implementation follows repository instructions and accepted issue requirements.
- [ ] Focused tests cover the changed behavior and relevant regressions.
- [ ] Required project validation commands pass.
- [ ] Documentation is current.
- [ ] The final diff excludes unrelated changes.
- [ ] An independent review has been completed; valid blockers are fixed and revalidated.

Run focused tests and all required repository validation commands. If a command cannot run, capture its exact command, output/failure, and reason.

## Evidence and pull request
Open one pull request that closes the issue. Its body must include:
- the implementation plan;
- the completed checklist, explaining any unchecked item;
- evidence: changed files, relevant test cases, exact commands and results, documentation updates, review outcome, and residual risks;
- `Closes #<issue-number>` (or the equivalent closing reference).

Before opening the PR, inspect the final diff and obtain an independent review. Address valid blockers and rerun affected validation. Do not merge, release, or modify unrelated files.

## Completion gate
Do not report the issue as resolved until the dedicated branch has been pushed and a pull request with a GitHub URL has been opened against the upstream base. Include that URL in the final response, along with the validation result and any intentionally uncommitted unrelated files.

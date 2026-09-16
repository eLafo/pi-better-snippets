# Security policy

## Supported versions

No public version is currently supported. Version `0.1.0` is an unreleased package version; support begins only after the release gate is complete and the public artifacts have been verified.

| Version | Supported |
| --- | --- |
| `0.1.0` (unreleased) | No |
| Any public release | None currently |
| Development versions | No; best effort review only |

Public repository access, npm publication, and GitHub private vulnerability reporting are external release gates. This policy does not claim that any public release or reporting channel is currently available.

## Reporting a vulnerability

The intended private reporting URL is:

<https://github.com/eLafo/pi-better-snippets/security/advisories/new>

Before publication, the release owner must verify that this URL works for this repository, that GitHub private vulnerability reporting is enabled, and that a private report can be received. The verification result must be recorded in the release evidence. Do not assume the channel is operational before that gate passes.

Do not file public issues, discussions, or pull requests containing exploit details, proof-of-concept payloads, credentials, or other information that could enable exploitation. If private reporting is not yet verifiably available, retain the details securely and use an existing private communication method already available to you, or open a public issue containing only a request for a private contact channel. Never include the vulnerability details in that public request. This project does not publish an email address here.

When the private channel is verified, include the affected version or commit, environment, impact, reproduction steps, and a minimal safe proof. Remove secrets and personal data before sending a report.

## Response and coordinated disclosure

Once private reporting is enabled, the maintainer aims to acknowledge a private report within 5 business days, provide an initial triage or severity assessment within 10 business days, and give periodic status updates while a fix is developed. These are response targets, not a guarantee of resolution time.

The maintainer will coordinate a fix, release, and disclosure date with the reporter. Please allow reasonable time for investigation, user notification, and downstream updates before public disclosure. Reporters will be credited when they request it and when doing so is safe. Do not disclose the issue publicly before the coordinated date.

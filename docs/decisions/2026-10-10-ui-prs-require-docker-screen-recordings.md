# UI pull requests require a screen recording from the PR build running in Docker

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial) · v2 2026-10-10 (scope limited to feature PR creation)
- **Deciders:** Harsha Chintalapani
- **Guard:** `pr-checklist` during creation of a UI feature or feature-task PR
- **Related:** #35187; #35045; `skills/ui-pr-recording/SKILL.md`

The v2 amendment below defines the current scope: UI feature/task PR creation only.

## Context

The PR template allowed screenshots alone and did not establish which build produced the visual
evidence. The glossary preference demo in #35045 exercised enabled, disabled and re-enabled states
against Docker with sample data. A reusable procedure makes that evidence part of every UI review.

## Decision

Every production UI change, including shared components, styling, localization and refactors,
must run the PR build in Docker with sample data and embed a verified GitHub-hosted screen
recording in the PR description before requesting review. The description records the build SHA,
startup/health evidence, data setup and demonstrated outcomes. Re-record after UI/runtime changes;
later documentation or test-only commits may retain evidence for unchanged runtime code.

The `ui-pr-recording` skill owns the procedure. Screenshots are supplemental, and automated tests
remain required where applicable. Missing setup, recording or upload keeps a PR draft. Changes
with no production UI impact may explain why recording is not applicable.

## Consequences

Reviewers can see the behavior running against the real service and compare the evidence with
the reviewed code. Contributors need Docker and a working video-upload path; shared local stacks
and their data must be preserved. Recordings use synthetic data and live as GitHub attachments,
outside the source tree.

This is a contributor and review requirement, not a new CI status check or branch-protection rule.
A URL alone cannot prove a recording shows the right build and behavior; reviewers check that
evidence. Revisit automated enforcement if the repository adopts a reliable evidence validator.

## Amendment — v2: enforce during creation of a UI feature or feature-task PR

The requirement applies only when creating a PR that implements or extends a UI feature, including
a task or subtask of that feature with UI impact. Task/issue intent and the diff determine scope;
changed UI paths or labels alone do not. Standalone fixes, refactors, styling, localization, docs,
tests and backend-only work may explain N/A. Styling that delivers part of a UI feature qualifies.

This replaces the broad scope and review requirement above. Recording and upload belong to the
PR-creation process; they are not enforced during ordinary implementation, standalone review or
routine description updates. The Docker, sample-data, verification and attachment procedure is
unchanged. A blocked qualifying PR can be created as draft with its remaining work stated.

# PRs run a fresh-context self-review against the shared review bar

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** reviewer; `pr-checklist` requires the reviewed HEAD and outcomes before PR creation
- **Related:** open-metadata/OpenMetadata#35610, open-metadata/openmetadata-collate#7534, open-metadata/ai-platform#1740

## Context

`REVIEW.md` records an analysis of 1,547 PRs over 30 days (2026-09-16 to 2026-10-16). Findings that
identified a failure path and a fix were accepted 85–100% of the time; open questions and rule
quotations were accepted about half the time or less. Authors repeatedly missed defects an
independent reader could catch before the PR opened, while repeated style feedback added noise.

The authoring harness and the reviewer need the same bar. A self-review of `HEAD` also needs a
committed snapshot: staged or unstaged fixes are absent from `git diff origin/main...HEAD`.

## Decision

- Every PR runs a fresh-context self-review against `REVIEW.md` before it opens, including small
  and documentation-only diffs. `pr-checklist` refuses to open the PR without that pass.
- Commit all intended changes before each pass, including fixes from the previous pass. Review
  the committed diff at a pinned SHA; unrelated working-tree changes stay outside that commit.
  Use an independent subagent with none of the author's session context when available; otherwise
  run the same pass locally.
- Fix or explicitly answer every important finding and every missing test for changed behaviour.
  After any intended change, commit and repeat. Record the final reviewed SHA and the outcomes in
  the PR body so they identify the content that was reviewed.
- A review reports at most six yellow nits. After the first review, report only important
  findings. The exact six-nit cap is a policy choice to bound low-value feedback, not a threshold
  derived from the measured acceptance rates.

## Consequences

The authoring and reviewing harnesses apply one shared bar, and the recorded SHA makes stale
reviews visible. Self-review adds time even to small changes; an independent agent spends
additional context to avoid inheriting the author's assumptions. Nits remain optional for the
author, and later reviews focus on defects rather than restarting style discussions. Revisit the
cap or gate if measured review outcomes show that its cost exceeds the defects it prevents.

# A final reviewer with EditAll may approve and publish in one Studio action, as two separate writes

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Harsha
- **Guard:** `OntologyTaskDetail.test.tsx`, `OntologyTasksDrawer.test.tsx`, `OntologyReviewTasks.spec.ts`
- **Related:** ADR:2026-10-14-ontology-reviews-bind-workflow-tasks-to-revisions, PR #36188

## Context

ADR:2026-10-14-ontology-reviews-bind-workflow-tasks-to-revisions makes release review and activation
distinct operations. A final reviewer who may also publish otherwise approves, waits for the
refreshed state, and activates by hand. The Tasks drawer offers one button for that case, which
raises three questions the earlier record leaves open: when the two steps may be chained, who may
chain them, and what happens when the second step fails.

## Decision

The drawer shows `Approve & publish` only when the review read says the caller's vote completes the
approval rule and the caller holds `EditAll` on the owning ontology. Approval grants no publish
right, so a reviewer without `EditAll` sees plain `Approve`.

The vote and the activation are two writes. The vote resolves the task through `resolveTask`, and the
release is `Approved` when that call returns. The drawer then calls the activation endpoint with the
activation revision it already holds. It never wraps the two in a client transaction.

When activation fails, the vote stays committed and the release stays `Approved`. The drawer shows
the error and keeps a separate `Publish` button. `Publish` re-reads the ontology state and the
caller's `EditAll` permission, then activates with the fresh activation revision. It throws without
writing when the ontology id differs or the permission is gone.

## Consequences

An activation conflict, such as another release activated first, never loses a recorded approval.
Rollback and activation by reviewers without `EditAll` stay out of scope. Letting an ontology
reviewer publish a release they approved would widen the publish right, so it needs a new record
that supersedes this one.

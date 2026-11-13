# A bot PUT never removes reviewers or experts

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** ulixius9
- **Guard:** `MetricResourceIT#put_reingestingANewExpressionChangesOnlyTheExpression` fails if
  re-ingestion drops the reviewers or experts a user set
- **Related:** ADR:2026-11-11-a-bot-put-never-removes-a-metric-parent-or-group, #37572

## Context
No connector sends reviewers or experts; users set them. Ingestion re-PUTs every metric it
manages, and `EntityUpdater.updateReviewers` / `updateExperts` applied the empty request lists, so
every scheduled run removed them. Owners already had a bot-PUT guard; these two did not.

## Decision
- A bot PUT that names no reviewers keeps the stored reviewers; the same for experts.
- A bot PUT that names some applies them as before.
- This holds with `overrideMetadata=true`: connectors never send these fields, so an empty list
  never means "remove".
- A PUT by a user and any PATCH apply the request as before.

The rule lives in `EntityUpdater`, so it covers every entity type with reviewers or experts.

## Consequences
Re-ingestion no longer clears review assignments, so it cannot strand an approval. A bot cannot
clear reviewers or experts through PUT; that needs a PATCH.

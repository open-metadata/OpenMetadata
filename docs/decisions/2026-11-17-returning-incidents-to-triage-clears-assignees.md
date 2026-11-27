# Returning an incident to triage clears its current assignment and preserves its history

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** `IncidentTaskIntegrationIT`, `AutoAssignIncidentIT`, `IncidentWorkflowUpgradeIT`, `TaskActivityTimeline.test.tsx`
- **Related:** ADR:2026-11-17-resolved-incidents-are-final, [PR #37613](https://github.com/open-metadata/OpenMetadata/pull/37613)

## Context

Assigned incidents need a direct transition to Acknowledged. Returning an incident to New or
Acknowledged means it no longer has an assignee, even when automatic owner assignment originally
assigned it. The incident history must still show the earlier assignment and its assignee.

## Decision

Assigned incidents may move to New or Ack on the same task and incident identity. These transitions
clear the task's assignees and its workflow assignment state. The destination stage must not
immediately assign owners, reviewers, or candidates again. A later explicit assignment remains
available. Ack-to-New retains the same clearing behavior.

The status timeline appends the new status and preserves every previous Assigned record, including
its original assignee. Resolved incidents remain final.

## Consequences

Automatic owner assignment still applies when a new incident starts. Explicitly returning an
incident to triage overrides automatic assignment for that running incident until someone assigns
it again. Upgrades add missing Assigned return transitions without overwriting conflicting custom
graphs and migrate compatible running instances before exposing those transitions.

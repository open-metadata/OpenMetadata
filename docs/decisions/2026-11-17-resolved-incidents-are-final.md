# A resolved incident is final and a subsequent test failure opens a new incident

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial) · v2 2026-11-17 (link the clarified return-to-triage assignment rule)
- **Deciders:** Teddy Crepineau
- **Guard:** `IncidentTaskIntegrationIT`, `AutoAssignIncidentIT`, `TestCaseResourceIT`
- **Related:** [Issue #36717](https://github.com/open-metadata/OpenMetadata/issues/36717), [PR #37613](https://github.com/open-metadata/OpenMetadata/pull/37613)

## Context

An acknowledged or assigned incident may need to return to New without losing its history.
Previously, legacy status writes could also reopen a resolved incident, mixing a later test
failure into a lifecycle that operators had already completed.

## Decision

A Resolved incident is final. No test-case resolution status write, bulk write, legacy bridge,
task reopen, or task status update may reopen its task or stateId. A subsequent failing test
result opens a distinct incident task and stateId, preserving the completed incident's history.

An open incident may return from Ack or Assigned to New on the same task and stateId. Returning
to New clears its previous assignment through the shared task transition; the destination stage
then recomputes assignees from its configured owners, reviewers, and candidates. A repeated failing
test result while an incident remains open does not reset that incident's stage.

## Consequences

Each completed incident retains a stable resolution and history. Clients must distinguish a
new failing test result from a user-requested status change; a user-requested New resolution-status write cannot reopen
a resolved incident. Explicitly creating a new incident task is a separate lifecycle, including
the UI action offered after resolution. Existing callers that reopened resolved incidents must
instead report a subsequent failure when there is one.

## Amendment — 2026-11-17

The assignment recomputation described above is superseded by
ADR:2026-11-17-returning-incidents-to-triage-clears-assignees. Assigned incidents can also return
to Ack. Both return paths clear the current assignee while retaining all earlier Assigned records.

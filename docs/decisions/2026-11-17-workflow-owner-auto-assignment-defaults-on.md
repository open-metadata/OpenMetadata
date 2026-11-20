# Workflow owner auto-assignment defaults to enabled and does not restrict manual assignment

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** `AutoAssignIncidentIT`, `TaskWorkflowLifecycleResolverTest`, `WorkflowConfigFormV1.test.tsx`
- **Related:** [Issue #36717](https://github.com/open-metadata/OpenMetadata/issues/36717), [PR #37613](https://github.com/open-metadata/OpenMetadata/pull/37613)

## Context

Incident workflows automatically assign entity owners. Some operators need incidents to begin
without an assignee while retaining the ability to assign people and configure reviewers.
Saved definitions predating this option must retain their existing behavior.

## Decision

`WorkflowDefinition.config.autoAssignOwners` and the corresponding create-workflow field control
automatic owner assignment. An absent config, absent field, or value other than explicit false
means enabled. The seeded incident workflow explicitly enables it.

The workflow bound to the task supplies this setting. It is copied into the `autoAssignOwners`
Flowable start variable. False disables owner fallback and `addOwners`; it does not remove
reviewers, configured candidates, or explicit manual assignees. An incident advances to Assigned
automatically only when it actually inherits assignees.

## Consequences

Existing saved definitions retain owner assignment without a backfill. A disabled setting can
leave an owned entity's incident at New and unassigned, while manual assignment still works.
The setting captured by a running process remains its start-time value; workflow edits govern
new instances. Schema, server, and editor implementations must preserve the optional boolean
and its compatibility default.

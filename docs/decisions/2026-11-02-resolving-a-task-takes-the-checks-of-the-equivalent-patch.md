# Resolving a task takes the checks of the equivalent PATCH

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** yan-3005
- **Guard:** `TaskTargetOperationsTest`, `TaskTagTargetTest`, `TaskResourceIT#testDescriptionTaskAboutAnotherUserNeedsEditAllOnThatUser`, `TaskResourceIT#testResolvePayloadNamingDifferentAssigneesNeedsReassignTask`, `TaskResourceIT#testFilingAnApprovalTaskAboutAnEntityNeedsEditAllOnIt`, `TaskResourceIT#testTagTaskFieldMustBeATaggedFieldOfItsEntity`, `TaskResourceIT#testTaskTypeIsRefusedAndWorkflowBindingIsKeptOnPatch`
- **Related:** `TaskTargetOperations`, `TaskTagTarget`, `TaskResource`

## Context

Resolving a task writes a change to the entity the task is about, or to the task itself. The same
change can be made directly with a PATCH, which derives its required operations from the entity
type, the field and, for tags, each label. Task resolution chose its operation from the task type
alone, so the two routes to one write could require different rights.

## Decision

- Resolving a task requires, on the entity it is about, each operation a PATCH of the same change
  requires, with `EditAll` accepted in place of any of them:
  - for another user's profile, `EditAll`;
  - for a field, the entity type's own operation for it (`ResourceRegistry.getEntityEditOperation`);
  - for each tag label the task's payload, the request's payload or the request's `newValue` names,
    the label's operation (`JsonPatchUtils.mapTagToOperation`).
- A resolve request whose payload names assignees other than the task's current ones requires
  `ReassignTask`, as `PATCH /assignees` and bulk Assign do. The `assign` and `reassign` transitions
  carry their assignees and are not affected.
- A tag task's field path names the entity (`tags`, `entity` or empty) or a field of it that carries
  tags. It is checked when the task is filed and when it is applied, before the task changes state;
  declining a task is not checked. Tags are written only through the entity.
- Filing a `GlossaryApproval` or `RequestApproval` task about an entity through the API requires
  `EditAll` on that entity, as filing an ontology review does. Governance workflows open these tasks
  on their own path.
- PATCH refuses a change to a task's `type` or `category`, and keeps the workflow instance and change
  request the task belongs to.

## Consequences

- Under the default policies every user holds the tag operations, so the label check changes
  behaviour only where a policy restricts them.
- A client that diffs a stale copy of a task before patching it keeps working: the workflow binding
  it would remove is kept.
- A tag task whose field was removed after it was filed can be declined but not approved.

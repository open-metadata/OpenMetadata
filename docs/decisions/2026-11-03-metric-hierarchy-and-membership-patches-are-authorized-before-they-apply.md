# Metric hierarchy and metric group membership patches are authorized before they apply, against the state they apply to

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** karanh37
- **Guard:** `MetricResourceTest#metricPatchRejectsOperationsOnTheDocumentRoot`,
  `#hierarchyPatchIsAuthorizedOnTheMetricBeforeItIsSimulated`;
  `MetricGroupResourceTest#patchIsAuthorizedOnTheGroupBeforeItIsSimulated`,
  `#patchAddressingMembersRequiresViewOnEveryMember`,
  `#memberPatchReachesTheRepositoryPinnedAndAnsweredWith412OnceMembersShift`;
  `PatchEntityToolTest#execute_rejectsMetricHierarchyAndMembershipChanges`
- **Related:** open-metadata/OpenMetadata#36909

## Context
Metric and metric group PATCH run extra checks beyond `patchInternal`: EDIT_ALL on every metric a
patch moves, and on the parent and group it moves them to. To find those metrics the resources
apply the patch to a loaded copy first. That simulation read the stored entity before the caller
was authorized, and its errors quoted it. The checks were keyed on field names, which an operation
on the document root does not have. And a group's members are addressed by index, so a patch
authorized on one load could be applied by the repository to a different member list.

## Decision
- Metric, metric group and task PATCH authorize the patch itself (the same check `patchInternal`
  makes) before loading the entity or simulating the patch.
- A metric PATCH operation whose `path` is the document root (`""`) is rejected with 400.
- A metric group PATCH that addresses members (any `path` or `from` that is `""`, `/metrics` or
  below it) requires VIEW_BASIC on every current member. The repository receives it with a leading
  `test` of `/metrics` against the members it was authorized on. If they changed, the request fails
  with 412 and the client retries.
- MCP `patch_entity` refuses changes to a metric's `parent` or `metricGroup` and to a group's
  members. Those go through the REST resources, which own the checks. Other metric and metric group
  edits stay available through MCP.

## Consequences
- A refused caller gets 403 where an unapplicable patch used to give 400 or 404.
- Two simultaneous member edits on one group can give one of them a 412.
- Clients must patch named fields of a metric, not replace the whole document.
- An agent moves metrics or edits group membership through the REST API, or the bulk membership
  endpoints, not MCP.
- To revisit, the per-metric authorization would have to move to where the repository compares
  the member lists it actually writes, so that pinning is no longer needed.

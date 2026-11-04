# Metric hierarchy and metric group membership patches are authorized before they apply, against the state they apply to

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** karanh37
- **Guard:** `MetricResourceTest#metricPatchRejectsOperationsOnTheDocumentRoot`,
  `#metricPatchRejectsReadingARelationIntoAnotherFieldOrATest`,
  `#hierarchyPatchIsAuthorizedOnTheMetricBeforeItIsSimulated`;
  `MetricGroupResourceTest#patchIsAuthorizedOnTheGroupBeforeItIsSimulated`,
  `#patchAddressingMembersRequiresViewOnEveryMember`,
  `#memberPatchReachesTheRepositoryPinnedAndAnsweredWith412OnceMembersShift`;
  `MetricResourceIT#patchCannotCopyAHiddenRelationIntoAReadableField`
- **Related:** open-metadata/OpenMetadata#36909, ADR:2026-11-03-metric-writes-run-the-same-checks-through-rest-and-mcp

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
- A metric PATCH `copy` or `move` whose `from` is the document root, or reads `parent`,
  `metricGroup`, `children` or `relatedMetrics` into a different field, is rejected with 400, and
  so is a `test` of the document root or of those fields. Responses hide the relation references
  the caller may not view, and an operation is authorized by its `path` only. Moves within one
  relation field, such as reordering `relatedMetrics`, pass.
- A metric group PATCH that addresses members (any `path` or `from` that is `""`, `/metrics` or
  below it) requires VIEW_BASIC on every current member. The repository receives it with a leading
  `test` of `/metrics` against the members it was authorized on. If they changed, the request fails
  with 412 and the client retries.
- These checks live in `MetricAuthorization`, so MCP `patch_entity` runs them too
  (ADR:2026-11-03-metric-writes-run-the-same-checks-through-rest-and-mcp). MCP authorizes the
  patch before calling them. The member pin is REST-only: MCP applies the patch itself.

## Consequences
- A refused caller gets 403 where an unapplicable patch used to give 400 or 404.
- Two simultaneous member edits on one group can give one of them a 412.
- Clients must patch named fields of a metric, not replace the whole document, and can't copy a
  relation's value into another field.
- An MCP member patch on a group is not pinned, so two simultaneous index-based member edits
  through MCP can still race.
- To revisit, the per-metric authorization would have to move to where the repository compares
  the member lists it actually writes, so that pinning is no longer needed.

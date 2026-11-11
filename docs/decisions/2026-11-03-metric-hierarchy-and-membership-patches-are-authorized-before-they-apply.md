# Metric hierarchy and metric group membership patches are authorized before they apply, against the state they apply to

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-06 (checks run in the repository before the patch applies; member pin removed)
- **Deciders:** karanh37, Vishnu Jain (v2)
- **Guard:** `MetricResourceTest#hierarchyPatchIsAuthorizedOnTheMetricBeforeItIsSimulated`;
  `MetricRepositoryTest#metricPatchRejectsReadingARelationIntoAnotherFieldOrATest`,
  `#aPatchMayNotSetAssetsChildrenOrChildrenCount`, `#aPatchToChildrenIsRefusedForTheAdminAccountToo`;
  `MetricGroupResourceTest#patchIsAuthorizedOnTheGroupBeforeItIsSimulated`;
  `MetricGroupRepositoryTest#patchAddressingMembersRequiresViewOnEveryMember`,
  `#unapplicablePatchErrorDoesNotQuoteTheGroup`;
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

## Amendment v2: the checks run in the repository before the patch applies

`MetricAuthorization` is removed (ADR:2026-11-03-metric-writes-run-the-same-checks-through-rest-and-mcp
v4), and these checks move to where the write applies the patch.

- `EntityRepository.authorizePatch(original, patch, actor)` runs before a user's patch is applied,
  on the entity as stored with the patch fields: PATCH through REST and MCP `patch_entity`, bulk
  edits, and the patch preview. The publishing of an approved change skips it, as it skips
  `authorizeWrite`. Every other write runs it, so a refusal of the patch itself holds for every
  account, `admin` included, which REST and MCP record as a system actor; only the member view
  check skips a system actor, as `authorizeWrite` does.
- `MetricRepository` refuses there the relation reads and tests above, and a patch to `assets`,
  `children` or `childrenCount`. It no longer refuses the document root itself: every type refuses
  that with a 400 (ADR:2026-11-03-input-parsing-is-bounded).
- `MetricGroupRepository` requires VIEW_BASIC on every member there for a patch that addresses
  them, and answers a patch it can't apply with a message that doesn't quote the group.
- The member pin and its 412 are removed. EditAll on the metrics a patch adds or removes is checked
  in the write against the member lists it stores, which is the condition the v1 "To revisit" note
  gave. REST and MCP member patches now behave the same.
- A refused shape (400) now comes before a refused move (403): the shape checks run before the
  patch is applied, the move check in the write. The 400 depends only on the patch text.

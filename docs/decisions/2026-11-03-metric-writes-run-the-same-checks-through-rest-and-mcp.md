# Metric and metric group writes run the same checks through REST and MCP

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-04 (CSV row and hierarchy authorization)
- **Deciders:** Vishnu Jain
- **Guard:** `McpMetricAuthorizationIT`, `MetricResourceIT#hierarchyWritesRequireEditPermissionOnParentAndGroupDestinations`, `MetricResourceTest#wholeDocumentReplaceCountsAsAHierarchyChange`, `MetricCsvAuthorizationIT`
- **Related:** ADR:2026-10-20-mcp-responses-mask-stored-credentials

## Context

The metric and metric group resources check more than the policy check every entity gets: a
hierarchy or group change needs EditAll on the metrics that move and on the parent or group they
land in, a new metric needs view access to the assets it links, and a metric patch may not set
`assets`, `children` or `childrenCount`. Those checks lived as private methods of the two
resources. The MCP `create_entity` and `patch_entity` tools write through the repository, so they
skipped all of them: a user who could edit one metric could move it under a parent they could not
edit, and a user who could edit a group could add a metric to it that they could not edit.

`patch_entity` refuses types whose resource does extra work (`DEDICATED_PATCH_LIFECYCLES`), but
metrics stay writable through MCP: agents create and edit them, metric variants included.

## Decision

- The checks live in `MetricAuthorization`. The create, PUT and PATCH endpoints of both resources
  and the metric bulk PUT call it, and so do the MCP `create_entity` and `patch_entity` tools.
- MCP calls its type-blind `authorizeCreate` / `authorizePatch` after the generic policy check,
  and they do nothing for other types.
- A whole-document `replace` counts as a hierarchy change, as it can set the parent.
  `JsonUtils.extractPatchedFields` leaves root paths out, so the check asks
  `JsonPatchUtils.replacesWholeDocument` too.
- A patch is checked on a copy loaded with the repository's patch fields, the same fields
  `EntityRepository.patch` applies it to. A copy with fewer fields fails on a patch the
  repository accepts, such as an append to `/owners`.
- A new type whose resource adds checks either gets the same treatment (checks shared, MCP calls
  them) or goes on `DEDICATED_PATCH_LIFECYCLES` / the `create_entity` refusal list.

## Consequences

An MCP write to a metric or group can now be refused where it used to succeed, with the same
403 REST gives. A REST-only check added to either resource is invisible to MCP unless it goes
into `MetricAuthorization`.

Metric CSV import does not run these checks yet: a row can set `parent` or `metricGroup` without
EditAll on them (https://github.com/open-metadata/openmetadata-collate/issues/8228).

## Amendment — v2: CSV rows use the same write authorization

The CSV gap above is closed. Each metric import row is authorized like a direct write of its
target, including EditAll on the moved subtree and on each new parent/metric group destination,
so an import never grants more than PATCH or POST. `EntityCsv` owns the row's CREATE/EDIT_ALL
check; `MetricCsv` adds the hierarchy checks and honors the same admin exemption.

`MetricRepository.hierarchyMembershipChanged` and `hierarchyDestinations` hold the shared
membership comparisons, used by both `MetricAuthorization` and `MetricCsv`. The effective group
inherited from the parent is resolved before these comparisons and destination checks, including
dry runs. A real import persists queued prerequisites before authorizing their stored attributes;
a dry run authorizes successful preceding rows with their in-memory policy attributes. Neither
may treat a queued parent as absent or lose its tags and owners.

Async imports capture impersonation attribution at submission and restore it only while the
worker executes the import, clearing it on success or failure. Impersonation-dependent denies
therefore apply to each row as they do to a synchronous write.

`MetricCsvAuthorizationIT` guards inherited groups, pending-parent tag denies and owner allows,
subtree moves, and async impersonation, in both dry and real imports.

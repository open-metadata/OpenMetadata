# MCP responses leave out a metric group's members, as REST does

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `McpResponseUtilsTest#dropsMetricGroupMembers`
- **Related:** ADR:2026-10-20-mcp-responses-mask-stored-credentials

## Context

REST drops a metric group's `metrics` list from every create, PUT and PATCH response
(`MetricGroupResource.withoutMembers`). Members are listed only through
`/v1/metricGroups/{id}/metrics`, which leaves out the metrics the caller cannot view. MCP
`create_entity` and `patch_entity` returned the whole entity, so a user who could edit a group
read the names of every member, including metrics they were denied.

## Decision

`McpResponseUtils.maskSecrets` drops `metrics` from a metric group. That one hook feeds MCP write
responses, MCP change events and entity reads, so none of them carries the member list.

## Consequences

MCP has no tool that lists a group's members; one that does must apply the members endpoint's
view filter, not read the list off the entity. A field REST strips from a response is stripped in
this same hook for MCP.

# Agent and MCP executions authorize the parent AI application / MCP server as well as their own type

- **Status:** Accepted
- **Revisions:** v1 2026-10-31 (initial)
- **Deciders:** harshach
- **Guard:** `AgentExecutionResourceTest` / `McpExecutionResourceTest` (type-level and parent-denial cases); reviewer
- **Related:** PR #36760; internal authorization finding ANT-2026-1X1E9XGX

## Context

`AgentExecutionResource` and `McpExecutionResource` originally authorized only the
record type on an empty context — no entity, owners, tags or domains — so a policy
denying the AI application or MCP server itself (a domain or tag deny rule) could
never fire on execution reads and writes, and a domain-restricted user could read,
forge and hard-delete another domain's execution records even though the asset
endpoints answered 403 for the same user.

## Decision

Every handler of `/api/v1/agentExecutions` and `/api/v1/mcpExecutions` authorizes
both the execution type and the parent asset:

- Reads need `ViewBasic` on the type and on the parent `aiApplication` /
  `mcpServer`; writes and deletes need the type operation (`Create` / `Delete`)
  plus `EditAll` on the parent, because the two entity types declare no finer
  operation. The by-id read loads the record first, so an unknown id answers 404
  before any authorization runs.
- Listings pre-authorize a requested `agentId` / `serverId` and always post-filter
  the page through `ViewPermissionFilter`: a record is listed only if its parent
  is viewable, dropping records whose parent no longer resolves — for every
  caller, admins included.
- `EditAll` on the parent replaces the previous allow-all reach of
  `DomainOnlyAccessPolicy`-style rules: a role granting only `Create` on the
  execution type no longer suffices to write records.

## Consequences

A filtered page can be shorter than `limit` while `paging.total` still counts the
hidden records — the post-filter trade-off `ActivityResource` accepts — because
tag-deny decisions cannot be expressed in the listing query; revisit requires an
authorization-aware query path, not just a SQL filter. Custom roles that granted
only `Create` on the execution types must grant `EditAll` on the parent assets.

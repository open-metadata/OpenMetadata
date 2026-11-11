# MCP read-only mode hides every tool not annotated readOnlyHint, for every caller including admins

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial) · v2 2026-11-05 (single tools can be disabled) · v3 2026-11-06 (tools/list follows the setting without a restart)
- **Deciders:** Vishnu Jain
- **Guard:** `McpReadOnlyModeTest`
- **Related:** #36577, #33323, #36579

## Context

Some deployments want AI clients kept read-only whatever the signed-in user may do in the UI. A
Deny rule with `impersonatedBy('McpApplicationBot')` covers ordinary users, but admins skip policy
evaluation entirely, and a denied tool is still listed, so the agent keeps calling it.

## Decision

- `readOnly` in `mcpConfiguration` (default `false`). When `true`, only tools whose `readOnlyHint`
  annotation is `true` are available. A tool without the annotation counts as a write tool,
  matching the MCP spec default. `describe_entity_type` is withheld too: it only reads, but it
  exists to prepare a `create_entity` call.
- One rule, applied in two places in `McpServer`, both after a subclass has added its own tools in
  `getTools()`: registration at startup leaves the other tools out of `tools/list`, and
  `executeTool` refuses them on every call with a 403. Tools are registered once, so the call-time
  check is what makes turning the mode on block writes before a restart; each server reads the
  setting as it reloads it. Turning it off brings write tools back only after a restart.
- It applies to every caller, admins included. The user's normal authorization still applies to
  the tools that remain.

## Consequences

A new write tool must carry `readOnlyHint: false` (or no annotation) to stay hidden; marking a write
tool `readOnlyHint: true` exposes it in read-only mode. A per-tool allowlist was considered and left
out: nobody asked to hide individual read tools, and a name list goes stale on upgrade. Updating
`tools/list` without a restart would mean re-registering tools on a config change on every server.

## Amendment

**v2 2026-11-05.** Admins asked to turn off single tools (#37161), so the per-tool list left out above now
exists as a denylist of tool names, applied the same two ways. See
ADR:2026-11-05-mcp-admins-can-disable-single-tools. Read-only mode is unchanged.

**v3 2026-11-06.** MCP Java SDK 2.x filters `tools/list` per request (#37248), so every tool is now
registered at startup and a filter hides the refused ones from the setting as it is at that moment.
Turning the mode on or off changes `tools/list` without a restart, on each server as it reloads the
setting. A stateless server cannot send `notifications/tools/list_changed`, so it advertises
`listChanged: false`, and a client that cached the list sees the change when it lists tools again;
until then the 403 on every call, unchanged, is what stops a cached write tool. This removes the
restart in the Decision and the re-registration cost named in Consequences.

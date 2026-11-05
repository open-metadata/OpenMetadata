# MCP read-only mode hides every tool not annotated readOnlyHint, for every caller including admins

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
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

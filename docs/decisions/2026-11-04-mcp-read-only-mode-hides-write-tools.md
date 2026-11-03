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

- `readOnly` in `mcpConfiguration` (default `false`). When `true`, the server registers only tools
  whose `readOnlyHint` annotation is `true`. A tool without the annotation counts as a write tool,
  matching the MCP spec default.
- The filter runs once in `McpServer.initializeMcpServer`, after `getTools()`, so tools a subclass
  adds are covered too. There is no second check at call time: the SDK answers a call to an
  unregistered tool with `-32602 Unknown tool`.
- It applies to every caller, admins included. The user's normal authorization still applies to
  the tools that remain.
- Read once at startup, so a change applies after a restart.

## Consequences

A new write tool must carry `readOnlyHint: false` (or no annotation) to stay hidden; marking a write
tool `readOnlyHint: true` exposes it in read-only mode. A per-tool allowlist was considered and left
out: nobody asked to hide individual read tools, and a name list goes stale on upgrade. Applying a
saved change without a restart would mean re-registering tools on a config change on every server
in a cluster.

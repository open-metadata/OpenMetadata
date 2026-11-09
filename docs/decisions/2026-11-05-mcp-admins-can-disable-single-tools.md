# MCP admins can disable single tools by name, for every caller including admins

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `McpReadOnlyModeTest`
- **Related:** #37161, ADR:2026-11-04-mcp-read-only-mode-hides-write-tools

## Context

Read-only mode hides every write tool at once. Admins also asked to turn off single tools, read or
write, whatever the user's permissions, and to do it from the MCP Server settings.

## Decision

- `disabledTools` in `mcpConfiguration`: a set of tool names, default empty. It is a denylist, so a
  tool added on upgrade is on until an admin disables it.
- It is applied exactly like read-only mode, in the same two places in `McpServer`: left out of
  `tools/list` at startup, and refused with a 403 on every call. A disabled tool is refused right
  away; the list changes, and enabling it again applies, after a restart. When both apply, the
  read-only message wins.
- A name that matches no registered tool is ignored with a startup warning, not rejected on save:
  it may belong to another distribution or to a tool renamed on upgrade.
- The settings form offers the tools the server registered, served by `GET /system/mcp/tools`
  (admin only), not a list in the form schema: distributions add their own tools, and a hardcoded
  list goes stale.

## Consequences

Renaming a tool silently re-enables it on servers that disabled the old name, so a rename should say
so in the release notes. There is no allowlist: a deployment that wants only a few tools disables the
rest and revisits the list on upgrade.

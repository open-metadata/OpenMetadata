# MCP turns off at request time, when its app is disabled or its setting is off

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `McpAvailabilityIT`
- **Related:** #37687, #29201, #30041

## Context

MCP routes are mounted once at startup, so nothing an admin did turned them off without a restart.
Disable on the MCP Server app page soft-deletes the app, and Uninstall removes it, but the routes
kept answering, and an uninstalled app is re-seeded at the next start. Setting
`mcpConfiguration.enabled` to `false` also did nothing until every server restarted.

## Decision

- MCP answers only while `mcpConfiguration.enabled` is `true` and the `McpApplication` app exists
  and is not soft-deleted. This is checked on every request; otherwise the answer is 404.
- `McpAvailabilityFilter` checks it on `/mcp/*`, also on FORWARD, because `/callback` forwards MCP
  logins to `/mcp/callback`. `OAuthWellKnownFilter` checks it on the discovery paths it serves, so
  the two filters do not depend on their registration order. The SAML login hook is not under
  `/mcp/`, so it checks it too.
- MCP usage recording reads the app from the repository, not from `ApplicationContext`. Disable
  runs `uninstall()`, which takes the app out of the context of the server that handled it, and
  Enable never puts it back, so a context lookup fails on that server until it restarts.
- Both values are read through existing caches: the server that took the change answers 404 at
  once, and other servers follow when their entry expires (30 seconds for the app, 3 minutes for
  the setting).

## Consequences

Disable stops MCP and Enable brings it back, with no restart. Uninstall stops MCP until the next
start re-seeds the app. A refusal is a bare 404 status, not `sendError`, because the server maps
404 errors to the UI page. A deployment that disabled the app but kept using MCP, which worked
while the app state was ignored, loses MCP on upgrade until the app is enabled. A new MCP route
must sit under `/mcp/` or check `McpAvailabilityFilter.isMcpAvailable()` itself, or it keeps
answering while MCP is off. A server that started with MCP off only answers once it restarts with
it on, unless its startup gate mounts MCP regardless.

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
- MCP usage recording and the `/v1/mcp/usage` endpoints read the app from the repository, not
  from `ApplicationContext`. Disable runs `uninstall()`, which takes the app out of the context of
  the server that handled it, and Enable never puts it back, so a context lookup fails on that
  server until something reads the app through the apps API or the server restarts.
- The setting is read from `SecurityConfigurationManager`, in memory: the server that saved it
  follows at once, other servers when the settings watcher picks the change up
  (`watchIntervalSeconds`, 10 by default). `SettingsCache` was not used because it does not cache
  a missing value, so an install that never saved the setting would query on every request.
- The app is read through the entity cache: the server that took the click follows at once,
  other servers when their entry expires (30 seconds by default).

## Consequences

Disable stops MCP and Enable brings it back, with no restart. Uninstall stops MCP until the next
start re-seeds the app; until then each refused request runs one indexed lookup, because a
missing app is not cached for `Include.ALL`. A refusal is a bare 404 status, not `sendError`, because the server maps
404 errors to the UI page. A deployment that disabled the app but kept using MCP, which worked
while the app state was ignored, loses MCP on upgrade until the app is enabled. A new MCP route
must sit under `/mcp/` or check `McpAvailabilityFilter.isMcpAvailable()` itself, or it keeps
answering while MCP is off. A server that started with MCP off only answers once it restarts with
it on, unless its startup gate mounts MCP regardless.

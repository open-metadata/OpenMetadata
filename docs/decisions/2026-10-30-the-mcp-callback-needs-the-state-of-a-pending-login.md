# The MCP callback needs the state of a pending login

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `McpCallbackServletTest` (`doGet_idTokenWithoutState_returns400AndIssuesNoCode`)
- **Related:** #29228, #36655, ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip

## Context

`/mcp/callback` had a second way in besides the authorization-code callback: an ID token sent as
`?id_token=` with no `state`, or posted by a small page that read it from the URL fragment. It was
added (#29228) for a login shortcut that returned the ID token straight to the client. That shortcut
is gone: `AuthenticationCodeFlowHandler.handleLogin` now always sends the browser to the provider
with a `state` and `response_mode=query`. A login comes back to `/mcp/callback` without one only
when its pending request has expired (10 minutes), and that login has to be restarted.

## Decision

- `GET /mcp/callback` without a `state` answers 400 `Invalid MCP OAuth callback - missing state`.
- `POST /mcp/callback` is not handled (405), and the URL-fragment page is removed.
- The signed-in user of an MCP OIDC login comes only from `handleCallback`, as for the web login.

## Consequences

- A provider set up to return the ID token in the URL fragment cannot complete an MCP login; it
  needs the authorization-code flow, as the web login does.
- Adding a second callback path again means repeating every check `handleCallback` makes.

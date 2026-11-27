# The MCP callback needs the state of a pending login

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial) · v2 2026-11-25 (public OIDC clients)
- **Deciders:** Vishnu Jain
- **Guard:** `McpCallbackServletTest` (`doGet_idTokenWithoutState_returns400AndIssuesNoCode`)
- **Related:** #29228, #36655, #38480, ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip

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

## Amendment — public OIDC clients

For a public OIDC client, MCP uses the top-level client ID and discovers the provider at
`<authority>/.well-known/openid-configuration`. For Azure, the authority gains `/v2.0` if needed.
The public flow derives its own settings independently of the confidential `oidcConfiguration`.
The MCP base URL comes from the MCP settings, falling back to the system OpenMetadata URL.

If initial discovery fails, the public MCP handler waits one minute before trying again for the
same configuration. After the first success, the handler checks for endpoint changes on demand,
at most once per minute. If a refresh fails, sign-ins that need discovery receive that failure until
the next attempt. This bounds traffic during an outage. The issuer must match the initial document.
A provider can rotate endpoints while keeping that issuer. To switch issuers, reload the provider
configuration. For discovery, token exchanges and signing-key downloads, the server checks the
outbound URL before connecting and disables HTTP redirects. `PublicOidcConfigurationTest` covers
endpoint rotation, refusal of a changed issuer, recovery and redirect handling.

Register `<external MCP base URL>/mcp/callback` at the identity provider
for a server-side authorization-code exchange using the public client ID and S256 PKCE. Include
the deployment base path, if configured. OpenMetadata sends this same URI when it requests and
redeems the code. The browser application retains its own registered redirect. MCP requires a pending
login and asks for consent before issuing a grant.

A Microsoft Entra redirect registered as a single-page application requires a browser origin
during redemption. Keep the browser redirect registered for the SPA and configure the MCP redirect
for server-side redemption under the same public client ID. A browser-only registration
fails before consent. [Microsoft Entra authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow#redirect-uris-for-single-page-apps)

`SsoMcpSignInChecksIT` exercises the provider exchange, the agent's first tool call and refusal
by a browser-only provider registration.

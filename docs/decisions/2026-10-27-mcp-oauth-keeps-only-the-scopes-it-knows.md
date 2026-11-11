# MCP OAuth keeps only the scopes it knows

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Vishnu Jain, Pere Miquel Brull
- **Guard:** `OAuthClientMetadataTest` (`testValidateScope_noKnownScopeGetsTheDefaults`,
  `testValidateScope_repeatedScopesAreKeptOnce`), `UserSSOOAuthProviderTest`
  (`exchangeRefreshToken_aGrantHoldingUnknownScopes_stillRefreshes`), `McpOAuthIT`
  (`testRefreshOfAGrantHoldingUnknownScopes_keepsOnlyTheKnownOnes`)

## Context

A client that registered no scopes was granted whatever `/mcp/authorize` asked for, repeats
included. The granted list is stored with the code and refresh token, and every refresh compared
the requested and granted lists with `List.containsAll`, so a long list made each refresh cost
seconds of CPU for as long as the token lived. No permission check reads a token's scopes: what a
token can do comes from its user's roles. The OAuth metadata advertises at most `openid`,
`profile`, `email` and `offline_access`.

## Decision

- Authorization and refresh keep only the scopes the server knows
  (`OAuthClientMetadata.KNOWN_SCOPES`, every scope the metadata can advertise), each once, and drop
  the rest. OAuth lets a server ignore requested scopes (RFC 6749 §3.3); the token response names
  the scopes granted.
- A request that names no known scope, such as `scope=*`, gets the default scopes, so it still
  signs in.
- A client that registered its own scopes is still refused a scope it did not register.
- A stored refresh token granted a long list is filtered on its next refresh, so it needs no new
  sign-in.
- Refusing requests over a fixed count (128) was considered and dropped: it rejects clients whose
  setup is otherwise correct, and still keeps up to that many useless scopes.

## Consequences

- A new scope must be added to `KNOWN_SCOPES` as well as to the advertised metadata, or it is
  dropped.
- Clients only see known scopes echoed back.

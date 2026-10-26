# MCP OAuth authorization and refresh requests name at most 128 scopes

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `OAuthClientMetadataTest` (`testValidateScope_moreScopesThanTheLimitThrows`),
  `UserSSOOAuthProviderTest` (`exchangeRefreshToken_moreScopesThanTheLimit_isRefusedBeforeAnyLookup`,
  `exchangeRefreshToken_aGrantHoldingMoreScopesThanTheLimit_mustSignInAgain`)

## Context

A client that registered no scopes is granted whatever `/mcp/authorize` asked for, repeats
included, and `/mcp/authorize` also takes a form POST, so the list was bounded only by Jetty's
200 000-byte form limit. That list is stored with the code and the refresh token, put in the JWT,
and compared with the scopes of every refresh request. The comparison was `List.containsAll`, so
its cost grew with the product of both lists.

## Decision

- `OAuthClientMetadata.validateScope` refuses a request naming more than
  `MAX_REQUESTED_SCOPES` (128) scopes with `invalid_scope`; every `/mcp/authorize` goes through it.
- `exchangeRefreshToken` refuses a `scope` parameter with more than 128 entries before looking the
  token up, and compares the scopes through a `HashSet`, so a token granted a long list before this
  change costs linear time.
- A refresh token granted more than 128 scopes before this change is refused with `invalid_grant`,
  so its client signs in again instead of carrying the list forward on every rotation.
- 128 is the most a registration can name in its 255-character `scope` field.

## Consequences

- A client naming more than 128 scopes in one request gets `invalid_scope`. Scope names are not
  checked against `scopes_supported`; that would be stricter but refuses clients accepted today.
- Raising the limit means checking that the stored, JWT and comparison costs still stay bounded.

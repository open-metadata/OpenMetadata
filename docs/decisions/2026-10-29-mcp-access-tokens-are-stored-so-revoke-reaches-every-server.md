# MCP access tokens are stored, so a revoke reaches every server

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `JwtFilterTest` (`mcpAccessTokenNoLongerStoredIsRejected`,
  `mcpAccessTokenStillStoredIsAccepted`, `providerTokenWithAClientIdIsNotLookedUp`),
  `OAuthTokenRepositoryTest` (`accessTokenIsRevokedOnlyForTheClientItWasIssuedTo`),
  `RevocationHandlerTest` (`accessTokenWithoutTypeHintIsRevokedWhenNoRefreshTokenMatches`)
- **Related:** ADR:2026-10-26-an-mcp-oauth-grant-ends-30-days-after-sign-in

## Context

An MCP OAuth access token is a signed `OM_USER` JWT that lives 10 minutes. Revoking one had
nothing to act on: `oauth_access_tokens` existed, but nothing wrote to it. An in-memory denylist
was considered and rejected: it holds on one server only, is lost on restart, and a JWT's
signature text is not a canonical encoding, so a string key does not identify a token reliably.

## Decision

- Issuing an MCP access token adds a `client_id` claim (RFC 9068) and stores the token's SHA-256
  hash in `oauth_access_tokens`, with its client and expiry.
- `JwtFilter` refuses an OpenMetadata-signed token that carries `client_id` and is not stored.
  Only a token signed with our key is looked up: an identity provider's token may carry its own
  `client_id`.
- `/mcp/revoke` deletes a stored token or revokes a refresh token only when the row names the
  authenticated client (RFC 7009 section 2.1). A token issued to another client is left alone and
  answered 200, like an unknown one, so the answer never tells a client that the token exists.

## Consequences

- A revoked access token is refused on every server, on `/mcp` and on the REST API, from the next
  request, and the revoke survives a restart. Deleting an OAuth client deletes its access tokens
  (foreign key cascade).
- Each request carrying an MCP access token costs one indexed read. `OAuthTokenCleanupJob` already
  deletes expired rows.
- A token is accepted only as the exact string that was issued and stored.
- Tokens issued before this change carry no `client_id` and are not looked up; they expire within
  10 minutes of the upgrade.
- Revoking a refresh token still leaves the access tokens it minted valid until they expire. The
  stored client and user would make deleting them a small change.

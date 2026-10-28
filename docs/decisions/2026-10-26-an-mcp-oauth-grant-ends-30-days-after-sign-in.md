# An MCP OAuth grant ends 30 days after sign-in; refreshing does not extend it

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `UserSSOOAuthProviderTest` (`exchangeRefreshToken_rotationKeepsTheEndOfTheGrant`,
  `exchangeRefreshToken_afterTheEndOfTheGrant_mustSignInAgain`)

## Context

`exchangeRefreshToken` rotates the refresh token on every use. It gave the new token a fresh
30-day expiry, so a client that refreshed at least once a month kept one sign-in working forever
and was never sent back to the identity provider. Web sessions already work the other way: their
`expiresAt` never moves on refresh (`SessionService`), so only a new sign-in starts a new lifetime.

## Decision

- A rotated MCP refresh token keeps the `expiresAt` of the token it replaces. The grant ends 30
  days after the sign-in that created it (`REFRESH_TOKEN_EXPIRY_DAYS`), however often it is used.
- The lifetime stays the 30-day constant. Tying it to `sessionExpiry` (7 days) would bring MCP in
  line with web sessions but make every MCP client sign in again weekly; not chosen.

## Consequences

- Every MCP client signs in again at most every 30 days. A refresh close to that end returns a
  refresh token with little time left, so a client must handle `invalid_grant` by signing in.
- A user disabled at the identity provider can still refresh until those 30 days are over;
  deleting the user in OpenMetadata ends the grant at the next refresh. Checking the identity
  provider on refresh, or letting admins list and revoke MCP grants, would close that and needs
  its own change.

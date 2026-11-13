# Logout retires the token that signed the request, in a bounded cache of digests

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `JwtTokenCacheManagerTest`,
  `UserResourceIT.test_logout_endsTheTokenThatSignedTheRequestNotTheBodyToken`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Logout puts a token on a server-side list of retired tokens until it expires. The token to retire
is the one the request was authenticated with, which `JwtFilter` has verified. The list lives in
memory, so it holds digests rather than tokens, under a size cap.

## Decision
- Logout retires the bearer token `JwtFilter` verified for the request. The body's `token` is
  ignored; clients that send the bearer token there too keep working.
- An entry's key is the SHA-256 of the token's signed part (`TokenDigest`), and its value is the
  user and the logout time. It lives until the token expires.
- A token without `exp` is not cached: it never expires, so it is revoked through its own credential
  (bot token, personal access token) instead.
- The cache holds at most 100 000 entries (`JwtTokenCacheManager.MAX_ENTRIES`). When full, it drops
  the entry that expires first.

## Consequences
A logout only reaches the caller's own token. 100 000 entries fit a busy deployment's logouts within
one access-token lifetime (one hour by default) in a few megabytes. Filling it takes that many
sign-ins and logouts within that lifetime, and the first entries to go are the ones closest to
expiring anyway.

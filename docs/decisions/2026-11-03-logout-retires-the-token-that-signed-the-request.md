# Logout retires the token that signed the request, in a bounded cache of digests

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `JwtTokenCacheManagerTest`,
  `UserResourceIT.test_logout_endsTheTokenThatSignedTheRequestNotTheBodyToken`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`POST /api/v1/users/logout` added the `token` field of its body to the logout cache, whatever it was,
and the cache took each entry's lifetime from that token's own `exp` claim. The cache held at most
1000 entries and kept the whole token as its value.

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

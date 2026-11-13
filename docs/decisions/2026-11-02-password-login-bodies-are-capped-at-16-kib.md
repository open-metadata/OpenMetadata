# Password-login request bodies on /api/v1/auth/login are capped at 16 KiB and a larger body is answered 400 before it is parsed

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `BasicAuthServletHandlerTest#handleLogin_oversizedBody_returnsBadRequestWithoutAuthenticating`, `LdapAuthServletHandlerTest#handleLogin_oversizedBody_returnsBadRequestWithoutAuthenticating`, `LoginLockoutIT#aLoginBodyOverTheLimitIsRefusedBeforeItIsRead`
- **Related:** ADR:2026-10-31-column-csv-import-bounds

## Context

`POST /api/v1/auth/login` needs no credentials. The basic and LDAP servlet handlers each read the
whole body into a string before parsing it, so an anonymous caller chose how much the server held
in memory per request, and the server inflates gzip request bodies, so a small request on the wire
could still be large in memory.

## Decision

- Both handlers read the body through `SecurityUtil.parseLoginRequest`, which reads at most
  `MAX_LOGIN_BODY_BYTES` (16 KiB) plus one byte of the inflated stream.
- A longer body is answered 400 "Invalid login request", the answer a malformed login already
  gets, and the authenticator is never called, so it does not count as a failed attempt.
- 16 KiB is far above a real login (an email and a Base64 password, well under 1 KiB) and small
  enough that many concurrent requests stay cheap.

## Consequences

A client that pads a login body past 16 KiB is refused. The JAX-RS password endpoints
(`/api/v1/users/login`, signup, password reset, refresh) still read their bodies without this
limit and are not covered yet.

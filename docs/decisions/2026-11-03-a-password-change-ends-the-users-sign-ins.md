# A password change ends the user's sign-ins and keeps personal access tokens

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial); v2 2026-11-04 (a refresh token is replaced in one
  statement)
- **Deciders:** Mohit Yadav
- **Guard:** `PasswordChangeIT`, `RefreshTokenRotationTest`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
With basic authentication, a user's sign-ins (refresh tokens, server sessions, MCP grants) all
start from the password, so they last only as long as it does. A new password ends them, whichever
path sets it.

## Decision
After a new password is stored, by a reset link, by the user, by an admin, or by the `reset-password`
ops command, `UserRepository.endSignIns` runs:
- the user's refresh tokens are deleted;
- the user's live sessions are revoked;
- the user's MCP grants, authorization codes and waiting consents end.

Personal access tokens and bot tokens stay. They are credentials of their own, revoked through
their own endpoints.

A refresh replaces its refresh token with the new one in a single `UPDATE` keyed by the old token,
for basic and LDAP sign-ins alike. Only the request whose update changed the row gets new tokens,
so a refresh token is used once, and a refresh whose token was deleted while the request ran, as
`endSignIns` deletes it, issues nothing.

## Consequences
A user who changes their own password signs in again everywhere, including the browser that made the
change. A sessionless access token already issued stays valid until it expires, one hour by default.
The ops command reaches sessions stored in the database; sessions kept in Redis expire on their own.

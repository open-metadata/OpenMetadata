# A password change ends the user's sign-ins and keeps personal access tokens

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `PasswordChangeIT`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Basic authentication stored a new password hash and left everything signed in with the old one in
place: refresh tokens kept minting access tokens, server sessions stayed active, and MCP grants
stayed valid.

## Decision
After a new password is stored, by a reset link, by the user, by an admin, or by the `reset-password`
ops command, `UserRepository.endSignIns` runs:
- the user's refresh tokens are deleted;
- the user's live sessions are revoked;
- the user's MCP grants, authorization codes and waiting consents end.

Personal access tokens and bot tokens stay. They are credentials of their own, revoked through
their own endpoints.

## Consequences
A user who changes their own password signs in again everywhere, including the browser that made the
change. A sessionless access token already issued stays valid until it expires, one hour by default.
The ops command reaches sessions stored in the database; sessions kept in Redis expire on their own.

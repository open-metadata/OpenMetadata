# Basic-auth failed logins count against the stored password, not the account

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `LoginLockoutIT`, `BasicAuthenticatorFailedLoginKeyTest`
- **Related:** open-metadata/openmetadata-collate#4719

## Context

`LoginAttemptCache` blocks an account for `accessBlockTime` after `maxLoginFailAttempts` failed
logins, and its counters live in each server's memory. A password change has to lift that block:
the user who asks an admin for a reset has usually locked the account first. But a reset is served
by one server, or made by `openmetadata-ops reset-password` in its own process, so clearing a
counter when the password changes cannot reach the servers that answer the next login. The new
password was refused until the block expired (collate#4719).

## Decision

For basic auth, a failed login counts under the account's email plus a SHA-256 digest of the stored
password hash (`BasicAuthenticator.failedLoginKey`). Every login reads the hash from the database,
so a new password, set by any path, starts with no failures on every server. A correct password
clears the failures counted against it, so the lockout counts consecutive failures.

The checks by address alone, which the MCP login form calls (`checkIfLoginBlocked(email)`,
`recordFailedLoginAttempt(email, …)`), load the account first and use the same key. LDAP still
counts by email: its passwords live in the directory, out of OpenMetadata's sight.

## Consequences

- No password-changing path has to clear the lockout, and lifting it needs no shared store or
  cross-server message.
- The basic login looks the account up before the lockout check: one indexed read, still ahead of
  the BCrypt comparison.
- Calling `LoginAttemptCache` with a bare email does not touch a basic-auth account's failures; go
  through `BasicAuthenticator`.
- Counters stay per server, so each server allows `maxLoginFailAttempts` tries per window. A
  cluster-wide limit would need a shared store.

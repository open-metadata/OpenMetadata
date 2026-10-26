# Stored tokens are checked by a per-server verifier that confirms them against the database

- **Status:** Accepted
- **Revisions:** v1 2026-10-25 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `CredentialVerifierTest`, `OmCredentialTest`, `JwtFilterTest`,
  `MintedTokensAreRecognizedTest`; `CredentialRevocationTwoProcessIT`, `CredentialDatabaseOutageIT`
- **Related:** ADR:2026-10-14-cache-misses-that-do-io-load-outside-the-cache-lock

## Context
Bot JWTs and personal access tokens are the OpenMetadata-signed tokens with a server-side current
value: the bot's stored authentication mechanism and the `user_tokens` rows. Each request checked
that value with a Redis read when Redis was configured, and against a snapshot in local memory
otherwise. The check needed one behavior in every deployment mode, no network I/O on the request
path, and a freshness bound that holds for every writer, including the ops CLI and direct SQL.

## Decision
- Each server runs one `CredentialVerifier`. It keeps, per principal, SHA-256 digests of the tokens
  the database stores for that principal, stamped with the time the read was sent. A check is
  answered from memory while the stamp is within `maxStaleness` (5 s by default), and reads the
  database otherwise. No answer rests on a read older than `maxStaleness`.
- A sweep every 2 s fingerprints each cached principal's rows and re-reads the ones that changed.
  Servers converge on database state and share no credential state, so every committed write is
  seen, whoever made it.
- Every entry point (`JwtFilter.filter`, the WebSocket handshake, the MCP transport and its tool and
  prompt callbacks) goes through `JwtFilter.authenticate`, which classifies the token with
  `OmCredential.classify` and calls `require`. An OpenMetadata-signed claim combination that matches
  no issued kind is rejected. The probes that grant no access call `verifySignatureOnly`.
- When the verifier cannot confirm within `loadTimeout` (2 s), the request gets 503 with
  `Retry-After` (the sweep interval, rounded up), and an MCP tool or prompt call gets JSON-RPC
  error -32003. It never gets 401, and it is never accepted unconfirmed.
- Redis is an accelerator only. A write publishes a nudge so that peers re-read at once. No request
  makes a Redis round trip, and without Redis every server still converges within `maxStaleness`.
- Correctness asks nothing of writers, since the sweep sees every committed change. The
  repositories still call `Credentials.changed` after commit, which gives the writing server
  read-your-writes.

## Consequences
- While any principal is cached, each server sends one fingerprint statement per 500 cached
  principals every 2 s, whether or not requests arrive. The load scales with cached principals
  (4000 at most), not with request rate.
- While the database is unreachable, bot and PAT requests answer 503 once their entries are older
  than `maxStaleness`. Session and identity-provider tokens are not affected.
- Operators alert when `om.credential.sweep.last.complete.age.seconds` exceeds `maxStaleness`, and
  watch `om.credential.unavailable`.
- Rejected alternatives:
  - a change-log table read through per-server cursors, because every writer must emit and the ops
    CLI and direct SQL emit nothing;
  - a commit-ordered epoch row, because it serializes every credential write across the cluster;
  - database triggers, because managed MySQL with binary logging often refuses `CREATE TRIGGER`;
  - Redis as a required shared store, because it puts a network round trip on every request;
  - a plain 5 s TTL cache, because it puts steady-state reads on request threads (the verifier
    falls back to it when the sweep stops);
  - a full in-memory replica of every digest, because its memory grows with the data;
  - a synchronous barrier on revoke, because it needs a membership protocol.

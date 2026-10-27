# Stored tokens are checked by a per-server verifier that confirms them against the database

- **Status:** Accepted
- **Revisions:** v1 2026-10-25 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `CredentialVerifierTest`, `CredentialsTest`, `OmCredentialTest`, `JwtFilterTest`,
  `MintedTokensAreRecognizedTest`; `CredentialRevocationTwoProcessIT`, `CredentialDatabaseOutageIT`,
  `RevokeWaitForPropagationIT`, `UserResourceIT`
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
- Every entry point that grants access classifies the token with `OmCredential.classify` and calls
  `CredentialVerifier.require`, through `JwtFilter.requireCurrentCredential`. Which method each
  entry point calls:
  - `JwtFilter.filter` (REST) calls `authenticate`.
  - `JwtFilter.getCatalogSecurityContext` calls `authenticate`. The MCP tool callbacks
    (`McpServer.executeTool`) and prompt callbacks (`DefaultPromptsContext.callPrompt`) use it.
  - `JwtFilter.validateJwtAndGetClaims` calls `requireCurrentCredential` directly and resolves the
    principal only for a stored kind. `SocketAddressFilter.validatePrefixedTokenRequest` calls it,
    for the WebSocket handshake and for the MCP HTTP transport.
  - `JwtFilter.verifySignatureOnly` classifies nothing and calls no `require`. The probes that grant
    no access use it (`BotTokenCheck`, `TestLoginService`, `SystemRepository`).

  An OpenMetadata-signed claim combination that matches no issued kind is rejected as unrecognized.
  So is a token that OpenMetadata's key did not sign and that claims `isBot=true` or
  `tokenType=PERSONAL_ACCESS`. Such a token has no stored value to confirm and matches no issued
  kind.
- A principal whose latest check read produced no record, because the read failed, got no slot or
  left the principal out, is not read again on a check's behalf for `missRefreshMinAge` (500 ms by
  default, less than `maxStaleness`). Its checks that need a read answer 503 without one in that
  window. A token that a fresh entry lacks triggers a read only when the entry's last full read is
  older than `missRefreshMinAge`, and the check rejects it otherwise. So a principal's unknown or
  failing tokens cost at most about two reads per second per server.
- Check reads run on a pool of `min(maxConcurrentRequestReads, databasePool / 2)` platform threads
  (16 by default, at least 1), so they cannot fill a small database pool. A request thread waits for
  its read within `loadTimeout`. The pool queues 16 reads per thread (`QUEUED_READS_PER_THREAD`, a
  constant, not a setting) and sheds the rest, which answer 503 (`NO_PERMIT`).
- An entry leaves the cache after `idleExpiry` (15 min by default) without a check. A sweep or a
  re-read does not extend it. Every `deepVerifyInterval` (10 min by default) the sweep re-reads the
  cached principals in full with every decrypt forced, which sees edits that fingerprints cannot,
  such as a secret changed inside an external secrets manager. Only the sweep thread, which also
  runs the deep pass, reuses a decrypted digest for an unchanged stored mechanism, and it reuses
  none for a principal the deep pass could not convert. Check and refresh reads decrypt, so no read
  replaces a deep pass's result with a digest decrypted before that pass began, and a check read of
  a bot whose secret lives in an external secrets manager makes one call to it. A principal the
  deep read cannot convert is unconfirmed from that read on. Its next check reads it again and
  answers 503 until a read converts it, and no sweep confirms it by fingerprint. A deep pass is
  retried after `min(deepVerifyInterval, 1 min)` only when one of its reads throws, and a read that
  throws changes no entry.
- When the verifier cannot confirm within `loadTimeout` (2 s), the request gets 503 with
  `Retry-After` (the sweep interval, rounded up), and an MCP tool or prompt call gets JSON-RPC
  error -32003. It never gets 401, and it is never accepted unconfirmed.
- Redis is an accelerator only. A write publishes a nudge so that peers re-read at once. No request
  makes a Redis round trip, and without Redis every server still converges within `maxStaleness`.
- Correctness asks nothing of writers, since the sweep sees every committed change. The
  repositories still call `Credentials.changed` after commit, which gives the writing server
  read-your-writes.
- `PUT /v1/users/revokeToken` and `PUT /v1/users/security/token/revoke` take `waitForPropagation`,
  `false` by default. With `true`, the call responds after the write has committed and
  `maxStaleness` plus 50 ms has passed on the monotonic clock. The wait is a time bound and needs no
  membership. At most 8 such waits run at once in a process, taken with `tryAcquire` before the wait
  begins, so they cannot hold every request slot; the limit is a constant, not a setting. When the
  wait cannot finish, because no verifier is installed, no permit is free or the call is
  interrupted, the call answers 503 with `Retry-After`. `REVIEW.md` asks that an
  `InterruptedException` never map to a retryable status. Here the write has committed, both
  endpoints converge on a repeat, and a repeat waits again, so the 503 is a request to repeat the
  call and not an unfinished operation. The wait uses the receiving server's `maxStaleness`, so it
  covers every server only when all of them run the same `credentialVerification` settings. While a
  change to `maxStaleness` rolls out, it covers only the servers whose `maxStaleness` is no larger
  than the receiving server's. A cluster-wide bound would need each server to know its peers'
  settings, which needs the membership that the wait avoids.

## Consequences
- While any principal is cached, each server sends one fingerprint statement per 500 cached
  principals every 2 s, whether or not requests arrive. The load scales with cached principals
  (4000 at most), not with request rate.
- While the database is unreachable, bot and PAT requests answer 503 once their entries are older
  than `maxStaleness`. Session tokens and identity-provider tokens that claim neither `isBot=true`
  nor `tokenType=PERSONAL_ACCESS` are not affected.
- While the secrets manager cannot decrypt a bot's secret, the bot's requests answer 503 from the
  next deep pass on, so within `deepVerifyInterval`, until a read decrypts the secret again. Its
  failing reads are limited as above, to about two per second per server.
- Operators alert when `om.credential.sweep.last.complete.age.seconds` (Prometheus name
  `om_credential_sweep_last_complete_age_seconds`) exceeds `maxStaleness`, and watch
  `om.credential.unavailable`. The gauge is the age of the last sweep that re-confirmed every
  batch. A batch fails when one of its statements fails, or when converting one of its principals
  throws an `Error`. Past `maxStaleness`, the entries of the batches that failed are too old to
  answer from, so their checks read the database on the request-read pool, wait for it up to
  `loadTimeout`, and answer 503 when that read fails or does not finish. A principal whose stored
  credentials fail to convert with an exception does not hold the gauge back. Its checks count
  under `om.credential.unavailable` with `cause=subject_read_failed`, and those that arrive while
  its reads back off with `cause=backoff`. `/healthcheck` stays a liveness check and does not
  report this.
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
- The intended next step is to store a SHA-256 digest beside each personal access token and each
  bot token, and to check against the digest. The sweep would then read digests from one index,
  with no JSON parsing and no decrypt, and the deep verify would go away. A secret edited directly
  in the secrets manager would then no longer change which token is valid, so rotation would go
  through the API only. A bot keeps its encrypted token as well, because the server hands that
  token to ingestion pipelines.

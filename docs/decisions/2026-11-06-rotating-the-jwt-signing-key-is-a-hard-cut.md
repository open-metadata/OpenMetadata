# Rotating the JWT signing key is a hard cut followed by bot-token regeneration

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OpsRegenerateBotTokensIT` (a key that differs from the servers' JWKS exits 2 and changes no token; a private key from another pair stores no token; a plain run replaces a current token and the replaced token answers 401 within `maxStaleness`; `--skip-current` replaces a stale token and leaves a current one unchanged; a regenerated bot has a change event naming `admin` that carries no form of its token; a bot revoked through `PUT /v1/users/revokeToken` keeps an empty token, in `aBotWhoseTokenWasRevokedStaysRevoked`), `OpenMetadataOperationsJwksTest`, `BotTokenRegeneratorTest` (a token an external secrets manager cleared on revoke reads as no token), `UserUtilTest` (the change event masks profile webhook secrets)
- **Related:** #36478, docs/jwt-signing-key-rotation.md

## Context

Replacing the signing key invalidates every token the old key signed, including bot tokens stored
in the database. A rotation that keeps old keys verifying (a key table, two-key window, retire
command) was built and rejected as more machinery than operators need for an event they run
rarely and plan for.

## Decision

- OpenMetadata keeps one signing key, the one in `jwtTokenConfiguration`.
- Rotation stops every server before any server starts with the new key, then runs
  `regenerate-bot-tokens`. A rolling restart is not a rotation. A token whose `kid` is not the
  server's own is checked against the keys fetched from `publicKeyUrls`, which
  `MultiUrlJwkProvider` keeps for 24 hours (`KEY_LIFETIME`). When those URLs reach a load-balanced
  peer that still runs the old key, a restarted server can fetch and keep the old key, and accept
  old user tokens and PATs for up to a day.
- `regenerate-bot-tokens` refuses to write anything, and exits 2, when the JWKS of the server behind
  `metadataApiEndpoint` does not list the configured `keyId` with the configured public key, or
  cannot be read. A host configured with a different key would otherwise store tokens the servers
  reject. The check reads one server, so it cannot prove that every server restarted. Operators
  check each server's JWKS themselves.
- Each new token is verified under the configured public key before it is saved. A private key
  from another pair would sign tokens the servers reject, so the bot is reported as `FAILED`
  ("Private key does not match the public key") and nothing is written.
- Each regenerated bot records a masked `ENTITY_UPDATED` change event, so the regeneration reaches
  the audit log and event subscriptions. Its actor is `admin`, the user that stands for an operator
  who is not signed in: neither the ops command nor an in-server job has a signed-in user. The
  event never carries the authentication mechanism.
- A plain run replaces the token of every bot that is not revoked, so it still serves a leaked
  token, a new expiry and a cluster name change. The command before this change also re-issued
  revoked bots' tokens. With `--skip-current`
  (`Scope.STALE` for an in-server caller), a bot whose stored token verifies under the configured
  key, has the configured `kid` and has not expired is left unchanged, so a rotation can be re-run
  without replacing the tokens an earlier run gave. A bot saved through `updateIfCurrent` fails,
  rather than being overwritten, when it changed since it was read.
- After the bots, every run redeploys each ingestion pipeline with `deployed == true`, so deployed
  pipelines carry their bot's new token. It runs even when no token changed, so a re-run repairs a
  redeploy that failed. It is skipped when the pipeline service client is disabled.
- A bot whose stored token is null or blank was revoked by an administrator. It is reported as
  `SKIPPED` ("Token revoked") and nothing is written, so regeneration never re-enables it. The
  database secrets manager stores a revoked token as blank. An external one deletes the secret and
  stores null.

## Consequences

A rotation takes the whole cluster down between the stop and the start. When the servers come back
on the new key, users sign in again, PAT holders create new tokens, and bots work again only after
regeneration. The JWKS has a single key. Revisit only if operators need zero-downtime rotation.

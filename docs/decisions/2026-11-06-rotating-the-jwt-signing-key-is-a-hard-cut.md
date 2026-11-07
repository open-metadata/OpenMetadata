# Rotating the JWT signing key is a hard cut followed by bot-token regeneration

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OpsRegenerateBotTokensIT` (a key that differs from the servers' JWKS exits 2 and changes no token; a second run leaves current tokens unchanged), `OpenMetadataOperationsJwksTest`, `BotTokenRegeneratorTest`
- **Related:** #36478, docs/jwt-signing-key-rotation.md

## Context

Replacing the signing key invalidates every token the old key signed, including bot tokens stored
in the database. A rotation that keeps old keys verifying (a key table, two-key window, retire
command) was built and rejected as more machinery than operators need for an event they run
rarely and plan for.

## Decision

- OpenMetadata keeps one signing key, the one in `jwtTokenConfiguration`.
- Rotation is a restart of every server with the new key, then `regenerate-bot-tokens`.
- `regenerate-bot-tokens` refuses to write anything, and exits 2, when the servers' JWKS does not
  list the configured `keyId` with the configured public key. A host configured with a different key
  would otherwise store tokens the servers reject.
- A bot whose stored token verifies under the configured key, has the configured `kid` and has not
  expired is left unchanged. A bot saved through `updateIfCurrent` fails, rather than being
  overwritten, when it changed since it was read.

## Consequences

Users, PAT holders and bots lose access at the restart, and bots regain it at regeneration. The
JWKS has a single key. Revisit only if operators need zero-downtime rotation.

# A push-feed socket without a session ends when its token expires or its user is deleted

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Vamsi-klu (proposed in #38245; maintainers review)
- **Guard:** `WebSocketManagerTest` (the sweep closes a socket whose token expired, keeps one at
  `exp`, keeps one without `exp`, sends the notice before closing, closes every socket of a user who
  is gone, never looks up a user whose sockets all have sessions, `endAccessForUser` closes and
  signals peers); `SocketAddressFilterTest` (the expiry is stamped only on a handshake without a
  session, on both transports, and a client's copy is dropped); `Jetty12WebSocketHandlerTest`;
  `PushFeedUserPresenceTest`; `OpenMetadataApplicationAuthReloadTest`
  (`buildPushFeedSockets_closesEverySocketOfAUserWhoIsGone`,
  `publishUserAccessEnded_publishesARevokeWithoutASessionId`); `WebSocketProvider.test.tsx`;
  `SsoPushFeedSocketIT`; `SessionMultiNodeIT`
  (`pushFeedSocketOpenedWithAPersonalAccessTokenClosesWhenItsUserIsDeletedOnAnotherNode`)
- **Related:** #38245, #38248, ADR:2026-10-26-push-feed-handshakes-always-authenticate,
  ADR:2026-10-20-a-refresh-ends-sessions-issued-by-a-provider-no-longer-configured, #38247, #38246

## Context

A push-feed handshake that presents a token without the session claim (a public-client SSO
provider token, a bot token, a personal access token) is accepted on token validation alone. The
websocket transport, the only one the UI uses, is checked once, at the upgrade. Nothing re-checked
such a socket afterwards: the sweep re-checks only sockets with a session, and revocation closes
sockets by session. A socket therefore stayed open after its token expired, and after its user was
deleted, until the client went away or the server restarted.

## Decision

- A socket with a session is governed by its session, which the sweep already re-checks. Its access
  token is a renewable proof of that session and puts no bound on the socket.
- A handshake accepted without a session stamps the verified `exp` of its token as the server-owned
  `TokenExpiresAt` header (epoch milliseconds) on both transports; a client's copy of that header is
  always dropped. A value the server cannot read counts as expired.
- The existing sweep closes such a socket at its first pass after `exp`: `exp` before now, the same
  strict comparison and zero leeway as `JwtFilter`. The bound is `exp` plus one sweep interval (60 s
  by default, 15 s at least). Before closing, the server sends `tokenExpiredChannel` to that socket.
- A token without `exp` (an Unlimited bot token or personal access token) puts no expiry bound on its
  socket, as on REST. Deleting the user, a provider switch and a restart still end it.
- Deleting a user, soft or hard, closes all their sockets on this server after the delete, from the
  `beginDeleteLifecycle` closure that every delete path runs, and publishes `session`/`revoke` with
  the user id and no session id, which peers already answer by closing all that user's sockets.
  Each sweep also checks whether a user who holds a socket without a session still exists, and
  closes all their sockets when not; a failed lookup is not a deletion and is retried at the next
  pass. That covers peers without Redis (one interval plus the 30 s entity cache), tokens without
  `exp`, and a handshake validated just before the delete that registers after it.
- The UI retries a server close only when `tokenExpiredChannel` came first, reading the current
  token, which it renews before `exp`. Every other server close stays final.

## Consequences

Public-client SSO tabs reconnect on their own about once per provider token lifetime. Other clients
that hold a token with `exp` must reconnect after `tokenExpiredChannel`; a UI built before this
ignores the notice and loses push until it is reloaded. A deleted user loses their sockets at once.
Revoking one personal access token or bot token while its user stays does not close its socket
before `exp`; that is a follow-up. The new per-socket expiry map is one entry per registered socket,
removed on every disconnect path, so it is bounded by live connections. Revisit if sockets with a
session should also end at their access token's `exp`: basic and confidential tabs would then drop
every hour.

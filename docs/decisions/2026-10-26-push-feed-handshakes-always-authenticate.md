# Push-feed socket handshakes are always authenticated

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** TeddyCr
- **Guard:** `SocketAddressFilterTest` (unit) — the credential-less regression test fails any
  change that re-opens a token-less, cookie-less handshake under the default configuration;
  `WebSocketManagerTest` covers handler bookkeeping.
- **Related:** open-metadata/OpenMetadata#36143

## Context

The push feed (`/api/v1/push/feed/*`) is a raw servlet outside the API `JwtFilter`, so its only
auth gate was `SocketAddressFilter`. Token validation there was gated on the authorizer's
`enableSecureSocketConnection` setting (default `false`), so under the default configuration a
handshake carrying no credential was accepted and the connection handler keyed the socket under
the user id the client presented in its query. Separately, a browser WebSocket upgrade cannot
carry headers, so the UI could only present a credential through the handshake query or a cookie
— public-client SSO sessions hold an IdP token and no `OM_SESSION` cookie.

## Decision

Every push-feed handshake carries at least one validated credential, under every configuration:

- A bearer token is presented either in the `Authorization` header or, when the header is absent,
  as a `token` query parameter (WebSocket upgrades cannot set headers). It is validated against
  the authentication/authorizer configuration whenever such configuration exists; a handshake whose
  token cannot be validated is rejected even when a session cookie rides along.
- A session cookie is validated against the session store. Internally-issued tokens (which carry
  the session claim) are revalidated against the store too; externally-issued tokens have no session
  claim and are trusted on token validation alone — the same basis their HTTP requests stand on.
- A handshake with neither a token nor a session cookie is rejected.
- The socket identity and session come only from the headers `SocketAddressFilter` stamps after
  validation; query parameters never key a socket.
- The authorizer setting `enableSecureSocketConnection` is a deprecated no-op, kept only so
  existing YAML still loads (the schema forbids unknown properties). Its `deprecated: true`
  annotation drives the generated classes.

## Consequences

Custom non-UI clients must open push-feed sockets with a valid token or session — an uncredentialed
socket gets 401. The handshake query is the only place a browser can present a token, so the token
rides an upgrade URL (same-origin only, like the cookie it replaces); the servlet therefore does not
log the handshake query string. Configurations that once enabled `enableSecureSocketConnection` see
no behavior change; those that disabled it gain the token and session checks it previously guarded.
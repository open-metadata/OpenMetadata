# MCP answers 400 to a protocol version it does not implement, except on initialize

- **Status:** Accepted
- **Revisions:** v1 2026-11-14 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `HttpServletStatelessServerTransportTest`
- **Related:** #37272

## Context

`/mcp` never read `MCP-Protocol-Version`, so a request naming a version we do not implement, such
as `2026-07-28`, got a normal 200 answer under our own protocol. The 2025-11-25 transport says such
a request MUST get 400 Bad Request. Clients that speak both 2026-07-28 and older versions depend on
that 400: they send a 2026-07-28 request first, and fall back to `initialize` only when it is
refused with a body that is not a 2026-07-28 error.

## Decision

- A POST to `/mcp` whose `MCP-Protocol-Version` is not in the transport's `protocolVersions()` gets
  400 with a JSON-RPC Invalid Request (-32600) error naming the supported versions. The check runs
  after authentication, so a client without a token still gets the 401 that starts OAuth.
- The error is not 2026-07-28's `UnsupportedProtocolVersionError` (-32022). That code tells a client
  it reached a 2026-07-28 server and should retry in that protocol, which this server cannot serve.
  A plain error sends it back to `initialize`.
- `initialize` is exempt: the spec puts the header on the requests after it, and its body
  negotiates the version.
- A request without the header passes, because the 2025-11-25 transport says to assume 2025-03-26.

## Consequences

A 2026-07-28 client that can fall back now does so. A client that sends a version it never
negotiated, which worked by accident, now gets 400. Once this server implements 2026-07-28, versions
it still does not implement must get `UnsupportedProtocolVersionError` instead, and this record is
superseded.

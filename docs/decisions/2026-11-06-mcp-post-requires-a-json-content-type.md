# POST /mcp requires a JSON Content-Type, checked after authentication

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** @Vishnuujain
- **Guard:** `HttpServletStatelessServerTransportTest.doPost_nonJsonContentType_answers415WithoutReachingTheHandler`,
  `HttpServletStatelessServerTransportTest.doPost_withoutAValidToken_answers401BeforeTheContentTypeCheck`
- **Related:** #37248

## Context

MCP clients send JSON-RPC as `application/json`, and the MCP Java SDK's own servlet transports
answer 415 to a POST with any other media type. `HttpServletStatelessServerTransport` is
our copy of that transport with our authentication added, so it did not get the rule: a POST with
any body type reached the JSON-RPC handler.

## Decision

A POST to `/mcp` whose media type is not `application/json` gets 415 before the handler runs.
Parameters such as `charset` are allowed and the match ignores case; a missing header is refused.
The check runs after authentication, so a client without a token still gets the 401 and
`WWW-Authenticate` header that start OAuth discovery.

## Consequences

Every MCP client we know of sends `application/json`, as do our integration tests; a client that
sends anything else now gets 415. An authenticated client with the wrong type pays for the token
check before the 415, accepted to keep the 401 first.

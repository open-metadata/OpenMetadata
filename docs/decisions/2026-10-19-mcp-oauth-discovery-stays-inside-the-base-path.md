# MCP and its OAuth discovery are served inside BASE_PATH, and the MCP base URL must carry it

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial) · v2 2026-11-16 (the advertised signing algorithm is
  the one the server signs its own tokens with)
- **Deciders:** Vishnu Jain
- **Guard:** `HttpServletStatelessServerTransportTest#doPost_underBasePath_reachesTheHandler`,
  `McpOAuthIT#testOpenIdConfigurationAppendedToIssuer_servesOpenIdDiscoveryMetadata`,
  `OAuthHttpStatelessServerTransportProviderTest#openIdDiscoveryAdvertisesTheAlgorithmOfTheTokensTheServerIssues`
- **Related:** #35539, ADR:2026-11-12-openmetadata-signs-its-own-tokens-with-rs256

## Context

`BASE_PATH` becomes the Jetty context path, so under `/data-catalog/` every request URI starts
with it. The MCP routes compared the full URI with `/mcp...` and never matched.

OAuth discovery has a second problem. For an issuer with a path (`https://host/data-catalog/mcp`),
the [MCP spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#authorization-server-metadata-discovery)
has clients try `/.well-known/oauth-authorization-server/...` and
`/.well-known/openid-configuration/...` at the host root, then
`<issuer>/.well-known/openid-configuration`. Only the last is inside the app. The TypeScript MCP
SDK parses that URL as OpenID Connect Discovery and aborts discovery when `jwks_uri`,
`subject_types_supported` or `id_token_signing_alg_values_supported` is missing.

## Decision

- MCP and OAuth routes match on the request path with the context path stripped, still exactly.
- The authorization server metadata is one document, served at both
  `<issuer>/.well-known/oauth-authorization-server` and `<issuer>/.well-known/openid-configuration`.
  It carries the three OpenID Connect Discovery fields: `jwks_uri` is
  `<baseUrl>/api/v1/system/config/jwks`, `subject_types_supported` is `["public"]`, and
  `id_token_signing_alg_values_supported` is the configured `tokenValidationAlgorithm`.
- The MCP base URL is the external URL including `BASE_PATH`. The server logs a warning when it
  does not carry it, at startup and when the setting changes, and never rewrites it.

## Consequences

- Clients that follow the spec order sign in under a sub-path with no ingress change. Clients that
  only try host-root URLs still need an ingress route for `/.well-known/*`.
- Rewriting the base URL was rejected: behind a proxy that maps another host or path onto
  `BASE_PATH`, a base URL without it is correct. Deriving it from `Host` or `X-Forwarded-*` was
  rejected because a client can set those headers and would choose the advertised OAuth endpoints.
- The document advertises ID token fields although MCP issues no ID tokens. Revisit if a client is
  found that fails on that.

## Amendment — 2026-11-16: the advertised algorithm is the server's own

ADR:2026-11-12-openmetadata-signs-its-own-tokens-with-rs256 made the server sign every token it
issues, MCP access tokens included, with RS256 (`JWTTokenGenerator.SIGNING_ALGORITHM`), and left
`tokenValidationAlgorithm` to describe only the identity provider's tokens. Until then the two were
the same value. `id_token_signing_alg_values_supported` is therefore `["RS256"]`, the algorithm of
the tokens the server issues, and no longer the configured `tokenValidationAlgorithm`. This
replaces the last clause of the second Decision bullet; the rest of this record stands.

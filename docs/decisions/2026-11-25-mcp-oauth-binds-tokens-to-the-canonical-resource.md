# MCP OAuth validates the RFC 8707 resource parameter against the canonical resource URI and binds minted tokens via aud

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** deepinsight coder
- **Guard:** `McpResourceUriTest`, `AuthorizationHandlerTest`,
  `OAuthHttpStatelessServerTransportProviderTest`, `JWTTokenGeneratorTest`,
  `UserSSOOAuthProviderTest`, `McpServerRequestContextTest`, `TokenAudienceTest`,
  `JwtFilterTest` (`everyEntryPointOfTheApiRefusesATokenIssuedForTheMcpResource`,
  `everyEntryPointOfTheApiStillAcceptsOpenMetadataTokensWithoutAnAudience` and the
  `theMcpEntryPoint*` tests),
  `SocketAddressFilterTest#realValidatorRejectsATokenIssuedForTheMcpResource`, `McpTokenAudienceIT`,
  `SsoMcpSignInChecksIT#resourceParameterIsEnforcedAcrossAuthorizeTokenAndResourceServer`
- **Related:** #38479,
  ADR:2026-10-19-mcp-oauth-discovery-stays-inside-the-base-path,
  ADR:2026-10-29-mcp-access-tokens-are-stored-so-revoke-reaches-every-server,
  ADR:2026-11-02-mcp-authorization-errors-reach-a-remote-callback-through-a-link

## Context

The MCP authorization specification requires RFC 8707 resource indicators so that an access token
requested for one MCP server cannot be issued for, or replayed against, another. Previously,
`/mcp/authorize` and `/mcp/token` ignored the `resource` parameter (and collapsed repeated query or
form values via `values[0]`), minted MCP access tokens carried no `aud` claim, and `/mcp` performed
no audience check on OpenMetadata-signed JWTs.

At the same time, several real MCP clients (`Codex CLI`, `mcp-remote`) still omit `resource`,
OpenMetadata-signed PATs, bot JWTs, and web session tokens carry no `aud` claim, and external IdP
OIDC Bearer tokens carry the OIDC `client_id` in `aud` (validated by `ProviderTokenValidator`).

## Decision

- **Single resource source:** The issuer and protected resource advertised in discovery both use
  the configured `<baseUrl>/mcp` URI, honoring
  ADR:2026-10-19-mcp-oauth-discovery-stays-inside-the-base-path. Authorization, token exchange, and
  audience checks all read the OAuth provider's current issuer, which the transport sets at startup
  and on each base URL reload.
- **Strict RFC 8707 / RFC 3986 validation (`McpResourceUri`):** Every `resource` parameter value
  from `request.getParameterValues("resource")` is validated on `/mcp/authorize` (after `client_id`
  and `redirect_uri` verification, before creating a pending login or contacting the IdP) and on
  `/mcp/token` for both `authorization_code` and `refresh_token` grants (before consuming the code
  or rotating the refresh token). Only absolute hierarchical `http`/`https` URIs up to 2048
  characters without userinfo, query, fragment, dangling port colons, invalid ports, dot-segments,
  or repeated slashes are accepted; scheme and host fold case with `Locale.ROOT`, explicit default
  ports (`:80` / `:443`) normalize away, and raw paths compare case-sensitively without
  percent-decoding while allowing at most one trailing slash. Any invalid or mismatched value
  returns `invalid_target`. Direct authorization error responses preserve the OAuth error code
  and use a fixed description. Resource rejections log the expected URI and the first rejected
  value at WARN, with userinfo, queries, and fragments redacted.
- **Invalid server configuration:** The transport logs an error at startup and on reload if its
  resource URI cannot be canonicalized. Token exchange returns `server_error` in this case before
  signing a token, consuming an authorization code, or rotating a refresh token.
- **Backward-compatible omission:** An absent `resource` parameter (`null`) remains accepted on
  `/mcp/authorize` and `/mcp/token` so legacy MCP clients keep signing in; an empty `resource=` is
  present and rejected with `invalid_target`.
- **Audience binding:** Minted MCP OAuth access tokens carry the canonical resource URI as a
  single-string JWT `aud` claim via an additive `JWTTokenGenerator` overload. No other token
  OpenMetadata signs carries `aud`.
- **One audience check, applied by every entry point:** `TokenAudience` holds the rule and
  `JwtFilter` applies it to every OpenMetadata-signed token while verifying it, next to the issuer
  check, so `filter`, `getCatalogSecurityContext`, `validateJwtAndGetClaims`, `verifySignatureOnly`
  and `SocketAddressFilter.validatePrefixedTokenRequest` all enforce it. A token without `aud` is
  accepted. A token with `aud` is accepted only when every value is text and one names the
  resource the filter serves; otherwise it is refused with a 401 (`Token was issued for another
  resource.`), never a 500. Identity provider tokens are not judged by it: `ProviderTokenValidator`
  checks their `aud` against the configured client ids.
- **What each entry point serves:** A `JwtFilter` serves the OpenMetadata API unless it is built
  with a `TokenAudience`, and no audience names the API. So the REST filter and the push-feed
  handshake (`SocketAddressFilter`, both the polling servlet path and the WebSocket upgrade)
  refuse every OpenMetadata-signed token that carries `aud`, MCP access tokens included. The MCP
  transport and `McpServer` build their filters with `McpResourceUri.tokenAudienceOf`, which reads
  the OAuth provider's current issuer and matches it with
  `McpResourceUri.matches`; before the resource is published nothing matches.
- **Tokens without `aud`:** login and session tokens, bot tokens, personal access tokens, and MCP
  access tokens minted before audience binding keep working on REST, the push feed and `/mcp`
  exactly as before this change.
- **No database schema changes:** OpenMetadata hosts a single MCP protected resource per
  deployment, so `resource` is not persisted on `mcp_pending_auth_requests`,
  `oauth_authorization_codes`, or `oauth_refresh_tokens`. This avoids guarded DDL migrations across
  MySQL and PostgreSQL and lets 30-day refresh tokens survive an operator fixing `baseUrl`.

## Consequences

- Foreign, malformed, or multi-value-smuggled `resource` requests are stopped at `/mcp/authorize`
  and `/mcp/token` without creating pending requests, contacting the IdP, burning valid
  authorization codes, or invalidating valid refresh tokens, while preserving
  ADR:2026-11-02-mcp-authorization-errors-reach-a-remote-callback-through-a-link for remote HTTPS
  callbacks.
- Tokens minted for another MCP server (including another OpenMetadata instance sharing default
  signing keys, or an old `baseUrl`) are refused at `/mcp` with HTTP 401 and
  `WWW-Authenticate: Bearer ..., error="invalid_token"`.
- An MCP access token no longer reaches the REST API or the push feed, which it did while it was
  a plain `OM_USER` token. The REST half of the revocation consequence in
  ADR:2026-10-29-mcp-access-tokens-are-stored-so-revoke-reaches-every-server now applies only to
  MCP access tokens minted before audience binding, which expire within 10 minutes of the upgrade.
- A new entry point that builds a `JwtFilter` gets the API rule by default and so refuses MCP
  access tokens. A new resource OpenMetadata mints tokens for must build its filter with its own
  `TokenAudience`, in this distribution or another one.
- Revisit persisting `resource` per grant only if OpenMetadata ever serves multiple distinct MCP
  protected resources from one authorization server, or if strict rejection of omitted `resource`
  becomes required once legacy clients are retired.

# MCP SSO sign-in asks the user to approve the client after the IdP round trip, before any code exists

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `UserSSOOAuthProviderTest`
  (`handleSSOCallbackWithDbState_servesConsentPageInsteadOfIssuingCode`)
- **Related:** ADR:2026-10-19-mcp-oauth-discovery-stays-inside-the-base-path

## Context

MCP clients register themselves at `/mcp/register` with their own redirect URI. With OIDC
(confidential client) or SAML sign-in, `handleSSOCallbackWithDbState` issued the authorization code
as soon as the IdP identified the user. The IdP only knows OpenMetadata's own client id, so it
cannot tell MCP clients apart, and no page named the MCP client before the code went to its
redirect URI. Basic and LDAP sign-in go through `/mcp/login`, where the user types their password
for the named client; that page does not show the redirect host yet.

## Decision

- All SSO entries into the MCP flow (OIDC code flow, direct ID token, SAML) end in
  `handleSSOCallbackWithDbState`, which now serves a consent page naming the client, the user and
  the redirect host, and issues no code.
- `POST /mcp/consent` issues the code on approve and relays `access_denied` on deny. The pending
  approval lives on the `mcp_pending_auth_requests` row: a hash of the page's random token and the
  signed-in user. Only the first sign-in for a request is recorded, which also restarts the TTL so
  time spent at the IdP does not eat into the consent page; a later callback for the same request
  is refused. The POST claims the consent with one conditional `UPDATE`, so it can be used once
  and only before the request expires, and the user always comes from the row, never from the
  form. The
  row rather than the `HttpSession` holds it because Jetty sessions are per node, and rather than a
  token signed with a server key because those keys ship with defaults in `conf/`.
- Consent is asked **after** the IdP round trip, not before it as the MCP spec's
  [confused-deputy](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices#confused-deputy-problem)
  diagram shows. SAML resolves the pending request from `RelayState` alone and the OIDC round-trip
  state lives in the database, so an approval recorded before the IdP step would not be tied to
  the browser that signs in.

## Consequences

- Every MCP SSO authorization takes one extra click. Approvals are not remembered per user and
  client.
- `mcp_pending_auth_requests` gains `consent_token_hash` and `consent_user_name`, so any server
  can answer the POST. PostgreSQL adds them in the 2.0.7 `schemaChanges.sql` with `IF NOT EXISTS`.
  MySQL adds them from the 2.0.7 Java migration, which checks `information_schema` first
  (ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration), and again from 2.1.0, since
  a database already at 2.1.0 reprocesses 2.0.7 for its SQL only.

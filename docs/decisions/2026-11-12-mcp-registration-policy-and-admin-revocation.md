# MCP registration is operator-controlled and administrators can revoke a whole client

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial) · v2 2026-11-12 (error callbacks and proxy attribution) · v3 2026-11-12 (administrator controls) · v4 2026-11-13 (token inventory and revocation)
- **Deciders:** Mohit Yadav
- **Guard:** `McpClientPolicyTest`, `McpOAuthClientResourceTest`, `McpGrantRevocationSqlTest`, `McpOAuthClientIT`, `AuthorizationHandlerTest`, `UserSSOOAuthProviderTest`, `OAuthHttpStatelessServerTransportProviderTest`
- **Related:** ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip, ADR:2026-10-29-mcp-access-tokens-are-stored-so-revoke-reaches-every-server

## Context

SSO consent does not give operators control over anonymous client registrations or a supported way
to inventory and revoke unwanted clients. Client names and callback addresses are supplied by the
registrant; neither is an attestation of trust. A registration is not evidence that tokens were issued.

## Decision

- Keep DCR enabled by default for existing client compatibility. Operators can disable new DCR
  with `dynamicClientRegistrationEnabled`; discovery then omits `registration_endpoint` and POST
  registration fails before its body is parsed. Existing clients remain usable.
- `allowedRedirectHosts` is an exact, case-insensitive HTTPS host allowlist; empty preserves open
  HTTPS registration. No suffix or wildcard matching is performed. Loopback and private-use native
  redirects have independent switches, both enabled by default for desktop compatibility.
- Reject redirect userinfo, fragments, missing web hosts, invalid ports, and redirect strings longer
  than 2048 characters. Check policy at registration, authorization, SSO consent, code issuance, and error callbacks.
  Rejected callbacks receive neither an error redirect nor a return link.
  Policy changes do not silently revoke issued grants; operators remove the client to revoke them.
- Rate limits trust forwarding headers only from loopback peers and use the rightmost validated,
  canonical IP address. Local proxies must append or overwrite the connecting client address;
  untrusted prefixes never select a quota. Invalid values fall back to the peer.
- Admin-only `GET /api/v1/mcp/clients` returns credential-free inventory, registration time and
  callbacks, ordered by client ID. `after` is the last client ID in the previous page; `limit` is
  1–1000 (default 100) to bound memory and response size.
- Admin-only `DELETE /api/v1/mcp/clients/{clientId}` deletes the client and pending logins in one
  transaction. Existing foreign-key cascades delete authorization codes, access tokens and refresh
  tokens. The database-backed access-token check makes revocation effective across nodes.
- Removal blocks that client ID. It is not a publisher/domain ban: an attacker may register another
  ID while unrestricted DCR remains enabled. Use the registration switch or redirect policy for that.

## Consequences

No database migration or cleanup of existing registrations is performed automatically. Client
removal is destructive for legitimate integrations too: they must register and authorize again.
The separate new-spec feature will add metadata documents and pre-registration; neither is part
of this security patch. Server-side incident investigation remains necessary after deployment.

## Amendment v2 — error callbacks and proxy attribution

The redirect boundary also applies to authorization errors and pending IdP error callbacks.
Local proxies must append or overwrite the actual connecting address in `X-Forwarded-For`;
rate limits use only the validated, canonical rightmost address. This prevents client-supplied
prefixes or equivalent IP spellings from selecting a fresh quota.

## Amendment v3 — administrator controls

The administrator MCP configuration page exposes the existing server enable flag and registration
policy, plus paginated client inventory and confirmed revocation. The transport enforces the
enable flag on every incoming request. Disabling preserves registration and grant rows; it is
not equivalent to revoking a client. Administrative REST endpoints remain available while disabled.

## Amendment v4 — token inventory and revocation

The client inventory reports active access-token and refresh-token counts at query time. Active
means stored and unexpired; revoked refresh tokens are excluded. Counts are not a live connection
indicator. No token values, hashes or encrypted credentials are selected for this response.

Administrators may call `DELETE /api/v1/mcp/clients/{clientId}/tokens` to revoke all existing tokens,
authorization codes and pending sign-ins while keeping the registration. A known client with no
grants returns 204; an unknown client returns 404. Fresh user authorization remains possible.
The UI distinguishes **Revoke tokens** from **Remove client**, with a confirmation for each.

Issuance and revocation serialize on the client row in the database, across server instances.
The issuance transaction revalidates pending consent or the presented code/refresh token and
performs all grant writes on the same connection. Repositories resolve the transaction-scoped
DAO, cleared in a finally block. An exchange that wins the lock completes before revocation
removes its tokens; an exchange that loses finds its old grant gone. Protocol errors still commit
single-use authorization-code consumption, so an incorrect PKCE verifier cannot retry the code.

Password verification and LDAP calls finish before acquiring the client lock. Login and consent
responses are written only after the grant transaction commits, so slow external services or
browser sockets cannot hold the shared client lock. The pending request is re-read under the lock
to reject revocation during authentication; a client removed before locking produces a 400 response.

# MCP registration is operator-controlled and administrators can revoke a whole client

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `McpClientPolicyTest`, `McpOAuthClientResourceTest`, `McpGrantRevocationSqlTest`, `McpOAuthClientIT`
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
  than 2048 characters. Check policy at registration, authorization, SSO consent, and code issuance.
  Policy changes do not silently revoke issued grants; operators remove the client to revoke them.
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

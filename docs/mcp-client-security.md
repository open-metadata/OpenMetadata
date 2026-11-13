# MCP client registration and incident response

MCP sign-in asks users to consent to the requesting application. A client name is self-declared;
verify the destination host on the consent screen. Administrators can additionally control client
registration and revoke access through the following settings and endpoints.

## Admin page

Open **Settings → Applications → MCP Server → Configuration** as an administrator.
The Configuration tab controls the MCP server switch and registration policy. The adjacent
Registered MCP clients tab lists registered clients with their IDs, callback URLs, registration
dates, and active access-token and refresh-token counts. These are unexpired stored grants, not
live connections; revoked refresh tokens are excluded. Token values are never displayed.

Use **Revoke tokens** to end existing access for every user of the client while keeping its
registration. It also clears authorization codes and pending sign-ins. Users can authorize the
client again afterward. Use **Remove client** to remove the registration and all grants. Both
actions require confirmation. Refresh and cursor navigation load the current inventory;
client administration remains available while MCP is disabled.

Disabling **Enable MCP Server** rejects new MCP transport and OAuth requests with HTTP 503;
it preserves clients and grants. Already-running requests may finish. Re-enabling restores access
for otherwise-valid grants. Settings propagation follows the existing security settings reload.

## Registration policy

Configure these fields in the existing MCP configuration setting:

```json
{
  "dynamicClientRegistrationEnabled": false,
  "allowedRedirectHosts": ["trusted-client.example.com"],
  "allowLoopbackRedirects": true,
  "allowNativeRedirects": false
}
```

Disabling dynamic registration stops new anonymous clients; it does not disable MCP or existing
clients. Discovery stops advertising registration while it is disabled. New clients that only
support DCR will not connect until an administrator enables it. Registration remains enabled by
default in this security patch; its deprecation belongs to the separate new-spec feature.

The HTTPS allowlist matches complete host names, case-insensitively. A listed host does not permit
subdomains, lookalike suffixes or a trailing-dot variant. It permits HTTPS ports on that host.
An empty list permits any HTTPS host. Loopback callbacks and private-use native schemes have
separate switches because desktop clients need them. Disabling either can break those clients.
Settings follow the existing MCP configuration propagation; allow other nodes to reload before
assuming a policy change has reached the whole cluster.

Policies apply to new authorization codes, including pending sign-ins, and to OAuth error
callbacks. A rejected callback is not offered as a redirect or return link. Existing tokens are not
revoked by editing a host allowlist. Revoke its tokens or remove the client if its existing access must end.

## Inventory and remove a client

Use an authenticated OpenMetadata administrator credential with:

- `GET /api/v1/mcp/clients?limit=100`: client IDs, client names, redirect URIs and `issuedAt`
  (epoch milliseconds), plus `activeAccessTokens` and `activeRefreshTokens` counts at query time.
  No client secrets, encrypted secrets, token values or token hashes are returned.
- For subsequent pages, pass the last returned `clientId` as `after`. Continue until a page is empty.
- `DELETE /api/v1/mcp/clients/{clientId}/tokens`: remove all access tokens, refresh tokens,
  authorization codes and pending sign-ins while retaining the registration. Returns 204 even
  when the registered client has no grants; an unknown client returns 404. Other clients are
  unaffected. Fresh user authorization is still permitted.
- `DELETE /api/v1/mcp/clients/{clientId}`: remove the registration and revoke all its users' grants.
  Success is 204; an unknown ID is 404. Authorization codes, access and refresh tokens, and pending
  logins belonging to that client are removed. Other clients are unaffected.

Removal takes effect on the next authenticated request on every server; already-running requests
cannot be undone. The removed ID cannot authorize or refresh again. A new registration is still
possible while DCR is open, so restrict registration first when containing a suspected incident.

Inventory alone cannot establish exploitation: correlate suspicious clients with authorization,
token-issuance and usage logs. Legitimate hosted integrations may have external redirect domains.
Do not delete all external clients without checking their owners and usage. These controls do not
retroactively reconstruct missing logs or prove that no prior misuse occurred.

## Reverse proxies and rate limits

Registration and token limits use the direct peer address unless the peer is loopback. A local
reverse proxy must overwrite `X-Forwarded-For` with the connection's client address or append
that address as the rightmost entry. MCP uses only that rightmost entry, validates it as an IP
literal, and canonicalizes it before counting requests. Invalid entries fall back to the peer;
headers from non-loopback peers are ignored. Never forward a client-supplied header unchanged.
With additional proxy hops, requests may share the last proxy's quota. Limits remain per server.

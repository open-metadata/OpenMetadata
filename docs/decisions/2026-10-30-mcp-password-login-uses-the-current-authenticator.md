# MCP password login uses the authenticator of the current provider

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `BasicAuthLoginServletTest` (`doPost_afterSwitchToLdap_passwordIsCheckedByTheDirectory`,
  `doPost_providerWithoutPasswords_refusesLogin`)

## Context

`/mcp/login` checked credentials with an authenticator MCP built once at startup: LDAP when the
server started on LDAP, the local password store for every other provider. The security settings
can change the provider without a restart, and the rest of the server then uses the authenticator
registered for the new provider. MCP kept the one from startup.

## Decision

- `POST /mcp/login` takes the authenticator registered with `SecurityConfigurationManager` on every
  login, the same one `/api/v1/auth/login` uses.
- Whether a separate password check runs is decided by that authenticator (LDAP checks the password
  in its bind), not by reading the provider setting.
- When the provider does not sign in with passwords (OIDC and SAML register `NoopAuthenticator`),
  the form answers 403 `Password login is not enabled`.

## Consequences

- A provider change applies to MCP logins at once, with no restart.
- Local passwords kept from before a move to SSO no longer sign in through MCP.
- A new authenticator that checks the password inside `lookUserInProvider`, like LDAP, must be
  added next to the `LdapAuthenticator` check.

# Security configuration writes never move a stored secret

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SecurityConfigSecretsIT`, `SystemResourceSecurityConfigTest`, `TestLoginCandidatesTest`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Admins read the security configuration with its secrets masked: the OIDC client secret, the LDAP
bind and trust store passwords, the SAML SP key and key store password. A write sends that masked
form back, so the server decides when a masked value stands for the stored secret. A stored secret
belongs to the endpoint it was entered for, the rule the validate and Test Login endpoints apply
(`TestLoginCandidates`).

## Decision
- `GET /system/security/config` masks the secrets for every caller, bots included.
- `PATCH` applies its operations to the masked configuration, so a `copy` or `move` from a secret
  carries the mask.
- `PATCH` and `PUT` restore a masked secret only under the `TestLoginCandidates` rules: same client
  and discovery for the OIDC secret, same server, bind account and transport for the LDAP password,
  same trust store for its password, same SP, IdP and key store for the SAML secrets.
- A secret still masked after that is refused with 400, asking the admin to enter it again.

## Consequences
Changing where a secret is used (an LDAP host, an OIDC discovery URI) requires typing the secret in
the same request. A secret field added to the authentication configuration needs a restore rule in
`TestLoginCandidates`, or every write that keeps it masked is refused.

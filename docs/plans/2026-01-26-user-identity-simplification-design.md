# User Identity Management Simplification Design

## Summary

Simplify OpenMetadata's authentication system to use email as the primary user identifier, replacing the complex claim resolution logic with a straightforward email-first approach.

## Goals

- Email as the single source of truth for user identity
- Simplified configuration with sensible defaults
- Backward compatibility with deprecation warnings for old configs
- Support for all authentication providers (OIDC, SAML, LDAP, Basic)

## Configuration Schema

### New Configuration Model

```yaml
authenticationConfiguration:
  provider: "oidc"  # Required: oidc, saml, ldap, basic
  publicKeyUrls: ["https://..."]  # Required for SSO providers

  # New simplified fields
  emailClaim: "email"      # Optional, defaults per provider
  displayNameClaim: "name" # Optional, defaults per provider

  # Deprecated (warn if present, still functional)
  jwtPrincipalClaims: [...]           # Deprecated
  jwtPrincipalClaimsMapping: [...]    # Deprecated

authorizerConfiguration:
  # New fields
  adminEmails: ["admin@company.com", "user1@company.com"]
  allowedEmailDomains: ["company.com", "subsidiary.com"]  # Optional, if set only these domains can authenticate
  botDomain: "bot.company.com"  # Domain used for system-created bots

  # Deprecated (warn if present, still functional)
  adminPrincipals: [...]   # Deprecated
  principalDomain: "..."   # Deprecated
```

### Provider Defaults

| Provider | `emailClaim` | `displayNameClaim` |
|----------|-------------|-------------------|
| OIDC | `"email"` | `"name"` |
| SAML | `"email"` | `"name"` |
| LDAP | `"mail"` | `"displayName"` |
| Basic | N/A | N/A |

## User Identity Model

| Field | Source | Uniqueness |
|-------|--------|------------|
| `email` | From claim (required) | Unique, primary lookup key |
| `name` | Auto-generated (email prefix, collision suffix if needed) | Unique, internal identifier |
| `displayName` | From `displayNameClaim` or email prefix | Not unique, user-friendly |

### Name Generation

1. Extract prefix from email (`john.doe@company.com` → `john.doe`)
2. Check if `john.doe` exists
3. If collision, append random suffix → `john.doe_x7k2`

## Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                   User Authenticates                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Extract email from claim/attribute using emailClaim    │
│  (OIDC: JWT claim, SAML: assertion, LDAP: attribute)    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Email found?  │
              └───────┬───────┘
                      │
           ┌──────────┴──────────┐
           │ No                  │ Yes
           ▼                     ▼
┌─────────────────────┐  ┌─────────────────────────────────┐
│ Fail authentication │  │ Validate email format           │
│ "email claim not    │  └─────────────────┬───────────────┘
│ found in token"     │                    │
└─────────────────────┘                    ▼
                               ┌───────────────────────┐
                               │ allowedEmailDomains   │
                               │ configured?           │
                               └───────────┬───────────┘
                                           │
                                ┌──────────┴──────────┐
                                │ Yes                 │ No
                                ▼                     │
                      ┌─────────────────────┐         │
                      │ Domain in allowed   │         │
                      │ list?               │         │
                      └─────────┬───────────┘         │
                                │                     │
                     ┌──────────┴──────────┐          │
                     │ No                  │ Yes      │
                     ▼                     ▼          ▼
           ┌─────────────────┐   ┌─────────────────────────┐
           │ Fail: "domain   │   │ Lookup user by email    │
           │ not allowed"    │   └─────────────┬───────────┘
           └─────────────────┘                 │
                                               ▼
                                    ┌─────────────────────┐
                                    │ User exists?        │
                                    └─────────┬───────────┘
                                              │
                                   ┌──────────┴──────────┐
                                   │ No                  │ Yes
                                   ▼                     ▼
                         ┌─────────────────────┐  ┌─────────────────┐
                         │ enableSelfSignup?   │  │ Return existing │
                         └─────────┬───────────┘  │ user            │
                                   │              └─────────────────┘
                        ┌──────────┴──────────┐
                        │ No                  │ Yes
                        ▼                     ▼
              ┌─────────────────────┐  ┌─────────────────────┐
              │ Fail: "User not    │  │ Create new user:    │
              │ registered. Contact │  │ - Generate name     │
              │ administrator."     │  │ - Set displayName   │
              └─────────────────────┘  │ - Set email         │
                                       └─────────────────────┘
```

## Error Messages

| Scenario | Error Message |
|----------|---------------|
| Missing email claim | `"Authentication failed: email claim '{claimName}' not found in token"` |
| Invalid email format | `"Authentication failed: invalid email format"` |
| Domain not allowed | `"Authentication failed: domain '{domain}' not in allowed list"` |
| User not registered | `"User not registered. Contact administrator."` |

## Deprecation Warnings

Logged at startup if deprecated configs are present:

| Deprecated Config | Warning Message |
|-------------------|-----------------|
| `jwtPrincipalClaims` | "Deprecated: Use 'emailClaim' instead" |
| `jwtPrincipalClaimsMapping` | "Deprecated: Use 'emailClaim' and 'displayNameClaim' instead" |
| `adminPrincipals` | "Deprecated: Use 'adminEmails' instead" |
| `principalDomain` | "Deprecated: Use 'botDomain' for bots, 'allowedEmailDomains' for domain restrictions" |

## Files to Modify

### Configuration Schema
- `openmetadata-spec/src/main/resources/json/schema/configuration/authenticationConfiguration.json` - Add `emailClaim`, `displayNameClaim`
- `openmetadata-spec/src/main/resources/json/schema/configuration/authorizerConfiguration.json` - Add `adminEmails`, `allowedEmailDomains`, `botDomain`

### Core Authentication Logic
- `SecurityUtil.java` - New simplified `findEmailFromClaim()` method, deprecation warnings
- `JwtFilter.java` - Update to use email-first resolution, lookup by email
- `UserRepository.java` - Add/verify email-based lookup method

### Authenticators
- `BasicAuthenticator.java` - Align with email-first approach
- `LdapAuthenticator.java` - Use `emailClaim` for LDAP attribute
- `SamlAuthenticationHandler.java` - Use `emailClaim` for SAML assertion
- `AuthenticationCodeFlowHandler.java` - Update OIDC flow

### User Management
- `UserUtil.java` - Update admin user creation to use `adminEmails`, bot creation to use `botDomain`, name generation with collision handling
- `UserResource.java` - API for username selection (Basic Auth flow)

### Startup/Bootstrap
- Deprecation warning logging when old configs detected

## Security Model Decisions

- **Fail closed on unknown emails.** When the email-first flow finds no user for a token's email,
  the request is rejected (401) if any existing account already owns the email's local-part as a
  username — resolving to that name would let an unregistered email act as another user's
  identity. Only when the candidate username is entirely unclaimed does the request proceed with
  it, which is required for first-login bootstrap of public-client (implicit) flows.
- **Deactivated accounts cannot authenticate.** All email-first lookups go through
  `UserRepository.getActiveUserByEmailForAuth`, which rejects soft-deleted users with an explicit
  "account deactivated" error instead of resolving, updating, or resurrecting them.
- **OM-issued tokens are exempt from `allowedEmailDomains`.** Session tokens and personal access
  tokens are recognized by issuer + key id and skip the domain allow-list; enforcing it on them
  would lock out the seeded admin and grandfathered users whose emails predate the config. Domain
  restrictions apply to IdP-issued tokens.
- **`allowedEmailRegistrationDomains` applies to email-first self-signup** across OIDC, SAML, and
  LDAP provisioning, matching the legacy OIDC behavior.
- **`email_verified` is honored when present.** An OIDC token that explicitly carries
  `email_verified: false` is rejected in the email-first flow; absent claims are accepted since
  many IdPs omit it.
- **Display names sync only when the IdP supplies one.** Resolvers pass null when no display-name
  claim/attribute exists, so user-customized display names are never reverted to an email-prefix
  fallback.
- **Emails are stored and compared lowercased.** A native migration normalizes existing rows and
  (Postgres) adds functional indexes on `LOWER(email)` / `LOWER(name)` so the auth-path lookups
  are index-backed. MySQL's case-insensitive collation serves the same purpose with plain
  equality.

## Migration Strategy

Phase 1 (this implementation): Backward-compatible changes with deprecation warnings. Old configs
continue to work. Legacy `adminPrincipals` continue to match existing users **by name** (only
`adminEmails` resolves by email) so no duplicate admin accounts are created on upgrade.

Phase 2 (future): Migration tooling via OpenMetadataOps to help users transition existing users
with artificial emails (e.g. `user@principalDomain` synthesized from NameID/UPN configs) to real
emails — required before such deployments can enable `emailClaim`. Also planned: store the IdP
`sub` claim on first login and alert/deny when a known email presents a different subject
(defends against IdP email reuse/recycling), and an admin-only "change user email" operation
(emails are currently immutable through the API).

Phase 3 (future): Remove deprecated configuration options.

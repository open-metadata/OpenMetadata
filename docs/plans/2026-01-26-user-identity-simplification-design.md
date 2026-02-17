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

## Migration Strategy

Phase 1 (this implementation): Backward-compatible changes with deprecation warnings. Old configs continue to work.

Phase 2 (future): Migration tooling via OpenMetadataOps to help users transition existing users with artificial emails to real emails.

Phase 3 (future): Remove deprecated configuration options.

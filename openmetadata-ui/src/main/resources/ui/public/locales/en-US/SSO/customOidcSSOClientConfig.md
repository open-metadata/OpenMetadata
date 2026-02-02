---
title: Custom OIDC Authentication Configuration | OpenMetadata
description: Configure Custom OIDC Authentication for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/custom-oidc-auth
---

Custom OIDC authentication enables integration with any OpenID Connect compliant identity provider.

## <span data-id="clientId">Client ID</span>

- **Definition:** OAuth2 client identifier issued by your OIDC provider.
- **Example:** my-custom-oidc-client-12345
- **Why it matters:** Identifies your application to the OIDC provider.
- **Required:** Yes

## <span data-id="clientSecret">Client Secret</span>

- **Definition:** OAuth2 client secret issued by your OIDC provider.
- **Example:** abc123-secret-xyz789
- **Why it matters:** Authenticates your application with the OIDC provider.
- **Required:** Yes
- **Security:** Keep this secret secure and never expose it in client-side code.

## <span data-id="authority">Authority / Issuer URL</span>

- **Definition:** Base URL of your OIDC provider's authentication server.
- **Example:** https://auth.yourcompany.com or https://login.microsoftonline.com/tenant-id
- **Why it matters:** OpenMetadata uses this to discover OIDC endpoints and validate tokens.
- **Required:** Yes
- **Note:** Must be publicly accessible and return valid OIDC discovery document at `/.well-known/openid_configuration`

## <span data-id="callbackUrl">Callback URL / Redirect URI</span>

- **Definition:** URL where the OIDC provider redirects after authentication.
- **Auto-Generated:** This field is automatically populated as `{your-domain}/callback`.
- **Example:** https://openmetadata.company.com/callback
- **Why it matters:** Must be registered in your OIDC provider configuration.
- **Note:**
  - **This field is read-only** - it cannot be edited
  - **Copy this exact URL** and add it to your OIDC provider's allowed redirect URIs list
  - Format is always: `{your-domain}/callback`

## <span data-id="scopes">Scopes</span>

- **Definition:** OAuth2 scopes to request from the OIDC provider.
- **Default:** openid profile email
- **Example:** openid profile email groups
- **Why it matters:** Determines what user information OpenMetadata can access.
- **Common scopes:**
  - `openid`: Required for OIDC
  - `profile`: Access to user profile information
  - `email`: Access to user email address
  - `groups`: Access to user group memberships (if supported)

## <span data-id="publicKey">Public Key / JWK URI</span>

- **Definition:** Public key or JSON Web Key Set URI for token validation.
- **Example:** https://auth.yourcompany.com/.well-known/jwks.json
- **Why it matters:** Used to verify the signature of JWT tokens.
- **Note:** Usually auto-discovered from the OIDC provider's discovery document.

## <span data-id="principals">JWT Principal Claims</span>

> ⚠️ **CRITICAL WARNING**: Incorrect claims will **lock out ALL users including admins**!
> - These claims MUST exist in JWT tokens from your OIDC provider
> - Order matters: first matching claim is used for user identification
> - **Default values (email, preferred_username, sub) work for most standard OIDC providers**
> - Verify with your provider's documentation before changing

- **Definition:** JWT claim names that contain user principal information.
- **Default:** ["email", "preferred_username", "sub"] (recommended)
- **Example:** ["email", "username", "sub"]
- **Why it matters:** Maps JWT claims to OpenMetadata user identities.

### <span data-id="jwtPrincipalClaimsMapping">JWT Principal Claims Mapping</span>

- **Definition:** Maps JWT claims to OpenMetadata user attributes. (Overrides JWT Principal Claims if set)
- **Example:** ["email:email", "username:preferred_username"]
- **Why it matters:** Controls how user information from your OIDC provider maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:jwt_claim"
- **Validation Requirements:**
  - Both `username` and `email` mappings must be present when this field is used
  - Only `username` and `email` keys are allowed; no other keys are permitted
  - If validation fails, errors will be displayed on this specific field
- **Important:** JWT Principal Claims Mapping is **rarely needed** for most OIDC configurations. The default JWT Principal Claims handle user identification correctly. Only configure this if you have specific custom claim requirements.

## <span data-id="jwtTeamClaimMapping">JWT Team Claim Mapping</span>

- **Definition:** JWT claim or attribute containing team/department information for automatic team assignment.
- **Example:** "department", "groups", "organization", "team"
- **Why it matters:** Automatically assigns users to existing OpenMetadata teams based on their OIDC provider attributes during login.
- **How it works:**
  - Extracts the value(s) from the specified JWT claim (e.g., if set to "department", reads user's department from the ID token)
  - For array claims (like "groups"), processes all values in the array
  - Matches the extracted value(s) against existing team names in OpenMetadata
  - Assigns the user to all matching teams that are of type "Group"
  - If a team doesn't exist or is not of type "Group", a warning is logged but authentication continues
- **OIDC Provider Configuration:**
  - Ensure the claim/attribute is included in the ID token by your OIDC provider
  - Common attributes: "department", "organization", "groups", "roles"
  - Configure custom claims in your OIDC provider's claim mapping settings
  - For group-based teams, include "groups" scope in the OIDC request
- **Note:** 
  - The team must already exist in OpenMetadata for assignment to work
  - Only teams of type "Group" can be auto-assigned (not "Organization" or "BusinessUnit" teams)
  - Team names are case-sensitive and must match exactly
  - Multiple team assignments are supported for array claims (e.g., "groups")

## <span data-id="principalDomain">Principal Domain</span>

- **Definition:** Domain to append to usernames if not present in claims.
- **Example:** company.com
- **Why it matters:** Ensures consistent user identification across systems.
- **Optional:** Only needed if usernames don't include domain information.

### <span data-id="allowedDomains">Allowed Domains</span>

- **Definition:** List of email domains that are permitted to access OpenMetadata.
- **Example:** ["company.com", "external-partner.com"]
- **Why it matters:** Provides fine-grained control over which email domains can authenticate via your OIDC provider.
- **Note:**
  - Works in conjunction with `enforcePrincipalDomain`
  - When `enforcePrincipalDomain` is enabled, only users with email addresses from these domains can access OpenMetadata
  - Leave empty or use single `principalDomain` if you only have one domain
  - Useful for multi-domain organizations or when integrating with providers that support multiple domains

## <span data-id="adminPrincipals">Admin Principals</span>

- **Definition:** List of user principals who should have admin access.
- **Example:** ["admin", "sysadmin", "john.doe"]
- **Why it matters:** Grants administrative privileges to specific users.
- **Note:** Use usernames (NOT email addresses) - these are derived from the email prefix (part before @)
- **Security:** Ensure these users are trusted administrators.

## <span data-id="selfSignup">Enable Self Signup</span>

- **Definition:** Allow new users to create accounts through OIDC authentication.
- **Default:** false
- **Why it matters:** Controls whether unknown users can automatically create accounts.
- **Security consideration:** Enable only if you trust all users from your OIDC provider.

## <span data-id="providerName">Custom Provider Name</span>

- **Definition:** Display name for your custom OIDC provider.
- **Example:** "Company SSO" or "Internal Auth"
- **Why it matters:** Shown to users on login screens and in UI.
- **Optional:** Defaults to "Custom OIDC" if not specified.

## Common OIDC Provider Examples

### Keycloak
```
Authority: https://keycloak.company.com/realms/your-realm
Client ID: openmetadata-client
Scopes: openid profile email groups
```

### Authentik
```
Authority: https://auth.company.com/application/o/openmetadata/
Client ID: your-client-id
Scopes: openid profile email groups
```

### Generic OIDC Provider
```
Authority: https://your-provider.com
Client ID: your-app-client-id
Scopes: openid profile email
```

## Troubleshooting

**Authentication fails:** Verify that your callback URL is registered with your OIDC provider and the client credentials are correct.

**Token validation errors:** Check that the token validation algorithm matches your provider and the public key/JWK URI is accessible.

**User mapping issues:** Review your JWT principal claims configuration to ensure proper user identification.
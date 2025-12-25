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

## <span data-id="callbackUrl">Callback URL</span>

- **Definition:** URL where users are redirected after authentication.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Must match the redirect URI configured in your OIDC provider.
- **Required:** Yes
- **Setup:** Add this URL to your OIDC provider's allowed redirect URIs.

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

## <span data-id="tokenValidation">Token Validation Algorithm</span>

- **Definition:** Algorithm used to validate JWT tokens from your OIDC provider.
- **Default:** RS256
- **Options:** RS256, RS384, RS512, HS256, HS384, HS512
- **Why it matters:** Must match the algorithm your OIDC provider uses to sign tokens.
- **Note:** RS256 is recommended for most providers.

## <span data-id="publicKey">Public Key / JWK URI</span>

- **Definition:** Public key or JSON Web Key Set URI for token validation.
- **Example:** https://auth.yourcompany.com/.well-known/jwks.json
- **Why it matters:** Used to verify the signature of JWT tokens.
- **Note:** Usually auto-discovered from the OIDC provider's discovery document.

## <span data-id="principals">JWT Principal Claims</span>

- **Definition:** JWT claim names that contain user principal information.
- **Default:** ["email", "preferred_username", "sub"]
- **Example:** ["email", "username", "sub"]
- **Why it matters:** Maps JWT claims to OpenMetadata user identities.

## <span data-id="principalDomain">Principal Domain</span>

- **Definition:** Domain to append to usernames if not present in claims.
- **Example:** company.com
- **Why it matters:** Ensures consistent user identification across systems.
- **Optional:** Only needed if usernames don't include domain information.

## <span data-id="adminPrincipals">Admin Principals</span>

- **Definition:** List of user principals who should have admin access.
- **Example:** ["admin@company.com", "sysadmin@company.com"]
- **Why it matters:** Grants administrative privileges to specific users.
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
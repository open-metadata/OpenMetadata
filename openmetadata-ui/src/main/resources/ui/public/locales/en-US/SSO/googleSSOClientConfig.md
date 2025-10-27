---
title: Google SSO Configuration | OpenMetadata
description: Configure Google Single Sign-On for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/google-sso
---

Google Single Sign-On (SSO) enables users to log in with their Google Workspace accounts using OAuth 2.0 and OpenID Connect (OIDC).

### <span data-id="providerName">Provider Name</span>

- **Definition:** A human-readable name for this Google SSO configuration instance.
- **Example:** Google SSO, Company Google SSO, Google Workspace
- **Why it matters:** Helps identify this specific SSO configuration in logs and user interfaces.
- **Note:** This is a display name and doesn't affect authentication functionality.

### <span data-id="clientType">Client Type</span>

- **Definition:** Defines whether the application is public (no client secret) or confidential (requires client secret).
- **Options:** Public | Confidential
- **Example:** Confidential
- **Why it matters:** Determines security level and authentication flow. Confidential clients can securely store secrets.
- **Note:**
  - Choose **Public** for SPAs and mobile apps
  - Choose **Confidential** for backend services and web applications
  - Google typically uses **Confidential** client type

### <span data-id="selfSignup">Enable Self Signup</span>

- **Definition:** Allows users to automatically create accounts on first login.
- **Options:** Enabled | Disabled
- **Example:** Enabled
- **Why it matters:** Controls whether new users can join automatically or need manual approval.
- **Note:** Disable for stricter control over user access.

### <span data-id="clientId">Client ID</span>

- **Definition:** OAuth 2.0 client ID assigned to your application in Google Cloud Console.
- **Example:** 123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
- **Why it matters:** Google uses this to identify your application during authentication.
- **Note:** Found in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs

### <span data-id="secretKey">Client Secret</span>

- **Definition:** Secret key for confidential client authentication with Google.
- **Example:** GOCSPX-abcdefghijklmnopqrstuvwxyz123456
- **Why it matters:** Required for confidential clients to securely authenticate with Google.
- **Note:**
  - Generate in Google Cloud Console → APIs & Services → Credentials
  - Store securely and rotate regularly
  - Only shown for Confidential client type

### <span data-id="callbackUrl">Callback URL</span>

- **Definition:** Redirect URI where Google sends authentication responses.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Must match exactly what's configured in Google Cloud Console, or authentication will fail.
- **Note:**
  - Must be registered in Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs
  - Always use HTTPS in production

### <span data-id="audience">Audience</span>

- **Definition:** Google OAuth 2.0 token endpoint URL for token validation.
- **Default:** https://www.googleapis.com/oauth2/v4/token
- **Example:** https://www.googleapis.com/oauth2/v4/token
- **Why it matters:** Used to verify that tokens are intended for your application.
- **Note:** Usually the default value is correct and doesn't need to be changed

### <span data-id="authority">Authority</span>

- **Definition:** Google's authorization server endpoint for OAuth 2.0 authentication.
- **Default:** https://accounts.google.com
- **Example:** https://accounts.google.com
- **Why it matters:** Specifies the Google authorization server that will handle authentication requests.
- **Note:** This is Google's standard OAuth 2.0 authorization endpoint and typically doesn't need to be changed

### <span data-id="publicKey">Public Key URLs</span>

- **Definition:** List of URLs where Google publishes its public keys for token verification.
- **Example:** ["https://www.googleapis.com/oauth2/v3/certs"]
- **Why it matters:** Used to verify JWT token signatures from Google.
- **Note:** Usually auto-discovered from the discovery URI, rarely needs manual configuration

### <span data-id="principals">JWT Principal Claims</span>

- **Definition:** JWT claims used to identify the user principal.
- **Example:** ["email", "sub", "preferred_username"]
- **Why it matters:** Determines which claim from the JWT token identifies the user.
- **Note:** Common claims: email (recommended), sub, preferred_username

### <span data-id="jwtPrincipalClaimsMapping">JWT Principal Claims Mapping</span>

- **Definition:** Maps JWT claims to OpenMetadata user attributes.
- **Example:** ["email:email", "name:name", "firstName:given_name", "lastName:family_name"]
- **Why it matters:** Controls how user information from Google maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:jwt_claim"

### <span data-id="tokenValidation">Token Validation Algorithm</span>

- **Definition:** Algorithm used to validate JWT token signatures.
- **Options:** RS256 | RS384 | RS512
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match the algorithm used by Google to sign tokens.
- **Note:** Google typically uses RS256

## OIDC Configuration (Confidential Client Only)

These fields are only shown when Client Type is set to **Confidential**.

### <span data-id="id">OIDC Client ID</span>

- **Definition:** OAuth 2.0 client ID for OIDC authentication with Google.
- **Example:** 123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
- **Why it matters:** Identifies your application to Google in OIDC flows.
- **Note:** Same as the Client ID in Google Cloud Console

### <span data-id="clientSecret">OIDC Client Secret</span>

- **Definition:** Secret key for confidential client authentication with Google.
- **Example:** GOCSPX-abcdefghijklmnopqrstuvwxyz123456
- **Why it matters:** Required for confidential clients to securely authenticate with Google.
- **Note:**
  - Generate in Google Cloud Console → APIs & Services → Credentials
  - Store securely and rotate regularly
  - Only shown for Confidential client type

### <span data-id="scopes">OIDC Request Scopes</span>

- **Definition:** Permissions requested from Google during authentication.
- **Default:** openid email profile
- **Example:** openid email profile https://www.googleapis.com/auth/userinfo.email
- **Why it matters:** Determines what user information OpenMetadata can access.
- **Note:**
  - `openid` is required for OIDC
  - `email` and `profile` provide basic user information
  - Additional scopes can be added based on requirements

### <span data-id="discoveryUri">OIDC Discovery URI</span>

- **Definition:** Google's OpenID Connect metadata endpoint.
- **Example:** https://accounts.google.com/.well-known/openid-configuration
- **Why it matters:** Allows OpenMetadata to automatically discover Google's OIDC endpoints.
- **Note:** Google's standard discovery endpoint, rarely needs to be changed

### <span data-id="useNonce">OIDC Use Nonce</span>

- **Definition:** Security feature to prevent replay attacks in OIDC flows.
- **Default:** true
- **Example:** true
- **Why it matters:** Enhances security by ensuring each authentication request is unique.
- **Note:** Generally should be left enabled for security

### <span data-id="preferredJwsAlgorithm">OIDC Preferred JWS Algorithm</span>

- **Definition:** Algorithm used to verify JWT token signatures from Google.
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match Google's token signing algorithm.
- **Note:** Google typically uses RS256, rarely needs to be changed

### <span data-id="responseType">OIDC Response Type</span>

- **Definition:** Type of response expected from Google during authentication.
- **Default:** id_token
- **Options:** id_token | code
- **Example:** id_token
- **Why it matters:** Determines the OAuth flow type (implicit vs authorization code).

### <span data-id="disablePkce">OIDC Disable PKCE</span>

- **Definition:** Whether to disable Proof Key for Code Exchange (security extension).
- **Default:** false
- **Example:** false
- **Why it matters:** PKCE adds security to the authorization code flow.
- **Note:** Should typically be left enabled (false) for security

### <span data-id="maxClockSkew">OIDC Max Clock Skew</span>

- **Definition:** Maximum allowed time difference between systems when validating tokens.
- **Example:** 0 (seconds)
- **Why it matters:** Prevents token validation failures due to minor time differences.
- **Note:** Usually 0 is fine unless you have significant clock skew issues

### <span data-id="clientAuthenticationMethod">OIDC Client Authentication Method</span>

- **Definition:** Method used to authenticate the client with Google.
- **Default:** client_secret_basic
- **Options:** client_secret_basic | client_secret_post | client_secret_jwt | private_key_jwt
- **Example:** client_secret_basic
- **Why it matters:** Must match your Google OAuth client configuration.

### <span data-id="tokenValidity">OIDC Token Validity</span>

- **Definition:** How long (in seconds) the issued tokens remain valid.
- **Default:** 0 (use provider default)
- **Example:** 3600 (1 hour)
- **Why it matters:** Controls token lifetime and security vs usability balance.

### <span data-id="customParams">OIDC Custom Parameters</span>

- **Definition:** Additional parameters to send in OIDC requests.
- **Example:** {"hd": "company.com", "prompt": "select_account"}
- **Why it matters:** Allows customization of Google authentication behavior.
- **Note:**
  - `hd`: Hosted domain (restrict to specific Google Workspace domain)
  - `prompt`: Controls authentication prompts
  - `login_hint`: Pre-fill email address

### <span data-id="callbackUrl">OIDC Callback URL</span>

- **Definition:** Redirect URI for OIDC flow authentication responses.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Must match the redirect URI configured in Google Cloud Console.
- **Note:** Must be registered in Google Cloud Console OAuth client

### <span data-id="maxAge">OIDC Max Age</span>

- **Definition:** Maximum authentication age (in seconds) before re-authentication is required.
- **Example:** 3600
- **Why it matters:** Controls how often users must re-authenticate.
- **Note:** Leave empty for no specific max age requirement

### <span data-id="prompt">OIDC Prompt</span>

- **Definition:** Controls Google's authentication prompts.
- **Options:** none | login | consent | select_account
- **Example:** select_account
- **Why it matters:** Affects user experience during authentication.
- **Note:**
  - `login`: Always prompt for credentials
  - `consent`: Prompt for permissions
  - `select_account`: Show account picker
  - `none`: Silent authentication (may fail if user isn't logged in)

### <span data-id="sessionExpiry">OIDC Session Expiry</span>

- **Definition:** How long (in seconds) user sessions remain valid.
- **Default:** 604800 (7 days)
- **Example:** 604800
- **Why it matters:** Controls how often users need to re-authenticate.
- **Note:** Only applies to confidential clients

## Authorizer Configuration

### <span data-id="adminPrincipals">Admin Principals</span>

- **Definition:** List of user principals who will have admin access.
- **Example:** ["admin@company.com", "superuser@company.com"]
- **Why it matters:** These users will have full administrative privileges in OpenMetadata.
- **Note:** Use email addresses that match the JWT principal claims

### <span data-id="principalDomain">Principal Domain</span>

- **Definition:** Default domain for user principals.
- **Example:** company.com
- **Why it matters:** Used to construct full user principals when only username is provided.
- **Note:** Typically your organization's Google Workspace domain

### <span data-id="enforcePrincipalDomain">Enforce Principal Domain</span>

- **Definition:** Whether to enforce that all users belong to the principal domain.
- **Default:** false
- **Example:** true
- **Why it matters:** Adds an extra layer of security by restricting access to users from specific domains.
- **Note:** Useful when combined with Google Workspace `hd` parameter

### <span data-id="enableSecureSocketConnection">Enable Secure Socket Connection</span>

- **Definition:** Whether to use SSL/TLS for secure connections.
- **Default:** false
- **Example:** true
- **Why it matters:** Ensures encrypted communication for security.
- **Note:** Should be enabled in production environments

## Google Workspace Specific Configuration

### Domain Restriction

To restrict access to users from a specific Google Workspace domain, add the `hd` (hosted domain) parameter to your OIDC Custom Parameters:

```json
{
  "hd": "company.com"
}
```

### Required API Scopes

Ensure the following Google APIs are enabled in your Google Cloud Console:

- Google+ API (for profile information)
- Gmail API (if email access is needed)
- Admin SDK API (if admin functions are required)

### Service Account (Optional)

For advanced integrations, you may need to create a service account in Google Cloud Console with appropriate permissions for accessing Google Workspace data.

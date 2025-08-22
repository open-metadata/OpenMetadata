---
title: Auth0 SSO Configuration | OpenMetadata
description: Configure Auth0 Single Sign-On for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/auth0-sso
---

# Auth0 SSO Configuration

Auth0 SSO enables users to log in with their Auth0 credentials using OAuth 2.0 and OpenID Connect (OIDC).

## <span data-id="clientType">Client Type</span>

- **Definition:** Defines whether the application is public (no client secret) or confidential (requires client secret).
- **Options:** Public | Confidential
- **Example:** Confidential
- **Why it matters:** Determines security level and authentication flow. Confidential clients can securely store secrets.
- **Note:**
  - Choose **Public** for SPAs and mobile apps
  - Choose **Confidential** for backend services and web applications

## <span data-id="enableSelfSignup">Enable Self Signup</span>

- **Definition:** Allows users to automatically create accounts on first login.
- **Options:** Enabled | Disabled
- **Example:** Enabled
- **Why it matters:** Controls whether new users can join automatically or need manual approval.
- **Note:** Disable for stricter control over user access.

## <span data-id="clientId">OIDC Client ID</span>

- **Definition:** Client ID assigned to your app in Auth0.
- **Example:** abc123def456ghi789jkl012mno345pqr
- **Why it matters:** Auth0 uses this to identify your application during authentication.
- **Note:** Found in Auth0 Dashboard → Applications → Your app → Settings → Basic Information

## <span data-id="callbackUrl">OIDC Callback URL</span>

- **Definition:** Redirect URI where Auth0 sends authentication responses.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Must match exactly what's configured in Auth0, or authentication will fail.
- **Note:**
  - Must be registered in Auth0 → Applications → Your app → Settings → Allowed Callback URLs
  - Always use HTTPS in production

## <span data-id="authority">Authority</span>

- **Definition:** Auth0 domain that issues tokens for your tenant.
- **Example:** https://dev-abc123.us.auth0.com or https://company.auth0.com
- **Why it matters:** Tells OpenMetadata which Auth0 tenant to authenticate against.
- **Note:** Use your full Auth0 domain URL

## <span data-id="secret">OIDC Client Secret</span>

- **Definition:** Secret key for confidential client authentication with Auth0.
- **Example:** abc123def456ghi789jkl012mno345pqr678st901uvw234xyz567abc
- **Why it matters:** Required for confidential clients to securely authenticate with Auth0.
- **Note:**
  - Only shown for Confidential client type
  - Found in Auth0 → Applications → Your app → Settings → Basic Information
  - Store securely and rotate regularly

## <span data-id="scope">OIDC Request Scopes</span>

- **Definition:** Permissions requested from Auth0 during authentication.
- **Default:** openid email profile
- **Example:** openid email profile read:users
- **Why it matters:** Determines what user information OpenMetadata can access.
- **Note:** Auth0 requires `openid` for OIDC flows, add additional scopes as needed

## <span data-id="discoveryUri">OIDC Discovery URI</span>

- **Definition:** Auth0's OpenID Connect metadata endpoint.
- **Example:** https://dev-abc123.us.auth0.com/.well-known/openid_configuration
- **Why it matters:** Allows OpenMetadata to automatically discover Auth0's OIDC endpoints.
- **Note:** Replace with your actual Auth0 domain

## <span data-id="useNonce">OIDC Use Nonce</span>

- **Definition:** Security feature to prevent replay attacks in OIDC flows.
- **Default:** true
- **Example:** true
- **Why it matters:** Enhances security by ensuring each authentication request is unique.
- **Note:** Generally should be left enabled for security

## <span data-id="preferredJwsAlgorithm">OIDC Preferred JWS Algorithm</span>

- **Definition:** Algorithm used to verify JWT token signatures from Auth0.
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match Auth0's token signing algorithm.
- **Note:** Auth0 typically uses RS256, configured in Auth0 → Applications → Advanced Settings

## <span data-id="responseType">OIDC Response Type</span>

- **Definition:** Type of response expected from Auth0 during authentication.
- **Default:** id_token
- **Options:** id_token | code
- **Example:** code
- **Why it matters:** Determines the OAuth flow type (implicit vs authorization code).
- **Note:** Authorization code flow (code) is more secure and recommended

## <span data-id="disablePkce">OIDC Disable PKCE</span>

- **Definition:** Whether to disable Proof Key for Code Exchange (security extension).
- **Default:** false
- **Example:** false
- **Why it matters:** PKCE adds security to the authorization code flow.
- **Note:** Should typically be left enabled (false) for security

## <span data-id="maxClockSkew">OIDC Max Clock Skew</span>

- **Definition:** Maximum allowed time difference between systems when validating tokens.
- **Example:** 0 (seconds)
- **Why it matters:** Prevents token validation failures due to minor time differences.
- **Note:** Usually 0 is fine unless you have significant clock skew issues

## <span data-id="clientAuthenticationMethod">OIDC Client Authentication Method</span>

- **Definition:** Method used to authenticate the client with Auth0.
- **Default:** client_secret_basic
- **Options:** client_secret_basic | client_secret_post | client_secret_jwt | private_key_jwt
- **Example:** client_secret_post
- **Why it matters:** Must match your Auth0 app configuration.
- **Note:** Auth0 supports various methods, check your app settings

## <span data-id="tokenValidity">OIDC Token Validity</span>

- **Definition:** How long (in seconds) the issued tokens remain valid.
- **Default:** 0 (use provider default)
- **Example:** 3600 (1 hour)
- **Why it matters:** Controls token lifetime and security vs usability balance.
- **Note:** Use 0 to inherit Auth0's default token lifetime

## <span data-id="customParams">OIDC Custom Parameters</span>

- **Definition:** Additional parameters to send in OIDC requests.
- **Example:** {"audience": "https://api.yourapp.com", "connection": "company-ldap"}
- **Why it matters:** Allows customization of Auth0 authentication behavior.
- **Note:** Common Auth0 parameters include `audience`, `connection`, `prompt`

## <span data-id="tenant">OIDC Tenant</span>

- **Definition:** Auth0 tenant identifier (your Auth0 domain).
- **Example:** dev-abc123.us.auth0.com or company.auth0.com
- **Why it matters:** Identifies your specific Auth0 tenant.
- **Note:** Your full Auth0 domain

## <span data-id="serverUrl">OIDC Server URL</span>

- **Definition:** Base URL for Auth0 authentication server.
- **Example:** https://dev-abc123.us.auth0.com
- **Why it matters:** Specifies the Auth0 endpoint to use.
- **Note:** Your full Auth0 domain URL

## <span data-id="maxAge">OIDC Max Age</span>

- **Definition:** Maximum authentication age (in seconds) before re-authentication is required.
- **Example:** 3600
- **Why it matters:** Controls how often users must re-authenticate.
- **Note:** Leave empty for no specific max age requirement

## <span data-id="prompt">OIDC Prompt</span>

- **Definition:** Controls Auth0's authentication prompts.
- **Options:** none | login | consent | select_account
- **Example:** login
- **Why it matters:** Affects user experience during authentication.
- **Note:**
  - `login`: Always prompt for credentials
  - `consent`: Prompt for permissions
  - `none`: Don't show prompts (SSO only)

## <span data-id="sessionExpiry">OIDC Session Expiry</span>

- **Definition:** How long (in seconds) user sessions remain valid.
- **Default:** 604800 (7 days)
- **Example:** 604800
- **Why it matters:** Controls how often users need to re-authenticate.
- **Note:** Only applies to confidential clients

## <span data-id="publicKeyUrls">Public Key URLs</span>

- **Definition:** List of URLs where Auth0 publishes its public keys for token verification.
- **Example:** ["https://dev-abc123.us.auth0.com/.well-known/jwks.json"]
- **Why it matters:** Used to verify JWT token signatures from Auth0.
- **Note:** Usually auto-discovered from the discovery URI, rarely needs manual configuration

## <span data-id="jwtPrincipalClaims">JWT Principal Claims</span>

- **Definition:** JWT claims used to identify the user principal.
- **Example:** ["email", "sub", "nickname"]
- **Why it matters:** Determines which claim from the JWT token identifies the user.
- **Note:** Common Auth0 claims: email, sub, nickname, name

## <span data-id="jwtPrincipalClaimsMapping">JWT Principal Claims Mapping</span>

- **Definition:** Maps JWT claims to OpenMetadata user attributes.
- **Example:** ["email:email", "name:name", "firstName:given_name"]
- **Why it matters:** Controls how user information from Auth0 maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:jwt_claim"

## <span data-id="tokenValidationAlgorithm">Token Validation Algorithm</span>

- **Definition:** Algorithm used to validate JWT token signatures.
- **Options:** RS256 | RS384 | RS512
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match the algorithm used by Auth0 to sign tokens.
- **Note:** Auth0 typically uses RS256

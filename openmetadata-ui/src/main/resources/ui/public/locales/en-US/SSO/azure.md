---
title: Azure AD SSO Configuration | OpenMetadata
description: Configure Azure Active Directory Single Sign-On for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/azure-ad-sso
---

# Azure AD SSO Configuration

Azure Active Directory (Azure AD) SSO enables users to log in with their Microsoft 365 / Entra ID accounts using OAuth 2.0 and OpenID Connect (OIDC).

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

- **Definition:** Application (client) ID assigned to your app in Azure AD.
- **Example:** 12345678-1234-1234-1234-123456789012
- **Why it matters:** Azure AD uses this to identify your application during authentication.
- **Note:** Found in Azure AD → App registrations → Your app → Overview → Application (client) ID

## <span data-id="callbackUrl">OIDC Callback URL</span>

- **Definition:** Redirect URI where Azure AD sends authentication responses.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Must match exactly what's configured in Azure AD, or authentication will fail.
- **Note:**
  - Must be registered in Azure AD → App registrations → Authentication → Redirect URIs
  - Always use HTTPS in production

## <span data-id="authority">Authority</span>

- **Definition:** Azure AD endpoint that issues tokens for your tenant.
- **Example:** https://login.microsoftonline.com/your-tenant-id
- **Why it matters:** Tells OpenMetadata which Azure AD tenant to authenticate against.
- **Note:**
  - Replace `your-tenant-id` with your actual Azure AD tenant ID
  - For multi-tenant apps, you can use `common` instead of tenant ID

## <span data-id="secret">OIDC Client Secret</span>

- **Definition:** Secret key for confidential client authentication with Azure AD.
- **Example:** abc123def456ghi789jkl012mno345pqr678st
- **Why it matters:** Required for confidential clients to securely authenticate with Azure AD.
- **Note:**
  - Only shown for Confidential client type
  - Generate in Azure AD → App registrations → Certificates & secrets
  - Store securely and rotate regularly

## <span data-id="scope">OIDC Request Scopes</span>

- **Definition:** Permissions requested from Azure AD during authentication.
- **Default:** openid email profile
- **Example:** openid email profile User.Read
- **Why it matters:** Determines what user information OpenMetadata can access.
- **Note:** `openid email profile` are typically sufficient for most use cases

## <span data-id="discoveryUri">OIDC Discovery URI</span>

- **Definition:** Azure AD's OpenID Connect metadata endpoint.
- **Example:** https://login.microsoftonline.com/your-tenant-id/v2.0/.well-known/openid_configuration
- **Why it matters:** Allows OpenMetadata to automatically discover Azure AD's OIDC endpoints.
- **Note:** Replace `your-tenant-id` with your actual tenant ID

## <span data-id="useNonce">OIDC Use Nonce</span>

- **Definition:** Security feature to prevent replay attacks in OIDC flows.
- **Default:** true
- **Example:** true
- **Why it matters:** Enhances security by ensuring each authentication request is unique.
- **Note:** Generally should be left enabled for security

## <span data-id="preferredJwsAlgorithm">OIDC Preferred JWS Algorithm</span>

- **Definition:** Algorithm used to verify JWT token signatures from Azure AD.
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match Azure AD's token signing algorithm.
- **Note:** Azure AD typically uses RS256, rarely needs to be changed

## <span data-id="responseType">OIDC Response Type</span>

- **Definition:** Type of response expected from Azure AD during authentication.
- **Default:** id_token
- **Options:** id_token | code
- **Example:** id_token
- **Why it matters:** Determines the OAuth flow type (implicit vs authorization code).

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

- **Definition:** Method used to authenticate the client with Azure AD.
- **Default:** client_secret_basic
- **Options:** client_secret_basic | client_secret_post | client_secret_jwt | private_key_jwt
- **Example:** client_secret_basic
- **Why it matters:** Must match your Azure AD app configuration.

## <span data-id="tokenValidity">OIDC Token Validity</span>

- **Definition:** How long (in seconds) the issued tokens remain valid.
- **Default:** 0 (use provider default)
- **Example:** 3600 (1 hour)
- **Why it matters:** Controls token lifetime and security vs usability balance.

## <span data-id="customParams">OIDC Custom Parameters</span>

- **Definition:** Additional parameters to send in OIDC requests.
- **Example:** {"prompt": "select_account", "domain_hint": "company.com"}
- **Why it matters:** Allows customization of Azure AD authentication behavior.
- **Note:** Common parameters include `prompt`, `domain_hint`, `login_hint`

## <span data-id="tenant">OIDC Tenant</span>

- **Definition:** Azure AD tenant identifier for multi-tenant applications.
- **Example:** your-tenant-id or company.onmicrosoft.com
- **Why it matters:** Specifies which Azure AD tenant to authenticate against.
- **Note:** Can be tenant ID, domain name, or "common" for multi-tenant

## <span data-id="serverUrl">OIDC Server URL</span>

- **Definition:** Base URL for Azure AD authentication server.
- **Example:** https://login.microsoftonline.com
- **Why it matters:** Specifies the Azure AD endpoint to use.
- **Note:** Usually the standard Azure AD endpoint

## <span data-id="maxAge">OIDC Max Age</span>

- **Definition:** Maximum authentication age (in seconds) before re-authentication is required.
- **Example:** 3600
- **Why it matters:** Controls how often users must re-authenticate.
- **Note:** Leave empty for no specific max age requirement

## <span data-id="prompt">OIDC Prompt</span>

- **Definition:** Controls Azure AD's authentication prompts.
- **Options:** none | login | consent | select_account
- **Example:** select_account
- **Why it matters:** Affects user experience during authentication.
- **Note:**
  - `login`: Always prompt for credentials
  - `consent`: Prompt for permissions
  - `select_account`: Show account picker

## <span data-id="sessionExpiry">OIDC Session Expiry</span>

- **Definition:** How long (in seconds) user sessions remain valid.
- **Default:** 604800 (7 days)
- **Example:** 604800
- **Why it matters:** Controls how often users need to re-authenticate.
- **Note:** Only applies to confidential clients

## <span data-id="publicKeyUrls">Public Key URLs</span>

- **Definition:** List of URLs where Azure AD publishes its public keys for token verification.
- **Example:** ["https://login.microsoftonline.com/common/discovery/v2.0/keys"]
- **Why it matters:** Used to verify JWT token signatures from Azure AD.
- **Note:** Usually auto-discovered from the discovery URI, rarely needs manual configuration

## <span data-id="jwtPrincipalClaims">JWT Principal Claims</span>

- **Definition:** JWT claims used to identify the user principal.
- **Example:** ["preferred_username", "email", "sub"]
- **Why it matters:** Determines which claim from the JWT token identifies the user.
- **Note:** Common claims: email, preferred_username, upn, sub

## <span data-id="jwtPrincipalClaimsMapping">JWT Principal Claims Mapping</span>

- **Definition:** Maps JWT claims to OpenMetadata user attributes.
- **Example:** ["email:email", "name:displayName", "firstName:given_name"]
- **Why it matters:** Controls how user information from Azure AD maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:jwt_claim"

## <span data-id="tokenValidationAlgorithm">Token Validation Algorithm</span>

- **Definition:** Algorithm used to validate JWT token signatures.
- **Options:** RS256 | RS384 | RS512
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match the algorithm used by Azure AD to sign tokens.
- **Note:** Azure AD typically uses RS256

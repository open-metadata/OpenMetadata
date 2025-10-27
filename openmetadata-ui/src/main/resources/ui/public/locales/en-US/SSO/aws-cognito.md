---
title: AWS Cognito SSO Configuration | OpenMetadata
description: Configure AWS Cognito Single Sign-On for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/aws-cognito-sso
---

# AWS Cognito SSO Configuration

AWS Cognito SSO enables users to log in with their AWS Cognito User Pool credentials using OAuth 2.0 and OpenID Connect (OIDC).

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
- **Note:** Must also be enabled in your Cognito User Pool settings.

## <span data-id="clientId">OIDC Client ID</span>

- **Definition:** App client ID from your AWS Cognito User Pool.
- **Example:** 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
- **Why it matters:** AWS Cognito uses this to identify your application during authentication.
- **Note:** Found in AWS Console → Cognito → User Pools → Your pool → App integration → App clients

## <span data-id="callbackUrl">OIDC Callback URL</span>

- **Definition:** Redirect URI where AWS Cognito sends authentication responses.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Must match exactly what's configured in Cognito, or authentication will fail.
- **Note:**
  - Must be registered in Cognito User Pool → App client → Hosted UI → Allowed callback URLs
  - Always use HTTPS in production

## <span data-id="authority">Authority</span>

- **Definition:** AWS Cognito User Pool domain that issues tokens.
- **Example:** https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF
- **Why it matters:** Tells OpenMetadata which Cognito User Pool to authenticate against.
- **Note:** Format: https://cognito-idp.{region}.amazonaws.com/{user-pool-id}

## <span data-id="secret">OIDC Client Secret</span>

- **Definition:** App client secret for confidential client authentication with AWS Cognito.
- **Example:** 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h
- **Why it matters:** Required for confidential clients to securely authenticate with Cognito.
- **Note:**
  - Only shown for Confidential client type
  - Generate in Cognito → User Pool → App client → Generate client secret
  - Store securely and rotate regularly

## <span data-id="scope">OIDC Request Scopes</span>

- **Definition:** Permissions requested from AWS Cognito during authentication.
- **Default:** openid email profile
- **Example:** openid email profile aws.cognito.signin.user.admin
- **Why it matters:** Determines what user information OpenMetadata can access.
- **Note:** Must be configured in your Cognito User Pool app client settings

## <span data-id="discoveryUri">OIDC Discovery URI</span>

- **Definition:** AWS Cognito's OpenID Connect metadata endpoint.
- **Example:** https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF/.well-known/openid_configuration
- **Why it matters:** Allows OpenMetadata to automatically discover Cognito's OIDC endpoints.
- **Note:** Replace {region} and {user-pool-id} with your actual values

## <span data-id="useNonce">OIDC Use Nonce</span>

- **Definition:** Security feature to prevent replay attacks in OIDC flows.
- **Default:** true
- **Example:** true
- **Why it matters:** Enhances security by ensuring each authentication request is unique.
- **Note:** Generally should be left enabled for security

## <span data-id="preferredJwsAlgorithm">OIDC Preferred JWS Algorithm</span>

- **Definition:** Algorithm used to verify JWT token signatures from AWS Cognito.
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match Cognito's token signing algorithm.
- **Note:** AWS Cognito uses RS256, rarely needs to be changed

## <span data-id="responseType">OIDC Response Type</span>

- **Definition:** Type of response expected from AWS Cognito during authentication.
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

- **Definition:** Method used to authenticate the client with AWS Cognito.
- **Default:** client_secret_basic
- **Options:** client_secret_basic | client_secret_post
- **Example:** client_secret_basic
- **Why it matters:** Must match your Cognito app client configuration.
- **Note:** Cognito supports basic and post methods for confidential clients

## <span data-id="tokenValidity">OIDC Token Validity</span>

- **Definition:** How long (in seconds) the issued tokens remain valid.
- **Default:** 0 (use provider default)
- **Example:** 3600 (1 hour)
- **Why it matters:** Controls token lifetime and security vs usability balance.
- **Note:** Use 0 to inherit Cognito's default token lifetime settings

## <span data-id="customParams">OIDC Custom Parameters</span>

- **Definition:** Additional parameters to send in OIDC requests.
- **Example:** {"prompt": "login", "response_type": "code"}
- **Why it matters:** Allows customization of AWS Cognito authentication behavior.
- **Note:** Common parameters include `prompt`, `response_type`, `scope`

## <span data-id="tenant">OIDC Tenant</span>

- **Definition:** AWS Cognito User Pool identifier.
- **Example:** us-east-1_ABC123DEF
- **Why it matters:** Identifies your specific Cognito User Pool.
- **Note:** Your User Pool ID from AWS Console

## <span data-id="serverUrl">OIDC Server URL</span>

- **Definition:** Base URL for AWS Cognito authentication server.
- **Example:** https://cognito-idp.us-east-1.amazonaws.com
- **Why it matters:** Specifies the Cognito endpoint to use.
- **Note:** Format: https://cognito-idp.{region}.amazonaws.com

## <span data-id="maxAge">OIDC Max Age</span>

- **Definition:** Maximum authentication age (in seconds) before re-authentication is required.
- **Example:** 3600
- **Why it matters:** Controls how often users must re-authenticate.
- **Note:** Leave empty for no specific max age requirement

## <span data-id="prompt">OIDC Prompt</span>

- **Definition:** Controls AWS Cognito's authentication prompts.
- **Options:** none | login | consent | select_account
- **Example:** login
- **Why it matters:** Affects user experience during authentication.
- **Note:**
  - `login`: Always prompt for credentials
  - `consent`: Prompt for permissions (not commonly used with Cognito)
  - `none`: Don't show prompts (SSO only)

## <span data-id="sessionExpiry">OIDC Session Expiry</span>

- **Definition:** How long (in seconds) user sessions remain valid.
- **Default:** 604800 (7 days)
- **Example:** 604800
- **Why it matters:** Controls how often users need to re-authenticate.
- **Note:** Only applies to confidential clients

## <span data-id="publicKeyUrls">Public Key URLs</span>

- **Definition:** List of URLs where AWS Cognito publishes its public keys for token verification.
- **Example:** ["https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF/.well-known/jwks.json"]
- **Why it matters:** Used to verify JWT token signatures from AWS Cognito.
- **Note:** Usually auto-discovered from the discovery URI, rarely needs manual configuration

## <span data-id="jwtPrincipalClaims">JWT Principal Claims</span>

- **Definition:** JWT claims used to identify the user principal.
- **Example:** ["cognito:username", "email", "sub"]
- **Why it matters:** Determines which claim from the JWT token identifies the user.
- **Note:** Common Cognito claims: cognito:username, email, sub, preferred_username

## <span data-id="jwtPrincipalClaimsMapping">JWT Principal Claims Mapping</span>

- **Definition:** Maps JWT claims to OpenMetadata user attributes.
- **Example:** ["email:email", "name:name", "firstName:given_name"]
- **Why it matters:** Controls how user information from AWS Cognito maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:jwt_claim"

## <span data-id="tokenValidationAlgorithm">Token Validation Algorithm</span>

- **Definition:** Algorithm used to validate JWT token signatures.
- **Options:** RS256 | RS384 | RS512
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match the algorithm used by AWS Cognito to sign tokens.
- **Note:** AWS Cognito uses RS256


# AWS Cognito SSO Configuration

AWS Cognito SSO enables users to log in with their AWS Cognito User Pool credentials using OAuth 2.0 and OpenID Connect (OIDC).

$$section
## Client Type $(id="clientType")

- **Definition:** Defines whether the application is public (no client secret) or confidential (requires client secret).
- **Options:** Public | Confidential
- **Example:** Confidential
- **Why it matters:** Determines security level and authentication flow. Confidential clients can securely store secrets.
- **Note:**
  - Choose **Public** for SPAs and mobile apps
  - Choose **Confidential** for backend services and web applications
$$

$$section
## Enable Self Signup $(id="enableSelfSignup")

- **Definition:** Allows users to automatically create accounts on first login.
- **Options:** Enabled | Disabled
- **Example:** Enabled
- **Why it matters:** Controls whether new users can join automatically or need manual approval.
- **Note:** Must also be enabled in your Cognito User Pool settings.
$$

$$section
## OIDC Client ID $(id="clientId")

- **Definition:** App client ID from your AWS Cognito User Pool.
- **Example:** 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
- **Why it matters:** AWS Cognito uses this to identify your application during authentication.
- **Note:** Found in AWS Console → Cognito → User Pools → Your pool → App integration → App clients
$$

$$section
## OIDC Callback URL $(id="callbackUrl")

- **Definition:** Redirect URI where AWS Cognito sends authentication responses.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Must match exactly what's configured in Cognito, or authentication will fail.
- **Note:**
  - Must be registered in Cognito User Pool → App client → Hosted UI → Allowed callback URLs
  - Always use HTTPS in production
$$

$$section
## Authority $(id="authority")

- **Definition:** AWS Cognito User Pool domain that issues tokens.
- **Example:** https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF
- **Why it matters:** Tells OpenMetadata which Cognito User Pool to authenticate against.
- **Note:** Format: https://cognito-idp.{region}.amazonaws.com/{user-pool-id}
$$

$$section
## OIDC Client Secret $(id="secret")

- **Definition:** App client secret for confidential client authentication with AWS Cognito.
- **Example:** 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h
- **Why it matters:** Required for confidential clients to securely authenticate with Cognito.
- **Note:**
  - Only shown for Confidential client type
  - Generate in Cognito → User Pool → App client → Generate client secret
  - Store securely and rotate regularly
$$

$$section
## OIDC Request Scopes $(id="scope")

- **Definition:** Permissions requested from AWS Cognito during authentication.
- **Default:** openid email profile
- **Example:** openid email profile aws.cognito.signin.user.admin
- **Why it matters:** Determines what user information OpenMetadata can access.
- **Note:** Must be configured in your Cognito User Pool app client settings
$$

$$section
## OIDC Discovery URI $(id="discoveryUri")

- **Definition:** AWS Cognito's OpenID Connect metadata endpoint.
- **Example:** https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF/.well-known/openid_configuration
- **Why it matters:** Allows OpenMetadata to automatically discover Cognito's OIDC endpoints.
- **Note:** Replace {region} and {user-pool-id} with your actual values
$$

$$section
## OIDC Use Nonce $(id="useNonce")

- **Definition:** Security feature to prevent replay attacks in OIDC flows.
- **Default:** false
- **Example:** false
- **Why it matters:** Enhances security by ensuring each authentication request is unique.
- **Note:** Can be enabled for additional security if your provider supports it
$$

$$section
## OIDC Preferred JWS Algorithm $(id="preferredJwsAlgorithm")

- **Definition:** Algorithm used to verify JWT token signatures from AWS Cognito.
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match Cognito's token signing algorithm.
- **Note:** AWS Cognito uses RS256, rarely needs to be changed
$$

$$section
## OIDC Response Type $(id="responseType")

- **Definition:** Type of response expected from AWS Cognito during authentication.
- **Default:** id_token
- **Options:** id_token | code
- **Example:** code
- **Why it matters:** Determines the OAuth flow type (implicit vs authorization code).
- **Note:** Authorization code flow (code) is more secure and recommended
$$

$$section
## OIDC Disable PKCE $(id="disablePkce")

- **Definition:** Whether to disable Proof Key for Code Exchange (security extension).
- **Default:** false
- **Example:** false
- **Why it matters:** PKCE adds security to the authorization code flow.
- **Note:** Should typically be left enabled (false) for security
$$

$$section
## OIDC Max Clock Skew $(id="maxClockSkew")

- **Definition:** Maximum allowed time difference between systems when validating tokens.
- **Example:** 0 (seconds)
- **Why it matters:** Prevents token validation failures due to minor time differences.
- **Note:** Usually 0 is fine unless you have significant clock skew issues
$$

$$section
## OIDC Client Authentication Method $(id="clientAuthenticationMethod")

- **Definition:** Method used to authenticate the client with AWS Cognito.
- **Default:** client_secret_post (automatically configured)
- **Why it matters:** OpenMetadata uses `client_secret_post` which is supported by AWS Cognito.
- **Note:** This field is hidden and automatically configured. Cognito supports both `client_secret_post` and `client_secret_basic`.
$$

$$section
## OIDC Token Validity $(id="tokenValidity")

- **Definition:** How long (in seconds) the issued tokens remain valid.
- **Default:** 0 (use provider default)
- **Example:** 3600 (1 hour)
- **Why it matters:** Controls token lifetime and security vs usability balance.
- **Note:** Use 0 to inherit Cognito's default token lifetime settings
$$

$$section
## OIDC Custom Parameters $(id="customParams")

- **Definition:** Additional parameters to send in OIDC requests.
- **Example:** {"prompt": "login", "response_type": "code"}
- **Why it matters:** Allows customization of AWS Cognito authentication behavior.
- **Note:** Common parameters include `prompt`, `response_type`, `scope`
$$

$$section
## OIDC Tenant $(id="tenant")

- **Definition:** AWS Cognito User Pool identifier.
- **Example:** us-east-1_ABC123DEF
- **Why it matters:** Identifies your specific Cognito User Pool.
- **Note:** Your User Pool ID from AWS Console
$$

$$section
## OIDC Max Age $(id="maxAge")

- **Definition:** Maximum authentication age (in seconds) before re-authentication is required.
- **Example:** 3600
- **Why it matters:** Controls how often users must re-authenticate.
- **Note:** Leave empty for no specific max age requirement
$$

$$section
## OIDC Prompt $(id="prompt")

- **Definition:** Controls AWS Cognito's authentication prompts.
- **Options:** none | login | consent | select_account
- **Example:** login
- **Why it matters:** Affects user experience during authentication.
- **Note:**
  - `login`: Always prompt for credentials
  - `consent`: Prompt for permissions (not commonly used with Cognito)
  - `none`: Don't show prompts (SSO only)
$$

$$section
## OIDC Session Expiry $(id="sessionExpiry")

- **Definition:** How long (in seconds) user sessions remain valid.
- **Default:** 604800 (7 days)
- **Example:** 604800
- **Why it matters:** Controls how often users need to re-authenticate.
- **Note:** Only applies to confidential clients
$$

$$section
## Public Key URLs $(id="publicKeyUrls")

- **Definition:** List of URLs where AWS Cognito publishes its public keys for token verification.
- **Example:** ["https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF/.well-known/jwks.json"]
- **Why it matters:** Used to verify JWT token signatures from AWS Cognito.
- **Note:** Usually auto-discovered from the discovery URI, rarely needs manual configuration
$$

$$section
## JWT Principal Claims $(id="jwtPrincipalClaims")

> ⚠️ **CRITICAL WARNING**: Incorrect claims will **lock out ALL users including admins**!
> - These claims MUST exist in JWT tokens from AWS Cognito
> - Order matters: first matching claim is used for user identification
> - **Default values (email, cognito:username, sub) work for most Cognito configurations**
> - Only change if you have custom claim requirements

- **Definition:** JWT claims used to identify the user principal.
- **Default:** ["email", "cognito:username", "sub"] (recommended)
- **Example:** ["cognito:username", "email", "sub"]
- **Why it matters:** Determines which claim from the JWT token identifies the user.
- **Note:** Common Cognito claims: cognito:username, email, sub, preferred_username
$$

$$section
## JWT Principal Claims Mapping $(id="jwtPrincipalClaimsMapping")

- **Definition:** Maps JWT claims to OpenMetadata user attributes.
- **Example:** ["email:email", "username:cognito:username"]
- **Why it matters:** Controls how user information from AWS Cognito maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:jwt_claim"
- **Validation Requirements:**
  - Both `username` and `email` mappings must be present when this field is used
  - Only `username` and `email` keys are allowed; no other keys are permitted
  - If validation fails, errors will be displayed on this specific field
$$

$$section
## Token Validation Algorithm $(id="tokenValidationAlgorithm")

- **Definition:** Algorithm used to validate JWT token signatures.
- **Options:** RS256 | RS384 | RS512
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match the algorithm used by AWS Cognito to sign tokens.
- **Note:** AWS Cognito uses RS256
$$
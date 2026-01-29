---
title: AWS Cognito SSO Configuration | OpenMetadata
description: Configure AWS Cognito Single Sign-On for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/aws-cognito-sso
---

# AWS Cognito SSO Configuration

AWS Cognito SSO enables users to log in with their AWS Cognito User Pool credentials using OAuth 2.0 and OpenID Connect (OIDC).

## <span data-id="providerName">Provider Name</span>

- **Definition:** A human-readable name for this AWS Cognito SSO configuration instance.
- **Example:** AWS Cognito SSO, Company Cognito, User Pool Authentication
- **Why it matters:** Helps identify this specific SSO configuration in logs and user interfaces.
- **Note:** This is a display name and doesn't affect authentication functionality.

## <span data-id="clientType">Client Type</span>

- **Definition:** Defines whether the application is public (no client secret) or confidential (requires client secret).
- **Options:** Public | Confidential
- **Example:** Confidential
- **Why it matters:** Determines security level and authentication flow. Confidential clients can securely store secrets.
- **Note:**
  - Choose **Public** for SPAs and mobile apps
  - Choose **Confidential** for backend services and web applications

## <span data-id="selfSignup">Enable Self Signup</span>

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

## <span data-id="callbackUrl">OIDC Callback URL / Redirect URI</span>

- **Definition:** URL where AWS Cognito redirects after authentication.
- **Auto-Generated:** This field is automatically populated as `{your-domain}/callback`.
- **Example:** https://openmetadata.company.com/callback
- **Why it matters:** Must be registered in your AWS Cognito configuration.
- **Note:**
  - **This field is read-only** - it cannot be edited
  - **Copy this exact URL** and add it to AWS Cognito's allowed redirect URIs list
  - Format is always: `{your-domain}/callback`

## <span data-id="authority">Authority</span>

- **Definition:** AWS Cognito User Pool domain that issues tokens.
- **Example:** https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF
- **Why it matters:** Tells OpenMetadata which Cognito User Pool to authenticate against.
- **Note:** Format: https://cognito-idp.{region}.amazonaws.com/{user-pool-id}

## <span data-id="clientSecret">OIDC Client Secret</span>

- **Definition:** App client secret for confidential client authentication with AWS Cognito.
- **Example:** 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h
- **Why it matters:** Required for confidential clients to securely authenticate with Cognito.
- **Note:**
  - Only shown for Confidential client type
  - Generate in Cognito → User Pool → App client → Generate client secret
  - Store securely and rotate regularly

## <span data-id="scopes">OIDC Request Scopes</span>

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
- **Default:** false
- **Example:** false
- **Why it matters:** Enhances security by ensuring each authentication request is unique.
- **Note:** Can be enabled for additional security if your provider supports it



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
- **Default:** client_secret_post (automatically configured)
- **Why it matters:** OpenMetadata uses `client_secret_post` which is supported by AWS Cognito.
- **Note:** This field is hidden and automatically configured. Cognito supports both `client_secret_post` and `client_secret_basic`.

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

## <span data-id="publicKey">Public Key URLs</span>

- **Definition:** List of URLs where AWS Cognito publishes its public keys for token verification.
- **Example:** ["https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF/.well-known/jwks.json"]
- **Why it matters:** Used to verify JWT token signatures from AWS Cognito.
- **Note:** Usually auto-discovered from the discovery URI, rarely needs manual configuration

## <span data-id="principals">JWT Principal Claims</span>

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
  - Order matters - first matching claim is used

## <span data-id="jwtPrincipalClaimsMapping">JWT Principal Claims Mapping</span>

- **Definition:** Maps JWT claims to OpenMetadata user attributes. (Overrides JWT Principal Claims if set)
- **Example:** ["email:email", "username:preferred_username"]
- **Why it matters:** Controls how user information from AWS Cognito maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:jwt_claim"
- **Validation Requirements:**
  - Both `username` and `email` mappings must be present when this field is used
  - Only `username` and `email` keys are allowed; no other keys are permitted
  - If validation fails, errors will be displayed on this specific field
- **Important:** JWT Principal Claims Mapping is **rarely needed** for most AWS Cognito configurations. The default JWT Principal Claims (`email`, `cognito:username`, `sub`) handle user identification correctly. Only configure this if you have specific custom claim requirements.

## <span data-id="jwtTeamClaimMapping">JWT Team Claim Mapping</span>

- **Definition:** AWS Cognito claim or attribute containing team/department information for automatic team assignment.
- **Example:** "custom:department", "custom:organization", "cognito:groups"
- **Why it matters:** Automatically assigns users to existing OpenMetadata teams based on their Cognito user attributes during login.
- **How it works:**
  - Extracts the value(s) from the specified Cognito claim (e.g., if set to "custom:department", reads user's department from Cognito)
  - For array claims (like "cognito:groups"), processes all values in the array
  - Matches the extracted value(s) against existing team names in OpenMetadata
  - Assigns the user to all matching teams that are of type "Group"
  - If a team doesn't exist or is not of type "Group", a warning is logged but authentication continues
- **AWS Cognito Configuration:**
  - Custom attributes must be prefixed with "custom:" (e.g., "custom:department")
  - Configure custom attributes in Cognito User Pool → Attributes
  - For group-based teams, use "cognito:groups" claim (requires user pool groups configured)
  - Ensure custom attributes are included in the ID token
- **Note:**
  - The team must already exist in OpenMetadata for assignment to work
  - Only teams of type "Group" can be auto-assigned (not "Organization" or "BusinessUnit" teams)
  - Team names are case-sensitive and must match exactly
  - Multiple team assignments are supported for array claims (e.g., "cognito:groups")

## Authorizer Configuration

### <span data-id="adminPrincipals">Admin Principals</span>

- **Definition:** List of user principals who will have admin access.
- **Example:** ["admin", "superuser", "john.doe"]
- **Why it matters:** These users will have full administrative privileges in OpenMetadata.
- **Note:** Use usernames (NOT email addresses) - these are derived from the email prefix (part before @)

### <span data-id="principalDomain">Principal Domain</span>

- **Definition:** Default domain for user principals.
- **Example:** company.com
- **Why it matters:** Used to construct full user principals when only username is provided.
- **Note:** Typically your organization's primary domain

### <span data-id="enforcePrincipalDomain">Enforce Principal Domain</span>

- **Definition:** Whether to enforce that all users belong to the principal domain.
- **Default:** false
- **Example:** true
- **Why it matters:** Adds an extra layer of security by restricting access to users from specific domains.

### <span data-id="allowedDomains">Allowed Domains</span>

- **Definition:** List of email domains that are permitted to access OpenMetadata.
- **Example:** ["company.com", "partner.com"]
- **Why it matters:** Provides fine-grained control over which email domains can authenticate via AWS Cognito.
- **Note:**
  - Works in conjunction with `enforcePrincipalDomain`
  - When `enforcePrincipalDomain` is enabled, only users with email addresses from these domains can access OpenMetadata
  - Leave empty or use single `principalDomain` if you only have one Cognito User Pool
  - Useful when your User Pool contains users from multiple domains

### <span data-id="enableSecureSocketConnection">Enable Secure Socket Connection</span>

- **Definition:** Whether to use SSL/TLS for secure connections.
- **Default:** false
- **Example:** true
- **Why it matters:** Ensures encrypted communication for security.
- **Note:** Should be enabled in production environments


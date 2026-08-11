
Okta SSO enables users to log in with their Okta credentials using OAuth 2.0 and OpenID Connect (OIDC).

## Authentication Configuration

$$section
### Provider Name $(id="providerName")

- **Definition:** A human-readable name for this Okta SSO configuration instance.
- **Example:** Okta SSO, Company Okta, Corporate Identity
- **Why it matters:** Helps identify this specific SSO configuration in logs and user interfaces.
- **Note:** This is a display name and doesn't affect authentication functionality.
$$

$$section
### Client Type $(id="clientType")

- **Definition:** Defines whether the application is public (no client secret) or confidential (requires client secret).
- **Options:** Public | Confidential
- **Example:** Confidential
- **Why it matters:** Determines security level and authentication flow. Confidential clients can securely store secrets.
- **Note:**
  - Choose **Public** for SPAs and mobile apps
  - Choose **Confidential** for backend services and web applications
  - Okta typically uses **Confidential** client type
$$

$$section
### Enable Self Signup $(id="selfSignup")

- **Definition:** Allows users to automatically create accounts on first login.
- **Options:** Enabled | Disabled
- **Example:** Enabled
- **Why it matters:** Controls whether new users can join automatically or need manual approval.
- **Note:** Disable for stricter control over user access.
$$

$$section
### Client ID $(id="clientId")

- **Definition:** Client ID assigned to your app in Okta.
- **Example:** 0oabc123def456ghi789
- **Why it matters:** Okta uses this to identify your application during authentication.
- **Note:** Found in Okta Admin Console → Applications → Your app → General → Client ID
$$

$$section
### Callback URL $(id="callbackUrl")

- **Definition:** Redirect URI where Okta sends authentication responses.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Must match exactly what's configured in Okta, or authentication will fail.
- **Note:**
  - Must be registered in Okta → Applications → Your app → General → Sign-in redirect URIs
  - Always use HTTPS in production
$$

$$section
### Authority $(id="authority")

- **Definition:** Okta domain that issues tokens for your organization.
- **Example:** https://dev-123456.okta.com or https://company.okta.com
- **Why it matters:** Tells OpenMetadata which Okta org to authenticate against.
- **Note:** Use your full Okta domain URL
$$

$$section
### Public Key URLs $(id="publicKey")

- **Definition:** List of URLs where Okta publishes its public keys for token verification.
- **Example:** ["https://dev-123456.okta.com/oauth2/v1/keys"]
- **Why it matters:** Used to verify JWT token signatures from Okta.
- **Note:** Usually auto-discovered from the discovery URI, rarely needs manual configuration
$$

$$section
### JWT Principal Claims $(id="principals")

> ⚠️ **CRITICAL WARNING**: Incorrect claims will **lock out ALL users including admins**!
> - These claims MUST exist in JWT tokens from Okta
> - Order matters: first matching claim is used for user identification
> - **Default values (email, preferred_username, sub) work for most Okta configurations**
> - Only change if you have custom claim requirements

- **Definition:** JWT claims used to identify the user principal.
- **Default:** ["email", "preferred_username", "sub"] (recommended)
- **Example:** ["preferred_username", "email", "sub"]
- **Why it matters:** Determines which claim from the JWT token identifies the user.
- **Note:** Common Okta claims: email, preferred_username, sub, login
  - Order matters; first matching claim is used
$$

$$section
### JWT Principal Claims Mapping $(id="jwtPrincipalClaimsMapping")

- **Definition:** Maps JWT claims to OpenMetadata user attributes. (Overrides JWT Principal Claims if set)
- **Example:** ["email:email", "username:preferred_username"]
- **Why it matters:** Controls how user information from Okta maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:jwt_claim"
- **Validation Requirements:**
  - Both `username` and `email` mappings must be present when this field is used
  - Only `username` and `email` keys are allowed; no other keys are permitted
  - If validation fails, errors will be displayed on this specific field
- **Important:** JWT Principal Claims Mapping is **rarely needed** for most Okta configurations. The default JWT Principal Claims (`email`, `preferred_username`, `sub`) handle user identification correctly. Only configure this if you have specific custom claim requirements.
$$

$$section
### JWT Team Claim Mapping $(id="jwtTeamClaimMapping")

- **Definition:** Okta claim or attribute containing team/department information for automatic team assignment.
- **Example:** "department", "groups", "division", or custom profile attributes
- **Why it matters:** Automatically assigns users to existing OpenMetadata teams based on their Okta user profile during login.
- **How it works:**
  - Extracts the value(s) from the specified Okta claim (e.g., if set to "department", reads user's department from Okta)
  - For array claims (like "groups"), processes all values in the array
  - Matches the extracted value(s) against existing team names in OpenMetadata
  - Assigns the user to all matching teams that are of type "Group"
  - If a team doesn't exist or is not of type "Group", a warning is logged but authentication continues
- **Okta Configuration:**
  - Common user profile attributes: "department", "division", "organization"
  - Custom profile attributes can be configured in Okta → Directory → Profile Editor
  - For group-based teams, use "groups" claim (requires group membership in scope)
  - Ensure the attribute is included in the ID token by configuring claim mappings in Okta
- **Note:** 
  - The team must already exist in OpenMetadata for assignment to work
  - Only teams of type "Group" can be auto-assigned (not "Organization" or "BusinessUnit" teams)
  - Team names are case-sensitive and must match exactly
  - Multiple team assignments are supported for array claims (e.g., "groups")


## OIDC Configuration (Confidential Client Only)

These fields are only shown when Client Type is set to **Confidential**.
$$

$$section
### OIDC Client ID $(id="id")

- **Definition:** Client ID for OIDC authentication with Okta.
- **Example:** 0oabc123def456ghi789
- **Why it matters:** Identifies your application to Okta in OIDC flows.
- **Note:** Same as the Client ID from your Okta app registration
$$

$$section
### OIDC Client Secret $(id="clientSecret")

- **Definition:** Secret key for confidential client authentication with Okta.
- **Example:** abc123def456ghi789jkl012mno345pqr678st
- **Why it matters:** Required for confidential clients to securely authenticate with Okta.
- **Note:**
  - Generate in Okta → Applications → Your app → General → Client secret
  - Store securely and rotate regularly
  - Only shown for Confidential client type
$$

$$section
### OIDC Request Scopes $(id="scopes")

- **Definition:** Permissions requested from Okta during authentication.
- **Default:** openid email profile
- **Example:** openid email profile groups
- **Why it matters:** Determines what user information OpenMetadata can access.
- **Note:** Add `groups` scope if you need group information for authorization
$$

$$section
### OIDC Discovery URI $(id="discoveryUri")

- **Definition:** Okta's OpenID Connect metadata endpoint.
- **Example:** https://dev-123456.okta.com/.well-known/openid-configuration
- **Why it matters:** Allows OpenMetadata to automatically discover Okta's OIDC endpoints.
- **Note:** Replace with your actual Okta domain
$$

$$section
### OIDC Use Nonce $(id="useNonce")

- **Definition:** Security feature to prevent replay attacks in OIDC flows.
- **Default:** false
- **Example:** false
- **Why it matters:** Enhances security by ensuring each authentication request is unique.
- **Note:** Can be enabled for additional security if your provider supports it
$$

$$section
### OIDC Disable PKCE $(id="disablePkce")

- **Definition:** Whether to disable Proof Key for Code Exchange (security extension).
- **Default:** false
- **Example:** false
- **Why it matters:** PKCE adds security to the authorization code flow.
- **Note:** Should typically be left enabled (false) for security
$$

$$section
### OIDC Max Clock Skew $(id="maxClockSkew")

- **Definition:** Maximum allowed time difference between systems when validating tokens.
- **Example:** 0 (seconds)
- **Why it matters:** Prevents token validation failures due to minor time differences.
- **Note:** Usually 0 is fine unless you have significant clock skew issues
$$

$$section
### OIDC Client Authentication Method $(id="clientAuthenticationMethod")

- **Definition:** Method used to authenticate the client with Okta.
- **Default:** client_secret_post
- **Options:** client_secret_basic | client_secret_post | client_secret_jwt | private_key_jwt
- **Example:** client_secret_post
- **Why it matters:** Must match your Okta app configuration.
$$

$$section
### OIDC Token Validity $(id="tokenValidity")

- **Definition:** How long (in seconds) the issued tokens remain valid.
- **Default:** 0 (use provider default)
- **Example:** 3600 (1 hour)
- **Why it matters:** Controls token lifetime and security vs usability balance.
- **Note:** Use 0 to inherit Okta's default token lifetime
$$

$$section
### OIDC Custom Parameters $(id="customParams")

- **Definition:** Additional parameters to send in OIDC requests.
- **Example:** {"prompt": "login", "max_age": "3600"}
- **Why it matters:** Allows customization of Okta authentication behavior.
- **Note:** Common parameters include `prompt`, `max_age`, `login_hint`
$$

$$section
### OIDC Callback URL / Redirect URI $(id="callbackUrl")

- **Definition:** URL where Okta redirects after authentication.
- **Auto-Generated:** This field is automatically populated as `{your-domain}/callback`.
- **Example:** https://openmetadata.company.com/callback
- **Why it matters:** Must be registered in your Okta configuration.
- **Note:**
  - **This field is read-only** - it cannot be edited
  - **Copy this exact URL** and add it to Okta's allowed redirect URIs list
  - Format is always: `{your-domain}/callback`
$$

$$section
### OIDC Max Age $(id="maxAge")

- **Definition:** Maximum authentication age (in seconds) before re-authentication is required.
- **Example:** 3600
- **Why it matters:** Controls how often users must re-authenticate.
- **Note:** Leave empty for no specific max age requirement
$$

$$section
### OIDC Prompt $(id="prompt")

- **Definition:** Controls Okta's authentication prompts.
- **Options:** none | login | consent | select_account
- **Example:** login
- **Why it matters:** Affects user experience during authentication.
- **Note:**
  - `login`: Always prompt for credentials
  - `consent`: Prompt for permissions
  - `none`: Don't show prompts (SSO only)
$$

$$section
### OIDC Session Expiry $(id="sessionExpiry")

- **Definition:** How long (in seconds) user sessions remain valid.
- **Default:** 604800 (7 days)
- **Example:** 604800
- **Why it matters:** Controls how often users need to re-authenticate.
- **Note:** Only applies to confidential clients

## Authorizer Configuration
$$

$$section
### Admin Principals $(id="adminPrincipals")

- **Definition:** List of user principals who will have admin access.
- **Example:** ["admin", "superuser"]
- **Why it matters:** These users will have full administrative privileges in OpenMetadata.
- **Note:** Use usernames (NOT email addresses) - these are derived from the email prefix (part before @)
$$

$$section
### Principal Domain $(id="principalDomain")

- **Definition:** Default domain for user principals.
- **Example:** company.com
- **Why it matters:** Used to construct full user principals when only username is provided.
- **Note:** Typically your organization's primary domain
$$

$$section
### Enforce Principal Domain $(id="enforcePrincipalDomain")

- **Definition:** Whether to enforce that all users belong to the principal domain.
- **Default:** false
- **Example:** true
- **Why it matters:** Adds an extra layer of security by restricting access to users from specific domains.
$$

$$section
### Allowed Domains $(id="allowedDomains")

- **Definition:** List of email domains that are permitted to access OpenMetadata.
- **Example:** ["company.com", "partner.com"]
- **Why it matters:** Provides fine-grained control over which email domains can authenticate via Okta.
- **Note:**
  - Works in conjunction with `enforcePrincipalDomain`
  - When `enforcePrincipalDomain` is enabled, only users with email addresses from these domains can access OpenMetadata
  - Leave empty or use single `principalDomain` if you only have one Okta org
  - Useful when your Okta org contains users from multiple domains
$$

$$section
### Enable Secure Socket Connection $(id="enableSecureSocketConnection")

- **Definition:** Whether to use SSL/TLS for secure connections.
- **Default:** false
- **Example:** true
- **Why it matters:** Ensures encrypted communication for security.
- **Note:** Should be enabled in production environments
$$
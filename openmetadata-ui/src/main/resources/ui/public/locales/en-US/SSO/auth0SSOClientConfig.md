
# Auth0 SSO Configuration

Auth0 Active Directory (Auth0) SSO enables users to log in with their Auth0 accounts using OAuth 2.0 and OpenID Connect (OIDC).

## Authentication Configuration

$$section
### Provider Name $(id="providerName")

- **Definition:** A human-readable name for this Auth0 SSO configuration instance.
- **Example:** Auth0 SSO, Company Auth0, Custom Identity Provider
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
  - Auth0 typically uses **Confidential** client type
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

- **Definition:** Application (client) ID assigned to your app in Auth0.
- **Example:** abc123def456ghi789jkl012mno345pqr
- **Why it matters:** Auth0 uses this to identify your application during authentication.
- **Note:** Found in Auth0 → Applications → Your app → Overview → Application (client) ID
$$

$$section
### Callback URL $(id="callbackUrl")

- **Definition:** Redirect URI where Auth0 sends authentication responses.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Must match exactly what's configured in Auth0, or authentication will fail.
- **Note:**
  - Must be registered in Auth0 → Applications → Authentication → Redirect URIs
  - Always use HTTPS in production
$$

$$section
### Authority $(id="authority")

- **Definition:** Auth0 endpoint that issues tokens for your tenant.
- **Example:** https://dev-abc123.us.auth0.com/your-auth0-domain
- **Why it matters:** Tells OpenMetadata which Auth0 tenant to authenticate against.
- **Note:**
  - Replace `your-auth0-domain` with your actual Auth0 tenant ID
  - For multi-tenant apps, you can use `common` instead of tenant ID
$$

$$section
### Public Key URLs $(id="publicKey")

- **Definition:** List of URLs where Auth0 publishes its public keys for token verification.
- **Example:** ["https://dev-abc123.us.auth0.com/common/discovery/v2.0/keys"]
- **Why it matters:** Used to verify JWT token signatures from Auth0.
- **Note:** Usually auto-discovered from the discovery URI, rarely needs manual configuration
$$

$$section
### JWT Principal Claims $(id="principals")

> ⚠️ **CRITICAL WARNING**: Incorrect claims will **lock out ALL users including admins**!
> - These claims MUST exist in JWT tokens from Auth0
> - Order matters: first matching claim is used for user identification
> - **Default values (email, name, sub) work for most Auth0 configurations**
> - Only change if you have custom claim requirements

- **Definition:** JWT claims used to identify the user principal.
- **Default:** ["email", "name", "sub"] (recommended)
- **Example:** ["email", "name", "sub"]
- **Why it matters:** Determines which claim from the JWT token identifies the user.
- **Note:** Common Auth0 claims: email, name, sub, nickname
  - Order matters; first matching claim is used
$$

$$section
### JWT Principal Claims Mapping $(id="jwtPrincipalClaimsMapping")

- **Definition:** Maps JWT claims to OpenMetadata user attributes. (Overrides jwtPrincipalClaims if set)
- **Example:** ["email:email", "username:preferred_username"]
- **Why it matters:** Controls how user information from Auth0 maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:jwt_claim"
- **Validation Requirements:**
  - Both `username` and `email` mappings must be present when this field is used
  - Only `username` and `email` keys are allowed; no other keys are permitted
  - If validation fails, errors will be displayed on this specific field
- **Important:** JWT Principal Claims Mapping is **rarely needed** for most Auth0 configurations. The default JWT Principal Claims (`email`, `name`, `sub`) handle user identification correctly. Only configure this if you have specific custom claim requirements.
$$

$$section
### JWT Team Claim Mapping $(id="jwtTeamClaimMapping")

- **Definition:** Auth0 claim or attribute containing team/department information for automatic team assignment.
- **Example:** "department", "groups", "organization", or custom user metadata fields
- **Why it matters:** Automatically assigns users to existing OpenMetadata teams based on their Auth0 user profile during login.
- **How it works:**
  - Extracts the value(s) from the specified Auth0 claim (e.g., if set to "department", reads user's department from Auth0)
  - For array claims (like "groups"), processes all values in the array
  - Matches the extracted value(s) against existing team names in OpenMetadata
  - Assigns the user to all matching teams that are of type "Group"
  - If a team doesn't exist or is not of type "Group", a warning is logged but authentication continues
- **Auth0 Configuration:**
  - Standard user profile fields: "department", "organization"
  - Custom user metadata can be configured in Auth0 → User Management → Users → User Details
  - For group/role-based teams, use "groups" or "roles" claims
  - Add custom claims via Auth0 Rules or Actions to include in JWT tokens
- **Note:** 
  - The team must already exist in OpenMetadata for assignment to work
  - Only teams of type "Group" can be auto-assigned (not "Organization" or "BusinessUnit" teams)
  - Team names are case-sensitive and must match exactly
  - Multiple team assignments are supported for array claims (e.g., "groups" or "roles")


## OIDC Configuration (Confidential Client Only)

These fields are only shown when Client Type is set to **Confidential**.
$$

$$section
### OIDC Client ID $(id="id")

- **Definition:** Application (client) ID for OIDC authentication with Auth0.
- **Example:** abc123def456ghi789jkl012mno345pqr
- **Why it matters:** Identifies your application to Auth0 in OIDC flows.
- **Note:** Same as the Client ID in Auth0 app registration
$$

$$section
### OIDC Client Secret $(id="clientSecret")

- **Definition:** Secret key for confidential client authentication with Auth0.
- **Example:** abc123def456ghi789jkl012mno345pqr678st
- **Why it matters:** Required for confidential clients to securely authenticate with Auth0.
- **Note:**
  - Generate in Auth0 → Applications → Certificates & secrets
  - Store securely and rotate regularly
  - Only shown for Confidential client type
$$

$$section
### OIDC Request Scopes $(id="scopes")

- **Definition:** Permissions requested from Auth0 during authentication.
- **Default:** openid email profile
- **Example:** openid email profile User.Read
- **Why it matters:** Determines what user information OpenMetadata can access.
- **Note:** `openid email profile` are typically sufficient for most use cases
$$

$$section
### OIDC Discovery URI $(id="discoveryUri")

- **Definition:** Auth0's OpenID Connect metadata endpoint.
- **Example:** https://dev-abc123.us.auth0.com/your-auth0-domain/v2.0/.well-known/openid-configuration
- **Why it matters:** Allows OpenMetadata to automatically discover Auth0's OIDC endpoints.
- **Note:** Replace `your-auth0-domain` with your actual tenant ID
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

- **Definition:** Method used to authenticate the client with Auth0.
- **Default:** client_secret_post (automatically configured)
- **Why it matters:** OpenMetadata uses `client_secret_post` which is supported by Auth0.
- **Note:** This field is hidden and automatically configured. Auth0 supports both `client_secret_post` and `client_secret_basic`.
$$

$$section
### OIDC Token Validity $(id="tokenValidity")

- **Definition:** How long (in seconds) the issued tokens remain valid.
- **Default:** 0 (use provider default)
- **Example:** 3600 (1 hour)
- **Why it matters:** Controls token lifetime and security vs usability balance.
$$

$$section
### OIDC Custom Parameters $(id="customParams")

- **Definition:** Additional parameters to send in OIDC requests.
- **Example:** {"prompt": "select_account", "domain_hint": "company.com"}
- **Why it matters:** Allows customization of Auth0 authentication behavior.
- **Note:** Common parameters include `prompt`, `domain_hint`, `login_hint`
$$

$$section
### OIDC Callback URL / Redirect URI $(id="callbackUrl")

- **Definition:** URL where Auth0 redirects after authentication.
- **Auto-Generated:** This field is automatically populated as `{your-domain}/callback`.
- **Example:** https://openmetadata.company.com/callback
- **Why it matters:** Must be registered in your Auth0 configuration.
- **Note:**
  - **This field is read-only** - it cannot be edited
  - **Copy this exact URL** and add it to Auth0's allowed redirect URIs list
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

- **Definition:** Controls Auth0's authentication prompts.
- **Options:** none | login | consent | select_account
- **Example:** select_account
- **Why it matters:** Affects user experience during authentication.
- **Note:**
  - `login`: Always prompt for credentials
  - `consent`: Prompt for permissions
  - `select_account`: Show account picker
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
- **Example:** ["company.com", "partner-company.com"]
- **Why it matters:** Provides fine-grained control over which email domains can authenticate via Auth0.
- **Note:**
  - Works in conjunction with `enforcePrincipalDomain`
  - When `enforcePrincipalDomain` is enabled, only users with email addresses from these domains can access OpenMetadata
  - Leave empty or use single `principalDomain` if you only have one Auth0 tenant
  - Useful when your Auth0 tenant contains users from multiple domains
$$

$$section
### Enable Secure Socket Connection $(id="enableSecureSocketConnection")

- **Definition:** Whether to use SSL/TLS for secure connections.
- **Default:** false
- **Example:** true
- **Why it matters:** Ensures encrypted communication for security.
- **Note:** Should be enabled in production environments
$$
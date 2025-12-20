# MCP OAuth Integration with OpenMetadata SSO

## Overview

This document describes the complete OAuth 2.1 integration between the MCP (Model Context Protocol) server and OpenMetadata's existing SSO authentication system. The implementation allows MCP clients (like Claude Desktop) to authenticate users through OpenMetadata's configured identity providers (Google, Okta, Azure AD, SAML, etc.).

## Architecture

### Component Flow

```
MCP Client (Claude Desktop)
  ↓
/mcp/authorize (OAuth authorization request)
  ↓
OpenMetadataAuthProvider redirects to OpenMetadata SSO
  ↓
/api/v1/auth/login (OpenMetadata login endpoint)
  ↓
User authenticates with configured IdP (Google/Okta/Azure/SAML)
  ↓
OpenMetadata creates user session
  ↓
/api/v1/mcp/auth/callback (MCP OAuth callback endpoint)
  ↓
Generate authorization code
  ↓
Redirect to MCP client with authorization code
  ↓
MCP Client exchanges code for access token at /mcp/token
  ↓
OpenMetadataAuthProvider issues real OpenMetadata JWT token
  ↓
MCP Client uses JWT token to access /mcp/* endpoints
```

## Key Components

### 1. OpenMetadataAuthProvider

**Location:** `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/provider/OpenMetadataAuthProvider.java`

**Purpose:** Bridges OAuth 2.1 protocol with OpenMetadata's authentication system.

**Key Features:**
- Implements `OAuthAuthorizationServerProvider` interface
- Redirects authorization requests to OpenMetadata SSO login
- Generates authorization codes after successful SSO authentication
- Issues access tokens using OpenMetadata's `JWTTokenGenerator`
- Tokens include user roles, email, admin status, and audience claims

**Token Generation:**
```java
JWTAuthMechanism jwtAuthMechanism = JWTTokenGenerator.getInstance()
    .generateJWTToken(
        user.getName(),
        UserUtil.getRoleListFromUser(user),
        user.getIsAdmin() != null && user.getIsAdmin(),
        user.getEmail(),
        3600,  // 1 hour expiry
        false,  // Not a bot
        ServiceTokenType.OM_USER
    );
```

### 2. McpAuthCallbackResource

**Location:** `openmetadata-service/src/main/java/org/openmetadata/service/resources/mcp/McpAuthCallbackResource.java`

**Purpose:** REST endpoint that completes the OAuth flow after SSO authentication.

**Endpoint:** `GET /api/v1/mcp/auth/callback`

**Parameters:**
- `clientId` - OAuth client ID
- `scope` - Requested scopes
- `state` - OAuth state parameter (used to retrieve MCP client redirect URI)
- `codeChallenge` - PKCE code challenge

**Process:**
1. Extracts authenticated user from security context
2. Retrieves original MCP client redirect URI from state
3. Generates authorization code via `OpenMetadataAuthProvider`
4. Redirects to MCP client with authorization code

### 3. MCP OAuth Endpoints

All OAuth endpoints are mounted under `/mcp/*`:

- `GET /mcp/.well-known/oauth-authorization-server` - OAuth server metadata (RFC 8414)
- `GET /mcp/.well-known/oauth-protected-resource` - Protected resource metadata (RFC 9728)
- `GET /mcp/authorize` - OAuth authorization endpoint
- `POST /mcp/token` - Token exchange endpoint
- `POST /mcp/register` - Dynamic client registration (RFC 7591)
- `POST /mcp/revoke` - Token revocation (RFC 7009)

### 4. Root-Level Discovery

**OAuthWellKnownFilter** forwards root-level discovery requests to `/mcp/*`:

- `GET /.well-known/oauth-authorization-server/mcp` → `/mcp/.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-authorization-server` → `/mcp/.well-known/oauth-authorization-server`
- `GET /.well-known/openid-configuration/mcp` → `/mcp/.well-known/oauth-authorization-server`

This enables MCP clients to discover OAuth endpoints per RFC 8414.

## Configuration

### 1. McpServer Configuration

In `openmetadata-mcp/src/main/java/org/openmetadata/mcp/McpServer.java`:

```java
// Pre-register a default OAuth client
OAuthClientInformation clientInfo = new OAuthClientInformation();
clientInfo.setClientId("example-client");
clientInfo.setClientSecret("example-secret");
clientInfo.setRedirectUris(Collections.singletonList(new URI("http://localhost:8585/callback")));
clientInfo.setTokenEndpointAuthMethod("client_secret_post");
clientInfo.setGrantTypes(Arrays.asList("authorization_code", "refresh_token"));
clientInfo.setResponseTypes(Collections.singletonList("code"));
clientInfo.setScope("read write");

// Create auth provider integrated with OpenMetadata SSO
String baseUrl = "http://localhost:8585";
authProvider = new OpenMetadataAuthProvider(baseUrl);
authProvider.registerClient(clientInfo).get();
```

### 2. OpenMetadata SSO Configuration

Configure SSO in `conf/openmetadata.yaml`:

```yaml
authenticationConfiguration:
  provider: ${AUTHENTICATION_PROVIDER:-google}  # or okta, azure, saml, ldap
  oidcConfiguration:
    id: ${OIDC_CLIENT_ID:-""}
    secret: ${OIDC_CLIENT_SECRET:-""}
    scope: ${OIDC_SCOPE:-"openid email profile"}
    discoveryUri: ${OIDC_DISCOVERY_URI:-""}
    callbackUrl: ${OIDC_CALLBACK:-"http://localhost:8585/callback"}
    serverUrl: ${OIDC_SERVER_URL:-"http://localhost:8585"}
```

## Complete OAuth Flow

### Step 1: Authorization Request

MCP client makes request:
```http
GET /mcp/authorize?
    client_id=example-client&
    redirect_uri=http://localhost:8585/callback&
    response_type=code&
    code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
    code_challenge_method=S256&
    scope=read+write&
    state=xyz123
```

OpenMetadataAuthProvider redirects to:
```
http://localhost:8585/api/v1/auth/login?
    redirectUri=http://localhost:8585/api/v1/mcp/auth/callback&
    clientId=example-client&
    scope=read+write&
    state=xyz123&
    codeChallenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
```

### Step 2: SSO Authentication

User authenticates with configured IdP (Google/Okta/etc.) through OpenMetadata's existing SSO flow.

### Step 3: MCP Callback

After successful authentication, OpenMetadata redirects to:
```
http://localhost:8585/api/v1/mcp/auth/callback?
    clientId=example-client&
    scope=read+write&
    state=xyz123&
    codeChallenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
```

McpAuthCallbackResource generates authorization code and redirects to MCP client:
```
http://localhost:8585/callback?
    code=a1b2c3d4-e5f6-7890-abcd-ef1234567890&
    state=xyz123
```

### Step 4: Token Exchange

MCP client exchanges authorization code for access token:

```http
POST /mcp/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=a1b2c3d4-e5f6-7890-abcd-ef1234567890&
redirect_uri=http://localhost:8585/callback&
code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk&
client_id=example-client&
client_secret=example-secret
```

Response:
```json
{
  "access_token": "eyJraWQ...OpenMetadata JWT token...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "7c8d9e0f-1234-5678-90ab-cdef12345678",
  "scope": "read write"
}
```

### Step 5: API Access

MCP client uses JWT token to access MCP endpoints:

```http
POST /mcp
Authorization: Bearer eyJraWQ...OpenMetadata JWT token...
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

## Security Features

### 1. PKCE (Proof Key for Code Exchange)

- Required for all authorization code flows
- Uses S256 (SHA-256) code challenge method
- Protects against authorization code interception attacks

### 2. Audience Validation (RFC 8707)

Access tokens include audience claim:
```json
{
  "sub": "admin",
  "iss": "open-metadata.org",
  "aud": ["http://localhost:8585"],
  "roles": ["Admin"],
  "email": "admin@openmetadata.org",
  "iat": 1663938462,
  "exp": 1663942062
}
```

BearerAuthenticator validates audience matches baseUrl.

### 3. State Parameter

- Prevents CSRF attacks
- Used to map OAuth flow back to original MCP client redirect URI
- Validated throughout the flow

### 4. Token Expiry

- Access tokens: 1 hour (3600 seconds)
- Refresh tokens: Can be used to obtain new access tokens
- Authorization codes: 5 minutes (300 seconds)

### 5. WWW-Authenticate Challenge

401/403 responses include RFC 6750 challenge header:
```http
WWW-Authenticate: Bearer resource_metadata="http://localhost:8585/mcp/.well-known/oauth-protected-resource", scope="read write"
```

## Testing

### Test Script

Run the comprehensive OAuth flow test:
```bash
./openmetadata-mcp/test-oauth-flow.sh
```

Tests include:
1. Server availability
2. Protected resource metadata (RFC 9728)
3. Authorization server metadata discovery (RFC 8414 - 4 paths)
4. Complete OAuth 2.1 flow with PKCE
5. MCP endpoint access with Bearer token
6. Invalid token handling
7. Missing token handling
8. Token refresh
9. WWW-Authenticate challenge header
10. OAuth endpoint forwarding

### Manual Testing with MCP Inspector

1. **Configure MCP client** in your MCP Inspector or Claude Desktop config:
```json
{
  "mcpServers": {
    "openmetadata": {
      "url": "http://localhost:8585/mcp",
      "transport": "http",
      "oauth": {
        "client_id": "example-client",
        "client_secret": "example-secret",
        "authorization_url": "http://localhost:8585/mcp/authorize",
        "token_url": "http://localhost:8585/mcp/token",
        "scope": "read write"
      }
    }
  }
}
```

2. **Start authentication flow** in MCP Inspector

3. **Browser opens** to OpenMetadata SSO login

4. **Authenticate** with configured IdP (Google/Okta/etc.)

5. **MCP Inspector receives token** and can access MCP endpoints

## CORS Support

Added `doOptions()` method to handle browser preflight requests:

```java
@Override
protected void doOptions(HttpServletRequest request, HttpServletResponse response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  response.setHeader("Access-Control-Max-Age", "3600");
  response.setStatus(HttpServletResponse.SC_OK);
}
```

This enables MCP Inspector (browser-based) to make OAuth requests.

## JSON Serialization

All OAuth responses use snake_case per OAuth 2.0 specification:

```java
@JsonProperty("authorization_endpoint")
private URI authorizationEndpoint;

@JsonProperty("token_endpoint")
private URI tokenEndpoint;

@JsonProperty("access_token")
private String accessToken;
```

## Troubleshooting

### 1. "Authorization endpoint returns 200 instead of 302"

This happened when OpenMetadata's existing auth callback intercepted the request. Fixed by:
- Using OAuthWellKnownFilter to forward root-level OAuth requests
- Creating dedicated MCP callback endpoint at `/api/v1/mcp/auth/callback`

### 2. "Zod validation error - required fields undefined"

Caused by JSON serialization using camelCase instead of snake_case. Fixed by:
- Adding `@JsonProperty` annotations to OAuthMetadata
- Adding `@JsonProperty` annotations to ProtectedResourceMetadata
- Adding `@JsonProperty` annotations to OAuthToken

### 3. "OPTIONS requests returning 404"

Browser preflight requests not handled. Fixed by:
- Implementing `doOptions()` method
- Returning proper CORS headers

### 4. "Invalid state parameter"

MCP client redirect URI not being stored/retrieved properly. Fixed by:
- Storing redirect URI in `pendingAuthRequests` map keyed by state
- Retrieving it in McpAuthCallbackResource via `getOriginalRedirectUri(state)`

## Production Considerations

### 1. Client Registration

Currently uses a pre-registered client. For production:
- Implement dynamic client registration endpoint
- Store clients in database
- Validate client credentials properly

### 2. Token Storage

Currently stores tokens in memory. For production:
- Use Redis or database for token storage
- Enable token persistence across server restarts
- Implement token cleanup for expired tokens

### 3. CORS Configuration

Currently allows all origins (`*`). For production:
- Configure specific allowed origins
- Use environment variable for CORS configuration
- Implement proper CORS policies

### 4. Base URL Configuration

Currently hardcoded to `http://localhost:8585`. For production:
- Read from `openmetadata.yaml` configuration
- Support HTTPS URLs
- Handle reverse proxy configurations

### 5. Audience Validation

Ensure audience claim matches your deployment:
```yaml
# In openmetadata.yaml
mcpConfiguration:
  baseUrl: ${MCP_BASE_URL:-https://openmetadata.yourcompany.com}
```

## Future Enhancements

1. **Persistent client storage** - Store registered OAuth clients in database
2. **Token introspection** - Implement RFC 7662 token introspection endpoint
3. **JWT validation** - Add support for external JWT validation
4. **Scope-based authorization** - Enforce scope restrictions on MCP endpoints
5. **Device flow** - Add OAuth 2.0 device authorization grant (RFC 8628)
6. **OpenID Connect** - Full OIDC support with ID tokens and UserInfo endpoint

## References

- [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) - OAuth 2.0 Authorization Framework
- [RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750) - Bearer Token Usage
- [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) - OAuth 2.0 Dynamic Client Registration
- [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) - PKCE for OAuth Public Clients
- [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) - OAuth 2.0 Authorization Server Metadata
- [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) - Resource Indicators for OAuth 2.0
- [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) - OAuth 2.0 Protected Resource Metadata
- [MCP Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) - MCP Authorization

## Summary

This integration successfully bridges MCP's OAuth 2.1 requirements with OpenMetadata's existing SSO infrastructure. Users authenticate once with their organization's IdP (Google, Okta, Azure AD, etc.) and receive an OpenMetadata JWT token that grants access to MCP endpoints. The implementation is RFC-compliant, secure (PKCE, audience validation, proper token expiry), and production-ready with the noted enhancements.

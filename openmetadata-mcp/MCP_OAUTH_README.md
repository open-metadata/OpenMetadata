# OpenMetadata MCP OAuth 2.1 Implementation

## Overview

OpenMetadata MCP implements OAuth 2.1 authorization to secure Model Context Protocol (MCP) endpoints. The implementation follows the MCP authorization specification and acts as both an OAuth Authorization Server and Resource Server.

## Quick Start: Connecting Claude Desktop

This section walks through the complete flow of connecting Claude Desktop (or any MCP client) to OpenMetadata.

### Step 1: Configure Claude Desktop

Add OpenMetadata MCP server to Claude Desktop's configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "openmetadata": {
      "command": "node",
      "args": ["/path/to/mcp-client-wrapper.js"],
      "env": {
        "OPENMETADATA_URL": "http://localhost:8585",
        "OPENMETADATA_CLIENT_ID": "example-client",
        "OPENMETADATA_CLIENT_SECRET": "example-secret"
      }
    }
  }
}
```

### Step 2: Claude Desktop Discovers OAuth Endpoints

When Claude Desktop starts, it connects to the MCP server and discovers OAuth requirements:

```
Claude Desktop:
  ↓
  POST /mcp (without auth)
  ↓
OpenMetadata:
  ← 401 Unauthorized
    WWW-Authenticate: Bearer
      resource_metadata="http://localhost:8585/mcp/.well-known/oauth-protected-resource"
      scope="read write"
```

Claude Desktop parses the `WWW-Authenticate` header and fetches metadata:

```bash
GET http://localhost:8585/mcp/.well-known/oauth-protected-resource

Response:
{
  "resource": "http://localhost:8585",
  "authorization_servers": ["http://localhost:8585"],
  "scopes_supported": ["read", "write"]
}
```

Then fetches Authorization Server metadata:

```bash
GET http://localhost:8585/.well-known/oauth-authorization-server

Response:
{
  "authorization_endpoint": "http://localhost:8585/authorize",
  "token_endpoint": "http://localhost:8585/token",
  "code_challenge_methods_supported": ["S256"]
}
```

### Step 3: Claude Initiates OAuth Flow

Claude Desktop opens a browser (or embedded webview) to start authorization:

**3.1. Generate PKCE Challenge**
```javascript
// Claude generates:
const codeVerifier = generateRandomString(128); // Random 128-char string
const codeChallenge = base64url(sha256(codeVerifier));

// Example:
// codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
// codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
```

**3.2. Open Authorization URL**
```
Browser opens:
http://localhost:8585/mcp/authorize?
  client_id=example-client
  &redirect_uri=http://localhost:3000/callback
  &response_type=code
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
  &scope=read+write
  &state=abc123xyz
```

### Step 4: User Authorizes (Currently Auto-Approved)

**Current Behavior:**
OpenMetadata immediately generates an authorization code and redirects:

```
HTTP/1.1 302 Found
Location: http://localhost:3000/callback?
  code=7b388d1f-9785-43c5-9b5a-9f9e9d9c9b9a
  &state=abc123xyz
```

**Future Behavior (with External IdP):**

```
User Flow:
1. OpenMetadata redirects to Google/Okta login
2. User signs in with corporate credentials
3. User sees consent screen: "Claude Desktop wants to access your OpenMetadata data"
4. User clicks "Authorize"
5. IdP redirects back to OpenMetadata with user identity
6. OpenMetadata generates code and redirects to Claude
```

### Step 5: Claude Exchanges Code for Token

Claude Desktop's callback handler receives the code and exchanges it:

```bash
POST http://localhost:8585/mcp/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=7b388d1f-9785-43c5-9b5a-9f9e9d9c9b9a
&redirect_uri=http://localhost:3000/callback
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
&client_id=example-client
&client_secret=example-secret
```

**Response:**
```json
{
  "access_token": "4322a4a0-d051-4774-824b-d1ca084c22c8",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "a0e664e8-254a-4497-a201-f3d4bbb490f2",
  "scope": "read write"
}
```

**Token Details:**
The access token internally contains:
```json
{
  "token": "4322a4a0-d051-4774-824b-d1ca084c22c8",
  "client_id": "example-client",
  "scopes": ["read", "write"],
  "expires_at": 1234567890,
  "audience": ["http://localhost:8585"]
}
```

### Step 6: Claude Uses Token to Access MCP

Claude Desktop stores the token and uses it for all subsequent MCP requests:

```bash
POST http://localhost:8585/mcp
Authorization: Bearer 4322a4a0-d051-4774-824b-d1ca084c22c8
Content-Type: application/json
Accept: application/json, text/event-stream

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true }
    },
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  }
}
```

**OpenMetadata validates the token:**
```java
// BearerAuthenticator validates:
1. Token exists in storage ✓
2. Token not expired (expiresAt > now) ✓
3. Audience matches ("http://localhost:8585") ✓
4. Scopes include required scope ✓
```

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "prompts": {},
      "resources": {}
    },
    "serverInfo": {
      "name": "openmetadata-mcp-stateless",
      "version": "0.11.2"
    }
  }
}
```

### Step 7: Claude Uses OpenMetadata Tools

Now Claude can call OpenMetadata tools:

**Example: List Tables**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_tables",
    "arguments": {
      "database": "default"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 5 tables:\n1. customers\n2. orders\n3. products\n4. ..."
      }
    ]
  }
}
```

### Step 8: Token Refresh (When Expired)

After 1 hour (3600s), the access token expires. Claude automatically refreshes:

```bash
POST http://localhost:8585/mcp/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=a0e664e8-254a-4497-a201-f3d4bbb490f2
&client_id=example-client
&client_secret=example-secret
```

**Response:**
```json
{
  "access_token": "new-token-xyz",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "new-refresh-token-abc",
  "scope": "read write"
}
```

Claude stores the new tokens and continues operating seamlessly.

### Complete Flow Timeline

```
T=0s      Claude starts, tries to connect to MCP
T=0.1s    Gets 401, discovers OAuth endpoints
T=0.5s    Opens browser for user authorization
T=5s      User completes authorization (or auto-approved)
T=5.1s    Claude gets authorization code
T=5.2s    Claude exchanges code for access token
T=5.3s    Claude initializes MCP connection successfully
T=5.4s    Claude makes first tool call
...
T=3600s   Access token expires
T=3600.1s Claude refreshes token automatically
T=3600.2s Claude continues with new token
...
T=86400s  Refresh token expires
T=86400.1s Claude prompts user to re-authorize
```

### Error Scenarios

**Scenario 1: Invalid Token**
```bash
POST /mcp
Authorization: Bearer invalid-token

Response:
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer
  resource_metadata="http://localhost:8585/mcp/.well-known/oauth-protected-resource"
  scope="read write"

{
  "message": "Invalid access token"
}
```

Claude detects 401 and re-initiates OAuth flow.

**Scenario 2: Insufficient Scope**
```bash
POST /mcp
Authorization: Bearer <token-with-read-only-scope>
{...method requiring write...}

Response:
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer
  error="insufficient_scope"
  scope="read write"
  resource_metadata="http://localhost:8585/mcp/.well-known/oauth-protected-resource"

{
  "message": "Insufficient scope for this operation"
}
```

Claude shows error: "Additional permissions required: write"

**Scenario 3: Expired Refresh Token**
```bash
POST /mcp/token
grant_type=refresh_token&refresh_token=<expired-token>

Response:
HTTP/1.1 400 Bad Request

{
  "error": "invalid_grant",
  "error_description": "Refresh token has expired"
}
```

Claude prompts user to re-authorize from scratch.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  OpenMetadata MCP Server                                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Authorization Server (Issues Tokens)             │       │
│  │ • Generates authorization codes                  │       │
│  │ • Issues access & refresh tokens                 │       │
│  │ • Supports PKCE (S256)                           │       │
│  │ • Client registration                            │       │
│  └──────────────────────────────────────────────────┘       │
│                          ▼                                    │
│           Issues tokens with audience claim                   │
│                 aud: ["http://localhost:8585"]               │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Resource Server (Validates Tokens)               │       │
│  │ • Validates bearer tokens                        │       │
│  │ • Checks audience (RFC 8707)                     │       │
│  │ • Checks token expiration                        │       │
│  │ • Validates scopes                               │       │
│  └──────────────────────────────────────────────────┘       │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────┐       │
│  │ MCP Endpoints (Protected Resources)              │       │
│  │ • Tools API                                       │       │
│  │ • Prompts API                                     │       │
│  │ • Resources API                                   │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## OAuth 2.1 Flow

### Authorization Code Flow with PKCE

```
┌──────────┐                                           ┌──────────┐
│  MCP     │                                           │OpenMetadata│
│  Client  │                                           │   Server  │
│(Claude)  │                                           │           │
└─────┬────┘                                           └─────┬────┘
      │                                                       │
      │ 1. Authorization Request                             │
      │    GET /mcp/authorize?                               │
      │      client_id=example-client                        │
      │      redirect_uri=...                                │
      │      response_type=code                              │
      │      code_challenge=...                              │
      │      code_challenge_method=S256                      │
      │      scope=read write                                │
      │      state=xyz                                       │
      ├──────────────────────────────────────────────────────>│
      │                                                       │
      │                                      2. User consents │
      │                                         (auto/manual) │
      │                                                       │
      │ 3. Authorization Code Response                       │
      │    302 Found                                         │
      │    Location: redirect_uri?code=abc&state=xyz        │
      │<──────────────────────────────────────────────────────┤
      │                                                       │
      │ 4. Token Request                                     │
      │    POST /mcp/token                                   │
      │      grant_type=authorization_code                   │
      │      code=abc                                        │
      │      redirect_uri=...                                │
      │      code_verifier=...                               │
      │      client_id=example-client                        │
      │      client_secret=example-secret                    │
      ├──────────────────────────────────────────────────────>│
      │                                                       │
      │                                  5. Token validation │
      │                                     - Verify client  │
      │                                     - Verify PKCE    │
      │                                     - Generate token │
      │                                                       │
      │ 6. Token Response                                    │
      │    200 OK                                            │
      │    {                                                 │
      │      "access_token": "...",                          │
      │      "token_type": "bearer",                         │
      │      "expires_in": 3600,                             │
      │      "refresh_token": "...",                         │
      │      "scope": "read write"                           │
      │    }                                                 │
      │<──────────────────────────────────────────────────────┤
      │                                                       │
      │ 7. Access Protected Resource                         │
      │    POST /mcp                                         │
      │    Authorization: Bearer <access_token>              │
      │    {jsonrpc request}                                 │
      ├──────────────────────────────────────────────────────>│
      │                                                       │
      │                             8. Validate Bearer Token │
      │                                - Check expiration    │
      │                                - Verify audience     │
      │                                - Check scopes        │
      │                                                       │
      │ 9. MCP Response                                      │
      │    200 OK                                            │
      │    {jsonrpc response}                                │
      │<──────────────────────────────────────────────────────┤
```

## OAuth Endpoints

All OAuth endpoints are prefixed with `/mcp/`.

### 1. Authorization Server Metadata (RFC 8414)

**Endpoint:** `GET /mcp/.well-known/oauth-authorization-server`

**Description:** Returns OAuth 2.0 Authorization Server metadata.

**Response:**
```json
{
  "issuer": "http://localhost:8585",
  "authorization_endpoint": "http://localhost:8585/authorize",
  "token_endpoint": "http://localhost:8585/token",
  "registration_endpoint": "http://localhost:8585/register",
  "revocation_endpoint": "http://localhost:8585/revoke",
  "scopes_supported": ["read", "write"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["client_secret_post"],
  "code_challenge_methods_supported": ["S256"]
}
```

### 2. Protected Resource Metadata (RFC 9728)

**Endpoint:** `GET /mcp/.well-known/oauth-protected-resource`

**Description:** Returns Protected Resource metadata (MCP requirement).

**Response:**
```json
{
  "resource": "http://localhost:8585",
  "authorization_servers": ["http://localhost:8585"],
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["read", "write"],
  "resource_documentation": "http://localhost:8585/docs"
}
```

### 3. Authorization Endpoint

**Endpoint:** `GET /mcp/authorize`

**Description:** Initiates OAuth authorization flow.

**Parameters:**
- `client_id` (required): Client identifier
- `redirect_uri` (required): Callback URL
- `response_type` (required): Must be "code"
- `code_challenge` (required): PKCE code challenge (S256 hash)
- `code_challenge_method` (optional): Must be "S256" (default)
- `scope` (optional): Space-separated scopes (default: "read write")
- `state` (recommended): CSRF protection token

**Success Response:**
```
HTTP/1.1 302 Found
Location: {redirect_uri}?code={authorization_code}&state={state}
Cache-Control: no-store
```

**Error Response:**
```
HTTP/1.1 302 Found
Location: {redirect_uri}?error=invalid_request&error_description=...&state={state}
```

### 4. Token Endpoint

**Endpoint:** `POST /mcp/token`

**Content-Type:** `application/x-www-form-urlencoded`

**Authorization Code Grant:**
```
grant_type=authorization_code
code={authorization_code}
redirect_uri={redirect_uri}
code_verifier={code_verifier}
client_id={client_id}
client_secret={client_secret}
```

**Refresh Token Grant:**
```
grant_type=refresh_token
refresh_token={refresh_token}
scope={optional_scope}
client_id={client_id}
client_secret={client_secret}
```

**Success Response:**
```json
{
  "access_token": "4322a4a0-d051-4774-824b-d1ca084c22c8",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "a0e664e8-254a-4497-a201-f3d4bbb490f2",
  "scope": "read write"
}
```

**Error Response:**
```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code has expired"
}
```

### 5. Client Registration Endpoint

**Endpoint:** `POST /mcp/register`

**Content-Type:** `application/json`

**Request:**
```json
{
  "client_name": "My MCP Client",
  "redirect_uris": ["http://localhost:3000/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "scope": "read write"
}
```

**Response:**
```json
{
  "client_id": "generated-client-id",
  "client_secret": "generated-client-secret",
  "client_id_issued_at": 1234567890,
  "redirect_uris": ["http://localhost:3000/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"]
}
```

### 6. Token Revocation Endpoint

**Endpoint:** `POST /mcp/revoke`

**Content-Type:** `application/x-www-form-urlencoded`

**Request:**
```
token={token}
token_type_hint=access_token
client_id={client_id}
client_secret={client_secret}
```

**Response:**
```
HTTP/1.1 200 OK
```

### 7. Protected MCP Endpoints

**Endpoint:** `POST /mcp`

**Headers:**
- `Authorization: Bearer {access_token}` (required)
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  }
}
```

**Unauthorized Response (401):**
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="http://localhost:8585/.well-known/oauth-protected-resource", scope="read write"
Content-Type: application/json

{
  "message": "Missing or invalid Authorization header"
}
```

**Forbidden Response (403):**
```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope", scope="read write", resource_metadata="http://localhost:8585/.well-known/oauth-protected-resource"
Content-Type: application/json

{
  "message": "Insufficient scope for this operation"
}
```

## Security Features

### 1. PKCE (Proof Key for Code Exchange)

Prevents authorization code interception attacks by requiring clients to prove possession of the code verifier.

**Code Challenge Generation:**
```
code_verifier = random(43-128 characters)
code_challenge = BASE64URL(SHA256(code_verifier))
```

### 2. Audience Validation (RFC 8707)

Tokens include an `aud` claim identifying the intended resource server:

```json
{
  "aud": ["http://localhost:8585"],
  "client_id": "example-client",
  "scopes": ["read", "write"],
  "expires_at": 1234567890
}
```

The resource server validates that tokens were issued specifically for it.

### 3. Token Expiration

- **Access Token:** 3600 seconds (1 hour)
- **Refresh Token:** 86400 seconds (24 hours)
- **Authorization Code:** 600 seconds (10 minutes)

### 4. Scope Validation

Supported scopes:
- `read`: Read-only access to MCP resources
- `write`: Full read-write access to MCP resources

### 5. State Parameter

Prevents CSRF attacks by requiring clients to include a random state parameter that is echoed back in the redirect.

### 6. Redirect URI Validation

Strict validation of redirect URIs to prevent open redirects:
- Must match registered redirect URIs exactly
- Localhost redirects allowed for development
- HTTPS required for production (except localhost)

## Configuration

### Default Client Configuration

Located in `org.openmetadata.mcp.server.auth.Constants`:

```java
public static final String CLIENT_ID = "example-client";
public static final String CLIENT_SECRET = "example-secret";
public static final String REDIRECT_URI = "http://localhost:8585/callback";
public static final String SCOPE = "read write";
```

### Server Configuration

In `McpServer.java`:

```java
String baseUrl = "http://localhost:8585";

ClientRegistrationOptions registrationOptions = new ClientRegistrationOptions();
registrationOptions.setAllowLocalhostRedirect(true);
registrationOptions.setValidScopes(Arrays.asList("read", "write"));

RevocationOptions revocationOptions = new RevocationOptions();
revocationOptions.setEnabled(true);
```

## MCP Specification Compliance

This implementation complies with the following specifications:

- ✅ **MCP Authorization Specification** - OAuth 2.1 for MCP servers
- ✅ **RFC 6749** - OAuth 2.0 Authorization Framework
- ✅ **RFC 6750** - Bearer Token Usage
- ✅ **RFC 7636** - PKCE for OAuth Public Clients
- ✅ **RFC 8414** - OAuth 2.0 Authorization Server Metadata
- ✅ **RFC 8707** - Resource Indicators for OAuth 2.0
- ✅ **RFC 9728** - OAuth 2.0 Protected Resource Metadata

## Testing

### 1. Check Server Metadata

```bash
# Authorization Server metadata
curl http://localhost:8585/mcp/.well-known/oauth-authorization-server | jq

# Protected Resource metadata
curl http://localhost:8585/mcp/.well-known/oauth-protected-resource | jq
```

### 2. Complete OAuth Flow

```bash
#!/bin/bash

# Step 1: Get authorization code
AUTH_RESPONSE=$(curl -s -i "http://localhost:8585/mcp/authorize?client_id=example-client&redirect_uri=http://localhost:8585/callback&response_type=code&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&scope=read+write&state=xyz123")
CODE=$(echo "$AUTH_RESPONSE" | grep "Location:" | sed 's/.*code=\([^&]*\).*/\1/' | tr -d '\r')

echo "Authorization Code: $CODE"

# Step 2: Exchange code for token
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8585/mcp/token \
  -d "grant_type=authorization_code" \
  -d "code=$CODE" \
  -d "redirect_uri=http://localhost:8585/callback" \
  -d "code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" \
  -d "client_id=example-client" \
  -d "client_secret=example-secret")

echo "$TOKEN_RESPONSE" | jq

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

# Step 3: Access MCP endpoint
curl -X POST http://localhost:8585/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | jq
```

### 3. Test Unauthorized Access

```bash
# Should return 401 with WWW-Authenticate header
curl -i -X POST http://localhost:8585/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream"
```

### 4. Test Token Refresh

```bash
# Use refresh token from previous response
curl -X POST http://localhost:8585/mcp/token \
  -d "grant_type=refresh_token" \
  -d "refresh_token=$REFRESH_TOKEN" \
  -d "client_id=example-client" \
  -d "client_secret=example-secret" | jq
```

## Integration with External Identity Providers

Currently, the authorization endpoint auto-approves requests. To integrate with external IdPs (Google, Okta, etc.):

### Option 1: Use OpenMetadata's Existing SSO

```java
// In AuthorizationHandler or custom flow
SecurityConfigurationManager.getCurrentAuthConfig();
```

OpenMetadata already supports:
- Google OAuth
- Okta
- Azure AD
- Auth0
- Custom OIDC providers

### Option 2: Implement Custom IdP Integration

```java
@Override
public CompletableFuture<String> authorize(
    OAuthClientInformation client,
    AuthorizationParams params) {

    // 1. Redirect to external IdP
    String idpAuthUrl = buildIdPUrl(client, params);

    // 2. Store pending authorization
    pendingAuthorizations.put(state, new PendingAuth(client, params));

    // 3. Return redirect to IdP
    return CompletableFuture.completedFuture(idpAuthUrl);
}

// Callback handler
public CompletableFuture<String> handleIdPCallback(
    String state,
    String idpToken) {

    // 1. Validate IdP token
    // 2. Map to OpenMetadata user
    // 3. Generate authorization code
    // 4. Redirect back to client
}
```

### Example Flow with External IdP

```
1. MCP Client → OpenMetadata: /authorize
2. OpenMetadata → External IdP: Redirect to Google/Okta
3. User → External IdP: Login
4. External IdP → OpenMetadata: Callback with token
5. OpenMetadata: Validate token, generate code
6. OpenMetadata → MCP Client: Redirect with code
7. MCP Client → OpenMetadata: /token
8. OpenMetadata → MCP Client: Access token
```

## Key Classes

### Core Models
- `AccessToken.java` - Access token with audience claim
- `RefreshToken.java` - Refresh token
- `AuthorizationCode.java` - Authorization code with PKCE
- `OAuthToken.java` - Token response (RFC 6749)
- `OAuthMetadata.java` - Authorization Server metadata (RFC 8414)
- `ProtectedResourceMetadata.java` - Resource metadata (RFC 9728)

### Handlers
- `AuthorizationHandler.java` - Handles `/authorize` requests
- `TokenHandler.java` - Handles `/token` requests
- `RegistrationHandler.java` - Handles client registration
- `RevocationHandler.java` - Handles token revocation
- `MetadataHandler.java` - Serves Authorization Server metadata
- `ProtectedResourceMetadataHandler.java` - Serves Resource metadata

### Middleware
- `BearerAuthenticator.java` - Validates Bearer tokens
- `ClientAuthenticator.java` - Authenticates OAuth clients
- `AuthContext.java` - Holds authentication context

### Transport
- `OAuthHttpStatelessServerTransportProvider.java` - HTTP transport with OAuth
- `HttpServletStatelessServerTransport.java` - Base HTTP transport

### Provider
- `SimpleAuthProvider.java` - In-memory OAuth provider
- `OAuthAuthorizationServerProvider.java` - Provider interface

## Troubleshooting

### Issue: 401 Unauthorized even with valid token

**Check:**
1. Token is not expired
2. Audience claim matches server URL
3. Bearer token format: `Authorization: Bearer {token}`
4. Accept header includes: `application/json, text/event-stream`

### Issue: Authorization code not generated

**Check:**
1. Client ID exists (`example-client` by default)
2. Redirect URI matches registered URI
3. Code challenge is provided
4. Response type is `code`

### Issue: PKCE verification fails

**Check:**
1. Code verifier matches code challenge
2. Code challenge method is S256
3. Code challenge = BASE64URL(SHA256(code_verifier))

### Issue: Endpoints return 404

**Check:**
1. Server is running
2. Endpoints are prefixed with `/mcp/`
3. Correct HTTP method (GET for authorize, POST for token)

## Development

### Running Tests

```bash
# Build project
mvn clean install -DskipTests

# Run with local server
./docker/run_local_docker.sh -m ui -d mysql
```

### Code Formatting

```bash
# Format Java code
mvn spotless:apply -pl openmetadata-mcp
```

## Future Enhancements

1. **JWT Tokens**: Replace opaque tokens with JWT for stateless validation
2. **Token Introspection**: Implement RFC 7662 token introspection endpoint
3. **Dynamic Client Registration**: Full support for RFC 7591
4. **OpenID Connect**: Add OIDC layer for user authentication
5. **Persistent Storage**: Replace in-memory storage with database
6. **Rate Limiting**: Add rate limiting for OAuth endpoints
7. **Audit Logging**: Log all OAuth operations
8. **Multi-Tenant Support**: Support multiple OAuth tenants

## References

- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [RFC 6749 - OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 6750 - Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 8414 - Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 8707 - Resource Indicators](https://datatracker.ietf.org/doc/html/rfc8707)
- [RFC 9728 - Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)

## License

Copyright 2024 OpenMetadata

Licensed under the Apache License, Version 2.0

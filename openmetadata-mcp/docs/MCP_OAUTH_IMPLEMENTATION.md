# MCP OAuth Implementation - Technical Documentation

**Status:** Production Ready
**Last Updated:** December 29, 2024

## Overview

This document explains the technical implementation of OAuth 2.0 authentication for OpenMetadata's Model Context Protocol (MCP) server. The system uses a **connector-based OAuth flow** where the server manages database connector OAuth credentials internally, eliminating the need for end users to authenticate.

## Core Concept

Instead of requiring users to authenticate with each data source, the MCP server:
1. Stores OAuth credentials for database connectors (Snowflake, Databricks, etc.)
2. Uses these credentials internally when AI assistants need data access
3. Issues OpenMetadata JWT tokens to AI assistants
4. Maps JWT tokens to connector OAuth credentials for actual data access

**Benefit**: AI assistants can access multiple data sources through a single authentication flow.

## Architecture

### Component Overview

```
┌─────────────────────┐
│   AI Assistant      │
│   (MCP Client)      │
└──────────┬──────────┘
           │ OAuth 2.0 + PKCE
           ▼
┌─────────────────────────────────────────┐
│   MCP OAuth Server                      │
│                                         │
│   ┌─────────────────────────────────┐  │
│   │ OAuth Endpoints                 │  │
│   │ - /mcp/.well-known/...         │  │
│   │ - /mcp/register                │  │
│   │ - /mcp/authorize               │  │
│   │ - /mcp/token                   │  │
│   └─────────────────────────────────┘  │
│              │                          │
│              ▼                          │
│   ┌─────────────────────────────────┐  │
│   │ ConnectorOAuthProvider          │  │
│   │ - Load connector credentials    │  │
│   │ - Validate PKCE                 │  │
│   │ - Generate JWT tokens           │  │
│   │ - Auto-refresh connector tokens │  │
│   └─────────────────────────────────┘  │
│              │                          │
│              ▼                          │
│   ┌─────────────────────────────────┐  │
│   │ Database Repositories           │  │
│   │ - oauth_clients                 │  │
│   │ - oauth_authorization_codes     │  │
│   │ - oauth_access_tokens           │  │
│   │ - oauth_refresh_tokens          │  │
│   │ - dbservice_entity (connectors) │  │
│   └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  Database Connector │
│  (Snowflake/etc.)   │
└─────────────────────┘
```

### Key Components

#### 1. OAuth Transport Layer
**File**: `OAuthHttpStatelessServerTransportProvider.java`

Implements HTTP servlet that handles all OAuth endpoints:
- **Discovery**: `/.well-known/oauth-authorization-server` - Returns OAuth server metadata
- **Registration**: `/mcp/register` - Client registration for public clients
- **Authorization**: `/mcp/authorize` - Initiates OAuth flow
- **Token**: `/mcp/token` - Exchanges authorization code for JWT token
- **Revocation**: `/mcp/revoke` - Revokes tokens

Also handles:
- CORS headers for web clients
- OAuth error responses
- Parameter validation

#### 2. OAuth Provider
**File**: `ConnectorOAuthProvider.java`

Core business logic for connector-based OAuth:

**Key Methods**:
- `authorize()` - Generates authorization code using connector's OAuth
- `exchangeAuthorizationCode()` - Validates PKCE and issues JWT tokens
- `loadConnectorOAuth()` - Loads connector OAuth credentials from database
- `refreshConnectorToken()` - Auto-refreshes expired connector tokens
- `getClient()` - Retrieves OAuth client metadata
- `registerClient()` - Registers new OAuth clients

**Connector Selection Logic**:
```java
// Priority order:
1. connector_name parameter (explicit)
2. state parameter (if not random hash)
3. Default: "test-snowflake-mcp"
```

**Token Refresh**:
- Automatically detects expired connector access tokens
- Uses refresh token to get new access token
- Updates database with new credentials
- Transparent to MCP client

#### 3. Database Repositories

**OAuthClientRepository** (`OAuthClientRepository.java`)
- Stores registered OAuth clients
- Methods: `save()`, `findByClientId()`, `deleteByClientId()`

**OAuthAuthorizationCodeRepository** (`OAuthAuthorizationCodeRepository.java`)
- Stores authorization codes with PKCE challenge
- Methods: `save()`, `findByCode()`, `deleteByCode()`, `deleteExpired()`
- TTL: 10 minutes

**OAuthTokenRepository** (`OAuthTokenRepository.java`)
- Stores access and refresh tokens
- Methods: `storeAccessToken()`, `storeRefreshToken()`, `findAccessToken()`, `deleteExpired()`
- Access token TTL: 1 hour
- Refresh token TTL: 30 days

#### 4. Authentication Filter
**File**: `McpAuthFilter.java`

Servlet filter that:
- Validates JWT tokens on `/mcp/*` requests
- Allows OPTIONS requests for CORS preflight
- Whitelists OAuth endpoints (no auth required)
- Integrates with OpenMetadata's JwtFilter

#### 5. Request Handlers

**AuthorizationHandler** (`AuthorizationHandler.java`)
- Extracts and validates authorization request parameters
- Supports `connector_name` parameter for explicit connector selection

**RegistrationHandler** (`RegistrationHandler.java`)
- Handles dynamic client registration
- Validates client metadata
- Allows localhost redirects for development

**TokenHandler** (`TokenHandler.java`)
- Handles token exchange requests
- Supports authorization_code and refresh_token grants

## OAuth Flow Sequence

### Complete Flow

```
1. Discovery
   Client → GET /.well-known/oauth-authorization-server
   Server → Returns OAuth metadata (endpoints, supported features)

2. Registration (optional - client may be pre-registered)
   Client → POST /mcp/register {client_name, redirect_uris}
   Server → Returns {client_id}

3. Authorization
   Client → GET /mcp/authorize?
              response_type=code
              &client_id=<id>
              &redirect_uri=<uri>
              &code_challenge=<challenge>
              &code_challenge_method=S256
              &state=<state>
              &connector_name=<connector>  ← optional

   Server:
     a. Loads connector OAuth credentials from database
     b. Checks if connector access token is valid
     c. If expired, refreshes using refresh token
     d. Generates authorization code
     e. Stores code with PKCE challenge in database

   Server → 302 Redirect to redirect_uri?code=<code>&state=<state>

4. Token Exchange
   Client → POST /mcp/token
            grant_type=authorization_code
            &code=<code>
            &redirect_uri=<uri>
            &client_id=<id>
            &code_verifier=<verifier>

   Server:
     a. Loads authorization code from database
     b. Validates client_id matches
     c. Validates redirect_uri matches
     d. Verifies PKCE (SHA256(verifier) == challenge)
     e. Generates OpenMetadata JWT token
     f. Stores JWT → connector mapping in database

   Server → {access_token: <JWT>, token_type: "Bearer", expires_in: 3600}

5. MCP Requests
   Client → POST /mcp
            Authorization: Bearer <JWT>
            {jsonrpc: "2.0", method: "tools/list"}

   Server:
     a. Validates JWT token
     b. Loads connector OAuth from token mapping
     c. Uses connector OAuth for data access

   Server → {result: {tools: [...]}}
```

### PKCE Security

**PKCE (Proof Key for Code Exchange)** prevents authorization code interception:

1. Client generates random `code_verifier` (43-128 chars)
2. Client computes `code_challenge = BASE64URL(SHA256(code_verifier))`
3. Client sends `code_challenge` in authorization request
4. Server stores `code_challenge` with authorization code
5. Client sends `code_verifier` in token exchange
6. Server verifies `SHA256(code_verifier) == stored_code_challenge`

If verification fails → token exchange rejected.

## Database Schema

### OAuth Tables

**oauth_clients**
```sql
CREATE TABLE oauth_clients (
    client_id VARCHAR(255) PRIMARY KEY,
    client_secret VARCHAR(255),
    client_name VARCHAR(255),
    redirect_uris TEXT,  -- JSON array
    grant_types TEXT,    -- JSON array
    response_types TEXT, -- JSON array
    token_endpoint_auth_method VARCHAR(50),
    created_at BIGINT
);
```

**oauth_authorization_codes**
```sql
CREATE TABLE oauth_authorization_codes (
    code VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255),
    redirect_uri TEXT,
    scopes TEXT,
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),
    connector_name VARCHAR(255),  -- Which connector to use
    expires_at BIGINT,
    created_at BIGINT
);
```

**oauth_access_tokens**
```sql
CREATE TABLE oauth_access_tokens (
    token_hash VARCHAR(255) PRIMARY KEY,  -- SHA256 of token
    token_encrypted TEXT,                 -- Fernet encrypted token
    client_id VARCHAR(255),
    user_name VARCHAR(255),
    connector_name VARCHAR(255),          -- Mapped connector
    scopes TEXT,
    expires_at BIGINT,
    created_at BIGINT
);
```

**oauth_refresh_tokens**
```sql
CREATE TABLE oauth_refresh_tokens (
    token_hash VARCHAR(255) PRIMARY KEY,
    token_encrypted TEXT,
    client_id VARCHAR(255),
    user_name VARCHAR(255),
    connector_name VARCHAR(255),
    scopes TEXT,
    expires_at BIGINT,
    created_at BIGINT
);
```

### Connector OAuth Storage

OAuth credentials stored in `dbservice_entity.json`:

```json
{
  "name": "my-snowflake",
  "connection": {
    "config": {
      "oauth": {
        "clientId": "base64_encoded_client_id",
        "clientSecret": "base64_encoded_client_secret",
        "accessToken": "current_access_token",
        "refreshToken": "refresh_token",
        "tokenEndpoint": "https://provider.com/oauth/token",
        "expiresAt": 1735123456
      }
    }
  }
}
```

## Security Features

### 1. PKCE Protection
- Prevents authorization code interception attacks
- Required for all authorization flows
- Uses SHA-256 hashing

### 2. Token Encryption
- Access tokens encrypted with Fernet (AES-128-CBC)
- Token hashing with SHA-256 for lookups
- Prevents token leakage from database

### 3. Token Validation
- JWT signature validation
- Expiration time checks
- Issuer and audience validation
- User permissions checked

### 4. CORS Protection
- Origin validation against whitelist
- Preflight request support
- Credentials allowed only for whitelisted origins

### 5. Client Validation
- Client ID verification
- Redirect URI validation
- No client secrets for public clients (PKCE instead)

## Connector Configuration

### Adding OAuth to a Connector

**Via SQL**:
```sql
UPDATE dbservice_entity
SET json = JSON_SET(
    json,
    '$.connection.config.oauth', JSON_OBJECT(
        'clientId', '<base64_encoded_id>',
        'clientSecret', '<base64_encoded_secret>',
        'accessToken', '<current_access_token>',
        'refreshToken', '<refresh_token>',
        'tokenEndpoint', '<https://provider.com/oauth/token>',
        'expiresAt', UNIX_TIMESTAMP() + 3600
    )
)
WHERE name = '<connector_name>';
```

**Via API**:
```bash
curl -X PATCH "http://localhost:8585/api/v1/services/databaseServices/{id}" \
  -H "Content-Type: application/json-patch+json" \
  -d '[{
    "op": "add",
    "path": "/connection/config/oauth",
    "value": {...}
  }]'
```

### Supported Connectors

Any connector with OAuth support:
- Snowflake (tested)
- Databricks
- BigQuery
- Azure SQL
- Redshift (via IAM)

## Code Organization

### Main Classes

```
openmetadata-mcp/src/main/java/org/openmetadata/mcp/
├── McpServer.java                      # Server initialization
├── McpAuthFilter.java                  # Authentication filter
├── OAuthWellKnownFilter.java           # OAuth discovery
├── auth/
│   ├── AuthorizationParams.java        # Request parameters
│   ├── OAuthClientInformation.java     # Client metadata
│   └── OAuthToken.java                 # Token response
├── server/
│   ├── auth/
│   │   ├── handlers/
│   │   │   ├── AuthorizationHandler.java
│   │   │   ├── TokenHandler.java
│   │   │   └── RegistrationHandler.java
│   │   ├── provider/
│   │   │   └── ConnectorOAuthProvider.java
│   │   ├── repository/
│   │   │   ├── OAuthClientRepository.java
│   │   │   ├── OAuthAuthorizationCodeRepository.java
│   │   │   └── OAuthTokenRepository.java
│   │   └── middleware/
│   │       └── BearerAuthenticator.java
│   └── transport/
│       ├── OAuthHttpStatelessServerTransportProvider.java
│       └── HttpServletStatelessServerTransport.java
└── tools/
    └── (MCP tools implementation)
```

### Integration Points

**OpenMetadata Service Integration**:
- `CollectionDAO.java` - Registers OAuth DAOs
- `DatabaseServiceRepository.java` - Loads connector configurations
- `JwtTokenGenerator.java` - Generates JWT tokens
- `SecretsManager` - Decrypts connector OAuth credentials

## Configuration

### Server Configuration

**McpServer.java**:
```java
String baseUrl = "http://localhost:8585";
String mcpEndpoint = "/mcp";
String defaultConnector = "test-snowflake-mcp";

List<String> allowedOrigins = Arrays.asList(
    "http://localhost:3000",
    "http://localhost:6274",
    "http://localhost:8585",
    "http://localhost:9090"
);
```

### Client Registration Options

```java
ClientRegistrationOptions options = new ClientRegistrationOptions();
options.setAllowLocalhostRedirect(true);  // For development
options.setValidScopes(null);             // Allow any scope (connector-based)
```

## Testing

### Unit Tests

Located in `openmetadata-mcp/src/test/java/`:
- `ConnectorOAuthProviderTest.java` - OAuth provider logic
- `OAuthRepositoryTest.java` - Database operations

### Integration Testing

```bash
# Test complete OAuth flow with default connector
./test-mcp-with-token.sh

# Test with specific connector
# Modify script to add: &connector_name=my-databricks
```

### Manual Testing

```bash
# 1. Discover OAuth endpoints
curl http://localhost:8585/mcp/.well-known/oauth-authorization-server

# 2. Register client
curl -X POST http://localhost:8585/mcp/register \
  -H "Content-Type: application/json" \
  -d '{"client_name":"test","redirect_uris":["http://localhost:3000/callback"]}'

# 3. Generate PKCE and authorize
# (See test scripts for complete example)

# 4. Test MCP endpoint
curl -X POST http://localhost:8585/mcp \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'
```

## References

- **MCP Specification**: https://modelcontextprotocol.io/
- **MCP Java SDK**: https://github.com/modelcontextprotocol/java-sdk
- **OAuth 2.0**: https://datatracker.ietf.org/doc/html/rfc6749
- **PKCE**: https://datatracker.ietf.org/doc/html/rfc7636
- **JWT**: https://datatracker.ietf.org/doc/html/rfc7519

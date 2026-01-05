# MCP OAuth Implementation - Technical Documentation

**Status:** Production Ready
**Last Updated:** January 5, 2025

## Overview

OAuth 2.0 authentication for OpenMetadata's Model Context Protocol (MCP) server using a **connector-based OAuth flow** where the server manages database connector OAuth credentials internally, eliminating end-user authentication.

## Core Concept: Connector-Based OAuth

**Key Innovation:** This is **NOT traditional user OAuth**. Instead of users authenticating with each data source:

| Traditional OAuth | Connector-Based OAuth (This Implementation) |
|------------------|-------------------------------------------|
| User → Login UI → Credentials → Token | Admin → One-time setup → Store credentials in DB |
| Per-user authentication | Server uses stored connector credentials |
| Browser required | No browser, programmatic access |
| Each user needs account | Single connector serves all AI users |

**Flow:**
1. Admin configures connector OAuth credentials (Snowflake, Databricks, etc.) → Stored in database
2. AI assistant requests access → Server issues OpenMetadata JWT
3. Server maps JWT → connector OAuth credentials for data access
4. Server automatically refreshes expired connector tokens

**Benefits:** AI assistants (Claude Desktop) can't open browsers; one setup enables all users; transparent token lifecycle management.

## Architecture

```
┌─────────────────────┐
│   AI Assistant      │
│   (MCP Client)      │
└──────────┬──────────┘
           │ OAuth 2.0 + PKCE
           ▼
┌─────────────────────────────────────────┐
│   MCP OAuth Server                      │
│   ┌─────────────────────────────────┐  │
│   │ OAuth Endpoints                 │  │
│   │ - /.well-known/...  (discovery) │  │
│   │ - /mcp/register     (client)    │  │
│   │ - /mcp/authorize    (auth code) │  │
│   │ - /mcp/token        (JWT)       │  │
│   └─────────────────────────────────┘  │
│   ┌─────────────────────────────────┐  │
│   │ ConnectorOAuthProvider          │  │
│   │ • Load connector credentials    │  │
│   │ • PKCE validation               │  │
│   │ • JWT generation                │  │
│   │ • Auto token refresh            │  │
│   └─────────────────────────────────┘  │
│   ┌─────────────────────────────────┐  │
│   │ Database (OAuth Tables)         │  │
│   │ • oauth_clients                 │  │
│   │ • oauth_authorization_codes     │  │
│   │ • oauth_access_tokens           │  │
│   │ • dbservice_entity (connectors) │  │
│   └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  Snowflake/Databricks│
└─────────────────────┘
```

## Key Components

### 1. OAuth Transport Layer
**File:** `OAuthHttpStatelessServerTransportProvider.java`

HTTP servlet handling OAuth endpoints with CORS, rate limiting (10/min auth, 5/min token), parameter sanitization, and routing.

### 2. OAuth Provider
**File:** `ConnectorOAuthProvider.java` (972 lines)

**Key Methods:**
- `authorize()` - Loads connector OAuth, auto-refreshes if expired, generates auth code with PKCE
- `exchangeAuthorizationCode()` - Verifies PKCE, marks code as used atomically, issues JWT mapped to connector
- `refreshConnectorToken()` - Uses connector's refresh token to get new access token (transparent)

**Connector Selection:** `connector_name` param → state param → default (`test-snowflake-mcp`)

### 3. Database Repositories
- **OAuthClientRepository** - Client registration/retrieval
- **OAuthAuthorizationCodeRepository** - Auth codes with PKCE challenge (10min TTL), atomic usage prevention
- **OAuthTokenRepository** - Access tokens (1hr TTL), refresh tokens (30 days), encrypted storage, connector mapping

### 4. Plugin System
**Interface:** `OAuthConnectorPlugin`
```java
OAuthCredentials extractCredentials(Object config);
String buildTokenEndpoint(Object config, OAuthCredentials oauth);
```

**Built-in:** SnowflakeOAuthPlugin, DatabricksOAuthPlugin
**Benefits:** Easy to add connectors, auto-detection, thread-safe registry

## OAuth Flow

```
1. Discovery       → GET /.well-known/oauth-authorization-server
2. Registration    → POST /mcp/register {client_name, redirect_uris}
3. Authorization   → GET /mcp/authorize?code_challenge=<SHA256>&connector_name=<name>
   Server: Load connector OAuth → Auto-refresh if expired → Generate auth code
4. Token Exchange  → POST /mcp/token {code, code_verifier}
   Server: Verify PKCE → Mark code used (atomic) → Issue JWT → Map to connector
5. MCP Requests    → POST /mcp Authorization: Bearer <JWT>
   Server: Validate JWT → Load connector OAuth → Execute tool
```

### PKCE Security
1. Client: `code_verifier` (random 43-128 chars) → `code_challenge = SHA256(code_verifier)`
2. Send `code_challenge` in authorization
3. Send `code_verifier` in token exchange
4. Server verifies: `SHA256(code_verifier) == stored_code_challenge`

## Database Schema

**oauth_clients**
```sql
CREATE TABLE oauth_clients (
    client_id VARCHAR(255) PRIMARY KEY,
    client_name VARCHAR(255),
    redirect_uris TEXT,  -- JSON array
    grant_types TEXT,
    created_at BIGINT
);
```

**oauth_authorization_codes**
```sql
CREATE TABLE oauth_authorization_codes (
    code VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255),
    connector_name VARCHAR(255),  -- Maps to connector
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),
    expires_at BIGINT,  -- 10 minutes
    used BOOLEAN DEFAULT FALSE
);
```

**oauth_access_tokens**
```sql
CREATE TABLE oauth_access_tokens (
    token_hash VARCHAR(255) PRIMARY KEY,  -- SHA256
    token_encrypted TEXT,  -- Fernet AES-128-CBC
    connector_name VARCHAR(255),  -- JWT → connector mapping
    expires_at BIGINT,  -- 1 hour
    created_at BIGINT
);
```

**Connector OAuth Storage** (`dbservice_entity.json`):
```json
{
  "name": "my-snowflake",
  "connection": {
    "config": {
      "oauth": {
        "clientId": "base64_encoded",
        "clientSecret": "base64_encoded",
        "accessToken": "current_token",
        "refreshToken": "refresh_token",
        "expiresAt": 1735123456
      }
    }
  }
}
```

## Security Features

| Feature | Implementation | Purpose |
|---------|---------------|---------|
| **PKCE** | SHA-256 code challenge/verifier | Prevents authorization code interception |
| **Token Encryption** | Fernet (AES-128-CBC) | At-rest protection |
| **Token Hashing** | SHA-256 for lookups | Fast queries without exposing tokens |
| **Atomic Code Usage** | `UPDATE WHERE used=FALSE` | Prevents race conditions |
| **Rate Limiting** | 10/min auth, 5/min token | Prevents brute force |
| **CORS** | Origin allowlist | Development mode auto-detection |
| **SSRF Prevention** | HTTPS enforcement, no private IPs | Blocks internal network access |
| **Log Sanitization** | Redact tokens/codes | Prevents credential leakage |

## Implementation Highlights

### Core Logic: authorize()
```java
public AuthorizationCode authorize(AuthorizationParams params) {
    String connectorName = selectConnectorName(params);
    Object config = loadConnectorConfig(connectorName);
    OAuthCredentials oauth = plugin.extractCredentials(config);
    oauth = secretsManager.decryptOAuthCredentials(oauth);

    if (oauth.isExpired()) {
        oauth = refreshConnectorToken(config, oauth, plugin);
        updateConnectorCredentials(connectorName, config, oauth);
    }

    String code = UUID.randomUUID().toString();
    authorizationCodeRepository.save(code, params.codeChallenge(), connectorName);
    return authCode;
}
```

### Core Logic: exchangeAuthorizationCode()
```java
public OAuthToken exchangeAuthorizationCode(TokenRequest request) {
    AuthorizationCode dbCode = codeRepository.findByCode(request.code());

    // Verify PKCE
    String computedChallenge = SHA256(request.codeVerifier());
    if (!computedChallenge.equals(dbCode.codeChallenge())) {
        throw new TokenException("PKCE verification failed");
    }

    // Atomic code usage
    if (!codeRepository.markAsUsedAtomic(request.code())) {
        throw new TokenException("Code already used");
    }

    // Issue JWT mapped to connector
    String jwt = jwtGenerator.generateToken(userName, 3600);
    tokenRepository.storeAccessToken(
        hash(jwt), encrypt(jwt), dbCode.connectorName()
    );
    return new OAuthToken(jwt, "Bearer", 3600, refreshToken);
}
```

### Token Refresh
```java
private OAuthCredentials refreshConnectorToken(Object config, OAuthCredentials oauth) {
    String tokenEndpoint = plugin.buildTokenEndpoint(config, oauth);  // SSRF-safe
    HttpPost request = new HttpPost(tokenEndpoint);
    request.addHeader("Authorization", "Basic " + base64(clientId + ":" + clientSecret));
    request.setEntity(formParams("grant_type=refresh_token&refresh_token=" + oauth.getRefreshToken()));

    JsonNode response = httpClient.execute(request);
    oauth.setAccessToken(response.get("access_token"));
    oauth.setExpiresAt(now + response.get("expires_in"));
    return oauth;
}
```

### Security: Rate Limiting
```java
public class SimpleRateLimiter {
    private final ConcurrentHashMap<String, Queue<Long>> timestamps;

    public void checkRateLimit(String key) {
        Queue<Long> times = timestamps.computeIfAbsent(key, k -> new ConcurrentLinkedQueue<>());
        times.removeIf(t -> t < now - windowMs);
        if (times.size() >= maxRequests) throw new RateLimitException();
        times.add(now);
    }
}
```

### Database Operations
```sql
-- Store auth code with PKCE
INSERT INTO oauth_authorization_codes (code, connector_name, code_challenge)
VALUES ('AUTH_CODE', 'snowflake-prod', 'SHA256_CHALLENGE');

-- Atomic code usage (prevents replay)
UPDATE oauth_authorization_codes SET used = TRUE
WHERE code = ? AND used = FALSE RETURNING *;

-- Store JWT with connector mapping
INSERT INTO oauth_access_tokens (token_hash, token_encrypted, connector_name)
VALUES ('SHA256_JWT', 'FERNET_JWT', 'snowflake-prod');

-- MCP request lookup
SELECT connector_name FROM oauth_access_tokens WHERE token_hash = 'SHA256_JWT';
```

**Indexes:**
```sql
CREATE INDEX idx_token_hash ON oauth_access_tokens(token_hash);
CREATE INDEX idx_connector_name ON oauth_access_tokens(connector_name);
CREATE INDEX idx_code_used ON oauth_authorization_codes(code, used, expires_at);
```

## Configuration

### Server Setup
```java
String baseUrl = "http://localhost:8585";
boolean isDevelopmentMode = baseUrl.contains("localhost");

List<String> allowedOrigins = isDevelopmentMode
    ? Arrays.asList("http://localhost:3000", "http://localhost:6274")
    : Collections.emptyList();  // Production: same-origin only
```

### Adding OAuth to Connector

**Via SQL:**
```sql
UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.oauth', JSON_OBJECT(
    'clientId', '<base64_id>',
    'clientSecret', '<base64_secret>',
    'accessToken', '<token>',
    'refreshToken', '<refresh>',
    'expiresAt', UNIX_TIMESTAMP() + 3600
))
WHERE name = 'your-connector';
```

**Via API:**
```bash
curl -X PATCH "http://localhost:8585/api/v1/services/databaseServices/{id}" \
  -H "Content-Type: application/json-patch+json" \
  -d '[{"op": "add", "path": "/connection/config/oauth", "value": {...}}]'
```

**Supported Connectors:** Snowflake (tested), Databricks, BigQuery, Azure SQL, Redshift

## Code Organization

```
openmetadata-mcp/src/main/java/org/openmetadata/mcp/
├── McpServer.java                      # Initialization
├── McpAuthFilter.java                  # JWT validation
├── auth/
│   ├── AuthorizationParams.java        # Request models
│   └── OAuthToken.java                 # Response models
├── server/auth/
│   ├── handlers/                       # HTTP request handlers
│   │   ├── AuthorizationHandler.java
│   │   ├── TokenHandler.java
│   │   └── RegistrationHandler.java
│   ├── provider/
│   │   └── ConnectorOAuthProvider.java # Core OAuth logic
│   ├── repository/                     # Database persistence
│   │   ├── OAuthClientRepository.java
│   │   ├── OAuthAuthorizationCodeRepository.java
│   │   └── OAuthTokenRepository.java
│   └── plugins/                        # Connector plugins
│       ├── SnowflakeOAuthPlugin.java
│       └── DatabricksOAuthPlugin.java
└── tools/                              # MCP tools
```

**Integration:** `CollectionDAO` (OAuth DAOs), `DatabaseServiceRepository` (connector configs), `JwtTokenGenerator` (JWT), `SecretsManager` (decrypt)

## Testing

**Quick Test:**
```bash
./test-mcp-with-token.sh  # Uses test-snowflake-mcp
```

**Manual Test:**
```bash
# 1. Discovery
curl http://localhost:8585/mcp/.well-known/oauth-authorization-server

# 2. Register
curl -X POST http://localhost:8585/mcp/register \
  -d '{"client_name":"test","redirect_uris":["http://localhost:3000/callback"]}'

# 3. Authorize (get code)
# 4. Exchange code for JWT
# 5. Use JWT for MCP requests
```

**Unit Tests:** `ConnectorOAuthProviderTest.java` (PKCE, token exchange)

## References

- **MCP Specification**: https://modelcontextprotocol.io/
- **MCP Java SDK**: https://github.com/modelcontextprotocol/java-sdk
- **OAuth 2.0**: https://datatracker.ietf.org/doc/html/rfc6749
- **PKCE**: https://datatracker.ietf.org/doc/html/rfc7636
- **JWT**: https://datatracker.ietf.org/doc/html/rfc7519

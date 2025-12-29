# MCP OAuth Implementation

**Branch:** `oauth-mcp`
**Status:** OAuth flow working, MCP Inspector SSE connection pending investigation
**Last Updated:** December 29, 2024

## Overview

This branch implements OAuth 2.0 with PKCE for Model Context Protocol (MCP) connectors in OpenMetadata. The implementation provides a **connector-based OAuth flow** where the server manages connector credentials directly, eliminating the need for users to authenticate via browser redirects.

## Architecture

### Core Components

1. **OAuth Transport**: `OAuthHttpStatelessServerTransportProvider.java`
   - Handles OAuth discovery, registration, authorization, and token endpoints
   - Endpoints: `/mcp/.well-known/oauth-authorization-server`, `/mcp/authorize`, `/mcp/token`, `/mcp/register`

2. **OAuth Provider**: `ConnectorOAuthProvider.java`
   - Manages connector-based OAuth flow
   - Handles authorization code generation and token exchange
   - Automatic token refresh for connectors (Snowflake tested)

3. **Database Persistence**:
   - `OAuthClientRepository` - OAuth client registrations
   - `OAuthAuthorizationCodeRepository` - Authorization codes with PKCE
   - `OAuthTokenRepository` - Access and refresh tokens
   - Tables: `oauth_clients`, `oauth_authorization_codes`, `oauth_access_tokens`, `oauth_refresh_tokens`

4. **Encryption**: Fernet symmetric encryption for storing OAuth tokens securely

## Implementation Details

### OAuth Flow

1. **Client Registration** (`/mcp/register`)
   - MCP client registers with server
   - Receives client_id (no client_secret for public clients)

2. **Authorization** (`/mcp/authorize`)
   - Client initiates authorization with PKCE challenge
   - Server extracts connector name from `connector_name` parameter or defaults to `test-snowflake-mcp`
   - Server uses stored connector credentials to authenticate with provider (e.g., Snowflake)
   - Returns authorization code

3. **Token Exchange** (`/mcp/token`)
   - Client exchanges authorization code for access token
   - Server validates PKCE verifier, client_id, and redirect_uri
   - Returns JWT access token mapped to connector's OAuth token

4. **Token Refresh**
   - Automatic token refresh when connector tokens expire
   - Uses stored refresh tokens

### Key Fixes Applied

#### 1. Scope Validation Fix
**File**: `RegistrationHandler.java`, `McpServer.java`
**Issue**: Scope validation was rejecting scopes not in whitelist
**Fix**: Set `validScopes` to null to skip validation for connector-based OAuth

#### 2. Metadata Endpoint URLs
**File**: `OAuthHttpStatelessServerTransportProvider.java:113-118`
**Issue**: OAuth discovery endpoints missing `/mcp` prefix
**Fix**: Added `mcpEndpoint` variable to all endpoint URLs

#### 3. Client Authentication in Token Exchange
**File**: `OAuthHttpStatelessServerTransportProvider.java:462-504`
**Issue**: Missing client_id and redirect_uri validation during token exchange
**Fix**: Added validation to ensure authorization code was issued to requesting client

#### 4. Time Unit Consistency
**Files**: `OAuthTokenRepository.java:177-182`, `OAuthAuthorizationCodeRepository.java:77-81`
**Issue**: Expired token cleanup used milliseconds instead of seconds
**Fix**: Changed to `Instant.now().getEpochSecond()`

#### 5. Authorization Code Loading
**File**: `ConnectorOAuthProvider.java:492-514`
**Issue**: `loadAuthorizationCode()` returned empty object instead of loading from database
**Fix**: Load all fields from database and populate AuthorizationCode object

#### 6. MCP Inspector Compatibility
**Files**: `AuthorizationParams.java`, `AuthorizationHandler.java`, `ConnectorOAuthProvider.java:169-205`
**Issue**: MCP Inspector uses `state` parameter for CSRF (random 64-char hex hash), not connector name
**Fix**:
- Added `connector_name` parameter support
- Detect random hashes vs connector names
- Default to `test-snowflake-mcp` connector for testing

## Testing

### Test Scripts

Located in project root:

1. **test-default-connector.sh** - Tests default connector with random hash state
   ```bash
   ./test-default-connector.sh
   ```

### MCP Inspector Testing

1. **Build and deploy**:
   ```bash
   cd openmetadata-mcp
   mvn clean package -DskipTests
   docker cp target/openmetadata-mcp-1.12.0-SNAPSHOT.jar openmetadata_server:/opt/openmetadata/libs/
   docker restart openmetadata_server
   ```

2. **Run MCP Inspector**:
   ```bash
   npx @modelcontextprotocol/inspector http://localhost:8585/mcp
   ```

### Current Test Results

✅ OAuth flow working:
- Client registration succeeds
- Authorization succeeds (with default connector fallback)
- Token exchange succeeds
- Tokens stored in database

⚠️ MCP Inspector connection error:
- OAuth authentication completes successfully
- SSE connection fails: "Connection Error - Check if your MCP server is running and proxy token is correct"
- Issue is with MCP protocol SSE connection, not OAuth

## Database Configuration

### Snowflake OAuth Credentials

Test connector `test-snowflake-mcp` configured with OAuth credentials:

```sql
UPDATE dbservice_entity
SET json = JSON_SET(
    json,
    '$.connection.config.oauth', JSON_OBJECT(
        'clientId', '7ln6la3T0vzF4Nh0ttFw+1ULjkU=',
        'clientSecret', '2lduQWNOg4UKPiUVQXowVmxd5aS7rp/esu4GNcRCqcM=',
        'accessToken', 'ver:1-hint:754067412131846-...',
        'refreshToken', 'ver:2-hint:11506176005-...',
        'tokenEndpoint', 'https://FMFAHQK-GI58232.snowflakecomputing.com/oauth/token-request',
        'expiresAt', UNIX_TIMESTAMP() + 599
    )
)
WHERE name = 'test-snowflake-mcp';
```

## Database Schema

Migration: `bootstrap/sql/migrations/native/1.12.1/postgres/schemaChanges.sql`

Tables created:
- `oauth_clients` - OAuth client registrations
- `oauth_authorization_codes` - Authorization codes with PKCE challenge/method
- `oauth_access_tokens` - Access tokens with expiration
- `oauth_refresh_tokens` - Refresh tokens for token renewal

## Known Issues

### 1. MCP Inspector SSE Connection Failure

**Status**: Under investigation
**Symptoms**: OAuth succeeds but "Connection Error" when clicking Connect button
**Possible Causes**:
- CORS configuration for SSE
- Network routing in Docker
- MCP Inspector proxy token handling
- SSE endpoint authentication

### 2. Shell Script Parse Errors

**Issue**: macOS uses zsh by default, causing `(eval):1: parse error near )` with complex bash commands
**Solution**: Create scripts with `#!/bin/bash` shebang and execute as files
**Reference**: `.shell-fix-note`

## File Structure

### Core Implementation
```
openmetadata-mcp/
├── src/main/java/org/openmetadata/mcp/
│   ├── McpServer.java                          # MCP server initialization
│   ├── auth/
│   │   └── AuthorizationParams.java            # Authorization parameters (added connector_name)
│   ├── server/
│   │   ├── auth/
│   │   │   ├── handlers/
│   │   │   │   ├── AuthorizationHandler.java   # Extracts connector_name parameter
│   │   │   │   └── RegistrationHandler.java    # Client registration with scope validation fix
│   │   │   ├── provider/
│   │   │   │   └── ConnectorOAuthProvider.java # Core OAuth logic with default connector
│   │   │   └── repository/
│   │   │       ├── OAuthClientRepository.java
│   │   │       ├── OAuthAuthorizationCodeRepository.java # Fixed time units
│   │   │       └── OAuthTokenRepository.java   # Fixed time units
│   │   └── transport/
│   │       └── OAuthHttpStatelessServerTransportProvider.java  # All endpoints + validations
│   └── OAuthWellKnownFilter.java              # OAuth discovery
```

### Database DAOs
```
openmetadata-service/
└── src/main/java/org/openmetadata/service/
    └── jdbi3/
        ├── oauth/
        │   └── OAuthRecords.java               # Database record types
        ├── CollectionDAO.java                  # OAuth DAO registration
        └── DatabaseServiceRepository.java      # Database service queries
```

## Next Steps

1. **Investigate MCP Inspector connection error**
   - Check SSE endpoint authentication
   - Verify CORS headers for SSE
   - Test with curl to isolate issue

2. **Fix SSE connection**
   - Implement solution based on investigation
   - Test end-to-end MCP connection

3. **Production readiness**
   - Add comprehensive unit tests
   - Implement scope-based authorization
   - Add audit logging
   - Support additional connectors (Databricks, BigQuery, Redshift)

## References

- **MCP SDK**: https://github.com/modelcontextprotocol/java-sdk
- **OAuth 2.0 with PKCE**: https://datatracker.ietf.org/doc/html/rfc7636
- **OpenMetadata**: https://open-metadata.org

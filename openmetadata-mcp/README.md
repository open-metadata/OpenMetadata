# OpenMetadata MCP (Model Context Protocol)

OAuth-enabled MCP server for OpenMetadata that allows AI assistants to securely access and interact with your data catalog.

## What This Is

**MCP (Model Context Protocol)** is a standard for connecting AI assistants (like Claude, ChatGPT) to data sources and tools. This module implements an MCP server with **connector-based OAuth authentication**, allowing AI assistants to:

- Search your data catalog
- Analyze data lineage
- Create glossary terms
- Query metadata
- Access data through your existing database connectors (Snowflake, Databricks, BigQuery, etc.)

## Key Features

✅ **Connector-Based OAuth** - Uses your existing database connector's OAuth credentials (no separate user authentication needed)
✅ **Automatic Token Refresh** - Handles OAuth token expiration automatically
✅ **Multi-Connector Support** - Works with ANY connector that has OAuth configured
✅ **Secure** - Full OAuth 2.0 with PKCE, JWT tokens, encrypted storage
✅ **MCP Standard Compliant** - Works with any MCP-compatible client

## How It Works

### Architecture

```
AI Assistant → MCP Client → OAuth Flow → OpenMetadata MCP Server
                                              ↓
                                    Connector OAuth (Snowflake/etc.)
                                              ↓
                                         Data Source
```

### OAuth Flow

1. **Discovery**: Client discovers OAuth endpoints via `.well-known/oauth-authorization-server`
2. **Registration**: Client registers with server (gets client_id)
3. **Authorization**: Client requests authorization (server uses connector's OAuth internally)
4. **Token Exchange**: Client exchanges authorization code for JWT access token
5. **MCP Requests**: Client uses JWT to call MCP tools (server maps JWT → connector OAuth)

### Connector Selection

When authorizing, the server picks which connector to use:

1. **connector_name parameter** - Explicit connector in URL: `&connector_name=my-snowflake`
2. **state parameter** - If state looks like connector name (not random hash)
3. **Default connector** - Falls back to `test-snowflake-mcp`

This allows one MCP server to support multiple data sources.

## Quick Start

### 1. Configure OAuth for a Database Service

Add OAuth credentials to your database service:

```sql
UPDATE dbservice_entity
SET json = JSON_SET(
    json,
    '$.connection.config.oauth', JSON_OBJECT(
        'clientId', 'base64_encoded_client_id',
        'clientSecret', 'base64_encoded_client_secret',
        'accessToken', 'current_access_token',
        'refreshToken', 'refresh_token',
        'tokenEndpoint', 'https://provider.com/oauth/token',
        'expiresAt', UNIX_TIMESTAMP() + 3600
    )
)
WHERE name = 'your-connector-name';
```

### 2. Start OpenMetadata Server

The MCP server runs automatically when OpenMetadata starts:

```bash
# MCP endpoints available at:
# http://localhost:8585/mcp
```

### 3. Test the MCP Server

```bash
cd openmetadata-mcp
./test-mcp-with-token.sh
```

## OAuth Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/oauth-authorization-server` | GET | OAuth discovery (metadata) |
| `/mcp/register` | POST | Client registration |
| `/mcp/authorize` | GET | Authorization request |
| `/mcp/token` | POST | Token exchange |
| `/mcp/revoke` | POST | Token revocation |
| `/mcp` | POST | MCP JSON-RPC requests |

## MCP Tools Available

Once authenticated, AI assistants can use these tools:

- **search_metadata** - Search data catalog with natural language
- **get_entity_details** - Get detailed info about tables, dashboards, etc.
- **get_entity_lineage** - Analyze upstream/downstream dependencies
- **create_glossary** - Create business glossaries
- **create_glossary_term** - Define business terms
- **patch_entity** - Update entity metadata

## Supported Connectors

Works with any OpenMetadata database service that has OAuth configured:

| Connector | OAuth Type | Status |
|-----------|------------|--------|
| Snowflake | Native OAuth | ✅ Tested |
| Databricks | Native OAuth | ⚠️ Configure OAuth |
| BigQuery | Google OAuth | ⚠️ Configure OAuth |
| Azure SQL | Azure AD OAuth | ⚠️ Configure OAuth |
| Redshift | AWS IAM | ⚠️ Configure OAuth |

## Security

- **OAuth 2.0 + PKCE** - Prevents authorization code interception
- **JWT Tokens** - OpenMetadata JWTs mapped to connector OAuth
- **Encrypted Storage** - Fernet encryption for OAuth tokens in database
- **Token Hashing** - SHA-256 for secure lookups
- **CORS Protection** - Origin validation for web clients
- **Automatic Expiry** - Token cleanup on expiration

## Configuration

Default configuration in `McpServer.java`:

- **Base URL**: `http://localhost:8585`
- **MCP Endpoint**: `/mcp`
- **Default Connector**: `test-snowflake-mcp`
- **Allowed Origins**: `localhost:3000, localhost:6274, localhost:8585, localhost:9090`
- **Client Registration**: Enabled with localhost redirect support

## Database Schema

OAuth data stored in PostgreSQL/MySQL:

- `oauth_clients` - Registered OAuth clients
- `oauth_authorization_codes` - Authorization codes (with PKCE)
- `oauth_access_tokens` - JWT access tokens
- `oauth_refresh_tokens` - Refresh tokens for token renewal

Migration: `bootstrap/sql/migrations/native/1.12.1/postgres/schemaChanges.sql`

## Documentation

- **[Implementation Guide](docs/MCP_OAUTH_IMPLEMENTATION.md)** - Technical details and file changes
- **[Testing Guide](docs/MCP_TESTING_GUIDE.md)** - How to test with different connectors

## Troubleshooting

### "Connector not found"
Check database service exists: `SELECT name FROM dbservice_entity WHERE name='your-connector'`

### "OAuth credentials not configured"
Add OAuth to service: See "Configure OAuth" section above

### "Access token expired"
Automatic refresh should handle this. Check refresh token is valid.

### "CORS error"
Add your origin to allowed origins in `McpServer.java` line 145-153

## Development

### Build
```bash
mvn clean package -DskipTests
```

### Run Tests
```bash
mvn test
```

### Key Classes

- **McpServer.java** - Server initialization and configuration
- **ConnectorOAuthProvider.java** - OAuth flow logic
- **OAuthHttpStatelessServerTransportProvider.java** - OAuth endpoints
- **McpAuthFilter.java** - Authentication filter
- **OAuthTokenRepository.java** - Token database operations
- **OAuthClientRepository.java** - Client database operations

## Contributing

See main [CONTRIBUTING.md](../CONTRIBUTING.md)

## License

See main [LICENSE](../LICENSE)

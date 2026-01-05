# MCP OAuth Testing Guide

## Overview

The MCP OAuth implementation is **connector-agnostic** and works with ANY database service that has OAuth credentials configured in OpenMetadata.

**Status:** ✅ Production Ready

## Quick Start

### Simple Test (Default Connector)

```bash
cd openmetadata-mcp
./test-mcp-with-token.sh  # Uses test-snowflake-mcp
```

 This will:
1. Complete OAuth flow (gets authorization code → exchanges for JWT token)
2. Test MCP initialize request
3. List available MCP tools

### Test with Specific Connector

```bash
export MCP_DEFAULT_CONNECTOR="your-connector-name"
./test-mcp-with-token.sh
```

## Setup Instructions

### Creating a Test Connector with OAuth

**Option 1: Using API**

```bash
# 1. Create credential file (see scripts/mcp-oauth-tests/create-snowflake-service.json.example)
cp scripts/mcp-oauth-tests/create-snowflake-service.json.example my-connector.json

# 2. Fill in your OAuth credentials (get from Snowflake/Databricks OAuth setup)
# Edit my-connector.json with:
#   - clientId/clientSecret (Base64 encoded)
#   - accessToken/refreshToken
#   - tokenEndpoint
#   - expiresAt (Unix timestamp)

# 3. Create service via API
export OM_TOKEN="your-admin-jwt-token"
curl -X POST "http://localhost:8585/api/v1/services/databaseServices" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OM_TOKEN" \
  -d @my-connector.json
```

**Option 2: Using SQL (Direct Database)**

```sql
UPDATE dbservice_entity
SET json = JSON_SET(
    json,
    '$.connection.config.oauth', JSON_OBJECT(
        'clientId', '<base64_client_id>',
        'clientSecret', '<base64_client_secret>',
        'accessToken', '<access_token>',
        'refreshToken', '<refresh_token>',
        'tokenEndpoint', '<token_endpoint>',
        'expiresAt', UNIX_TIMESTAMP() + 3600
    )
)
WHERE name = 'your-connector-name';
```

### Security Notes

⚠️ **Important**: Actual credential files are gitignored and should NEVER be committed.

- ✅ Use `.json.example` files as templates (safe to commit)
- ❌ Never commit files with actual credentials
- ✅ Tokens are encrypted when stored in OpenMetadata database
- ❌ Never share your access/refresh tokens

## Testing with Other Connectors

### Option 1: Use connector_name Parameter

Specify which connector to use during OAuth authorization:

```bash
# Example: Test with Databricks connector
curl "http://localhost:8585/mcp/authorize?\
response_type=code&\
client_id=openmetadata-mcp-client&\
redirect_uri=http://localhost:3000/callback&\
scope=openid%20profile&\
code_challenge=<PKCE_CHALLENGE>&\
code_challenge_method=S256&\
state=<RANDOM_STATE>&\
connector_name=my-databricks-connector"  # Specify connector name
```

### Option 2: Change Default Connector

Edit `ConnectorOAuthProvider.java` line 190:
```java
// Change default from test-snowflake-mcp to your connector
connectorName = "my-databricks-connector";
```

Then rebuild and restart.

## Supported Database Services

Any OpenMetadata database service with OAuth credentials can be used:

| Service | OAuth Support | Status |
|---------|---------------|--------|
| Snowflake | ✅ Native | ✅ Tested & Working |
| Databricks | ✅ Native | ⚠️ Needs OAuth config |
| BigQuery | ✅ Native | ⚠️ Needs OAuth config |
| Azure SQL | ✅ Native | ⚠️ Needs OAuth config |
| Redshift | ✅ Via IAM | ⚠️ Needs OAuth config |

## How the Connector-Agnostic Flow Works

1. **OAuth Request**: Client sends authorization request (with or without connector_name)
2. **Connector Selection**:
   - If `connector_name` parameter provided → use that connector
   - Else if `state` looks like connector name → use state
   - Else → use default connector (`test-snowflake-mcp`)
3. **Load Connector OAuth**: Server loads OAuth credentials from database for selected connector
4. **Token Refresh**: If connector's access token expired, automatically refresh using refresh token
5. **Generate MCP Token**: Server generates OpenMetadata JWT mapped to connector's OAuth token
6. **MCP Requests**: Client uses JWT to access MCP endpoints, server uses mapped connector OAuth internally

## Architecture Diagram

```
┌─────────────────┐
│  MCP Client     │
│  (AI Assistant) │
└────────┬────────┘
         │ 1. OAuth Flow
         ▼
┌─────────────────────────────────────┐
│  MCP OAuth Provider                 │
│  ┌───────────────────────────────┐ │
│  │ Connector Selection Logic     │ │
│  │ - connector_name param        │ │
│  │ - state param fallback        │ │
│  │ - default: test-snowflake-mcp│ │
│  └───────────────────────────────┘ │
│                │                     │
│                ▼                     │
│  ┌───────────────────────────────┐ │
│  │ Load Connector OAuth from DB  │ │
│  │ - clientId / clientSecret     │ │
│  │ - accessToken / refreshToken  │ │
│  │ - Check expiry & auto-refresh │ │
│  └───────────────────────────────┘ │
│                │                     │
│                ▼                     │
│  ┌───────────────────────────────┐ │
│  │ Generate OpenMetadata JWT     │ │
│  │ - User: admin                 │ │
│  │ - Roles: from user entity     │ │
│  │ - Mapped to connector OAuth   │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  MCP Tools      │
│  - Search       │
│  - Lineage      │
│  - Glossary     │
└─────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Connector Data Source  │
│  (Snowflake/Databricks) │
└─────────────────────────┘
```

## Testing Scenarios

### Scenario 1: Test Default Connector
```bash
./test-mcp-with-token.sh
# Uses test-snowflake-mcp automatically
```

### Scenario 2: Test Specific Connector
```bash
# Modify test script to add connector_name parameter
# Edit line 13 in test-mcp-with-token.sh:
connector_name=my-databricks-connector

# Then run
./test-mcp-with-token.sh
```

### Scenario 3: Test Multiple Connectors
```bash
for connector in "snowflake-prod" "databricks-dev" "bigquery-analytics"; do
  echo "Testing $connector..."
  # Use modified script with connector_name=$connector
done
```

## Troubleshooting

### Error: "Connector not found"
**Cause**: Database service with specified name doesn't exist
**Solution**: Verify connector name in OpenMetadata UI or database

### Error: "OAuth credentials not configured"
**Cause**: Database service exists but has no OAuth config
**Solution**: Add OAuth credentials via API or SQL

### Error: "Access token expired"
**Cause**: Connector's access token is expired and no refresh token
**Solution**: Update connector with fresh OAuth tokens

### Error: "PKCE verification failed"
**Cause**: Testing issue - code_verifier doesn't match code_challenge
**Solution**: Use provided test scripts which handle PKCE correctly

### Getting Fresh Tokens
If your tokens expire, use your connector's OAuth flow to get new tokens:
1. For Snowflake: Follow Snowflake OAuth setup guide
2. For Databricks: Use Databricks OAuth integration
3. Update your connector with fresh `accessToken`, `refreshToken`, and `expiresAt`

## Additional Resources

- **Implementation Details**: See [MCP_OAUTH_IMPLEMENTATION.md](MCP_OAUTH_IMPLEMENTATION.md)
- **Example Credential Files**: `scripts/mcp-oauth-tests/*.json.example`
- **Test Scripts**: `test-mcp-with-token.sh`

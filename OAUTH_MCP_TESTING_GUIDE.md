# OAuth MCP Testing Guide

## Complete Workflow Overview

This guide demonstrates the **redirect-free OAuth flow** for OpenMetadata MCP Server.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ONE-TIME SETUP (Admin, via OpenMetadata UI or API)          │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
         Admin completes OAuth with Snowflake in browser
                         │
                         ▼
         POST /mcp/oauth/setup (stores encrypted tokens)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ AUTOMATED MCP CONNECTION (Zero user interaction!)           │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
         MCP Client → GET /mcp/authorize?connector_name=...
                         │
                         ▼
         ConnectorOAuthProvider (internal token refresh if needed)
                         │
                         ▼
         MCP Client receives auth code → exchanges for token
                         │
                         ▼
         MCP Client calls tools using OpenMetadata data ✅
```

## Prerequisites

1. **OpenMetadata Instance** running (port 8585)
2. **Snowflake Account** with OAuth configured
3. **MCP Inspector** tool: `npm install -g @modelcontextprotocol/inspector`

## Step 1: One-Time OAuth Setup (Admin)

### 1.1 Create OAuth App in Snowflake

1. Go to Snowflake Account → Admin → Security Integrations
2. Create OAuth integration:
   ```sql
   CREATE SECURITY INTEGRATION openmetadata_oauth
     TYPE = OAUTH
     ENABLED = TRUE
     OAUTH_CLIENT = CUSTOM
     OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
     OAUTH_REDIRECT_URI = 'http://localhost:3000/oauth/callback'
     OAUTH_ISSUE_REFRESH_TOKENS = TRUE
     OAUTH_REFRESH_TOKEN_VALIDITY = 7776000; -- 90 days
   ```

3. Note down:
   - `OAUTH_CLIENT_ID`
   - `OAUTH_CLIENT_SECRET`
   - Authorization URL: `https://<account>.snowflakecomputing.com/oauth/authorize`

### 1.2 Complete OAuth Flow in Browser

1. Build authorization URL:
   ```
   https://<account>.snowflakecomputing.com/oauth/authorize?
     client_id=<OAUTH_CLIENT_ID>
     &response_type=code
     &redirect_uri=http://localhost:3000/oauth/callback
     &scope=session:role:ACCOUNTADMIN
   ```

2. Open URL in browser, approve access
3. Snowflake redirects to: `http://localhost:3000/oauth/callback?code=<AUTHORIZATION_CODE>`
4. Copy the `<AUTHORIZATION_CODE>` from URL

### 1.3 Store OAuth Credentials via API

```bash
curl -X POST http://localhost:8585/api/v1/mcp/oauth/setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -d '{
    "connectorName": "snowflake_prod",
    "authorizationCode": "<AUTHORIZATION_CODE>",
    "redirectUri": "http://localhost:3000/oauth/callback",
    "clientId": "<OAUTH_CLIENT_ID>",
    "clientSecret": "<OAUTH_CLIENT_SECRET>",
    "tokenEndpoint": "https://<account>.snowflakecomputing.com/oauth/token-request"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "OAuth credentials stored successfully for snowflake_prod",
  "tokenExpiry": "2025-12-22T14:30:00Z"
}
```

✅ **Setup Complete!** OAuth credentials are now encrypted and stored in OpenMetadata database.

## Step 2: Test MCP Connection (Zero User Interaction)

### 2.1 Using MCP Inspector

```bash
npx @modelcontextprotocol/inspector \
  --url http://localhost:8585/mcp \
  --auth-type oauth2 \
  --auth-params connector_name=snowflake_prod
```

**What Happens Internally:**

1. Inspector calls `/mcp/authorize?connector_name=snowflake_prod`
2. `ConnectorOAuthProvider` loads encrypted OAuth credentials from database
3. Checks if access token expired
4. **If expired:** Calls Snowflake token endpoint with refresh token (server-side, invisible to MCP client)
5. Returns authorization code to Inspector
6. Inspector exchanges code for MCP access token
7. Inspector can now call MCP tools

✅ **No browser opened, no user interaction!**

### 2.2 Verify Token Refresh Works

1. Wait for access token to expire (default: 1 hour)
2. Connect MCP client again:
   ```bash
   npx @modelcontextprotocol/inspector \
     --url http://localhost:8585/mcp \
     --auth-type oauth2 \
     --auth-params connector_name=snowflake_prod
   ```

3. Check OpenMetadata logs:
   ```
   INFO ConnectorOAuthProvider - Access token expired for snowflake_prod, refreshing internally
   INFO ConnectorOAuthProvider - Calling connector token endpoint internally
   INFO ConnectorOAuthProvider - Token refresh successful, new expiry: 2025-12-22T15:30:00Z
   INFO ConnectorOAuthProvider - Updated stored OAuth credentials
   ```

✅ **Token automatically refreshed without user interaction!**

## Step 3: Use MCP Tools

Once connected, MCP Inspector can call OpenMetadata tools:

```javascript
// List available tools
tools.list()

// Search metadata
tools.call("search_metadata", {
  "query": "customer table",
  "entityTypes": ["table"]
})

// Get table details
tools.call("get_table_details", {
  "fullyQualifiedName": "snowflake_db.public.customers"
})
```

## Troubleshooting

### Error: "Connector not found"

**Cause:** Database service doesn't exist in OpenMetadata

**Fix:**
```bash
# Create database service first
curl -X POST http://localhost:8585/api/v1/services/databaseServices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -d '{
    "name": "snowflake_prod",
    "serviceType": "Snowflake",
    "connection": {
      "config": {
        "type": "Snowflake",
        "account": "<account>.us-east-1.aws",
        "warehouse": "COMPUTE_WH",
        "authType": "oauth2"
      }
    }
  }'
```

### Error: "Connector does not have OAuth configured"

**Cause:** OAuth credentials not set up yet

**Fix:** Complete Step 1.3 (OAuth setup endpoint)

### Error: "Token refresh failed"

**Cause:** Refresh token expired (default: 90 days) or revoked

**Fix:** Re-run OAuth setup (Step 1) to get new tokens

### Error: "invalid_grant"

**Cause:** Authorization code already used or expired

**Fix:** Get fresh authorization code (Step 1.2) - codes expire in 10 minutes

## Security Notes

1. **OAuth credentials are encrypted** via OpenMetadata's SecretsManager
2. **Refresh tokens are long-lived** (90 days) - rotate them periodically
3. **No credentials in logs** - only masked values logged
4. **HTTPS required in production** - OAuth should never use HTTP

## Monitoring

Check OpenMetadata logs for OAuth activity:

```bash
# Successful OAuth setup
grep "OAuth setup completed" openmetadata.log

# Token refresh events
grep "Token refresh successful" openmetadata.log

# MCP authorization events
grep "Internal OAuth successful for connector" openmetadata.log
```

## Next Steps

- **Add more connectors:** Databricks, Azure SQL, BigQuery
- **UI for OAuth setup:** Build admin panel for OAuth configuration
- **Token rotation:** Implement automatic refresh token rotation
- **Monitoring:** Add Prometheus metrics for OAuth operations

# MCP OAuth Test Scripts

This directory contains scripts for testing MCP OAuth flows with real database connectors.

## ⚠️ Local Credentials Only

**IMPORTANT**: Actual credential files are gitignored and should NEVER be committed to the repository.

## Setup Instructions

### 1. Create Your Credential File

Copy the example file and fill in your real credentials:

```bash
cp create-snowflake-service.json.example create-snowflake-service.json
```

### 2. Fill in Snowflake OAuth Credentials

Edit `create-snowflake-service.json` with your actual values:

- **name**: Unique connector name (e.g., `my-snowflake-connector`)
- **account**: Your Snowflake account ID
- **warehouse**: Snowflake warehouse name
- **database**: Snowflake database name
- **authType.clientId**: Base64-encoded OAuth client ID from Snowflake
- **authType.clientSecret**: Base64-encoded OAuth client secret
- **authType.accessToken**: Current Snowflake OAuth access token
- **authType.refreshToken**: Snowflake OAuth refresh token
- **authType.tokenEndpoint**: Token endpoint URL
- **authType.expiresAt**: Unix timestamp when access token expires

### 3. Get Snowflake OAuth Credentials

Follow Snowflake's OAuth setup guide:
1. Create OAuth integration in Snowflake
2. Generate client ID and secret
3. Perform initial OAuth flow to get access/refresh tokens
4. Base64 encode the client ID and secret

### 4. Create the Database Service

Use the OpenMetadata API to create the service with OAuth credentials:

```bash
# Set your admin JWT token
export OM_TOKEN="your-admin-jwt-token"

# Create the service
curl -X POST "http://localhost:8585/api/v1/services/databaseServices" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OM_TOKEN" \
  -d @create-snowflake-service.json
```

### 5. Test MCP OAuth Flow

```bash
# Set the connector to use for testing
export MCP_DEFAULT_CONNECTOR="your-connector-name"

# Run MCP OAuth test
cd ../..
./test-mcp-with-token.sh
```

## File Structure

- `*.json.example` - Example credential files (committed to repo)
- `*.json` - Actual credential files (gitignored, local only)
- `*.sh.example` - Example shell scripts (committed to repo)
- `*.sh` - Actual shell scripts (gitignored, local only)

## Security Notes

- ✅ Example files are safe to commit (contain placeholders only)
- ❌ Never commit files with actual credentials
- ✅ Real credential files are automatically gitignored
- ❌ Never share your access/refresh tokens
- ✅ Tokens are encrypted when stored in OpenMetadata database

## Troubleshooting

### "Connector not found" Error
Make sure the connector name in your JSON file matches the name you use in tests.

### "OAuth credentials not configured" Error
Verify all fields in the `authType` object are filled in correctly.

### "Token expired" Error
Update the `accessToken`, `refreshToken`, and `expiresAt` fields with fresh values.

### Getting Fresh Tokens
Use Snowflake's OAuth flow to get new tokens, then update your local JSON file.

## Additional Connectors

To test with other connectors (Databricks, BigQuery, etc.):

1. Copy the example file for your connector type
2. Fill in the appropriate OAuth credentials
3. Update the `serviceType` and connection config
4. Follow the same create service + test flow

## Support

See the main [MCP OAuth README](../../README.md) for more details on the OAuth implementation.

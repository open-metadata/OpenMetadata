# Snowflake Test Credentials for MCP OAuth Testing

This file contains the existing Snowflake credentials from the `ai-platform` repo that can be used for MCP OAuth testing.

## Existing Snowflake Connection (Collate Analytics)

These credentials are currently used in `ai-platform/benchmarks/resources/snowflake_ingestion.yaml`:

```yaml
Account: FMFAHQK-GI58232
Username: svc_caip_benchmarking
Warehouse: COMPUTE_WH
Database: CUSTOMERS
Schema: COLLATE_SHOP
Auth Type: Private Key (${SNOWFLAKE_PRIVATE_KEY})
```

## Quick Setup

Run the setup script to create a test Snowflake service in OpenMetadata:

```bash
cd /Users/vishnujain/IdeaProjects/openmetadata-collate/OpenMetadata
./setup-mcp-test-snowflake.sh
```

This will:
1. ✅ Check OpenMetadata server is running
2. ✅ Create database service: `snowflake_test_mcp`
3. ✅ Provide OAuth setup instructions

## Current Limitation

The existing credentials use **private key authentication**, not OAuth. To test MCP OAuth flow, you need to:

### Option 1: Quick Test (Without OAuth)

Test the MCP connection infrastructure (will fail at OAuth step):

```bash
npx @modelcontextprotocol/inspector \
  --url http://localhost:8585/mcp \
  --auth-type oauth2 \
  --auth-params connector_name=snowflake_test_mcp
```

**Expected:** Connection fails because service doesn't have OAuth configured.

### Option 2: Full OAuth Test (Requires Snowflake Admin Access)

If you have `ACCOUNTADMIN` access to the Snowflake account `FMFAHQK-GI58232`:

#### Step 1: Create OAuth Integration in Snowflake

```sql
USE ROLE ACCOUNTADMIN;

CREATE SECURITY INTEGRATION openmetadata_mcp_oauth
  TYPE = OAUTH
  ENABLED = TRUE
  OAUTH_CLIENT = CUSTOM
  OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
  OAUTH_REDIRECT_URI = 'http://localhost:3000/oauth/callback'
  OAUTH_ISSUE_REFRESH_TOKENS = TRUE
  OAUTH_REFRESH_TOKEN_VALIDITY = 7776000; -- 90 days

-- Get OAuth credentials
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('OPENMETADATA_MCP_OAUTH');
```

**Save the output:**
- `OAUTH_CLIENT_ID`
- `OAUTH_CLIENT_SECRET`

#### Step 2: Get Authorization Code

Open in browser:
```
https://FMFAHQK-GI58232.snowflakecomputing.com/oauth/authorize?client_id=<OAUTH_CLIENT_ID>&response_type=code&redirect_uri=http://localhost:3000/oauth/callback&scope=session:role:ACCOUNTADMIN
```

Approve the OAuth consent, then copy the `code` parameter from the redirect URL:
```
http://localhost:3000/oauth/callback?code=<AUTHORIZATION_CODE>
```

#### Step 3: Store OAuth Credentials in OpenMetadata

```bash
curl -X POST http://localhost:8585/api/v1/mcp/oauth/setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg" \
  -d '{
    "connectorName": "snowflake_test_mcp",
    "authorizationCode": "<AUTHORIZATION_CODE_FROM_STEP_2>",
    "redirectUri": "http://localhost:3000/oauth/callback",
    "clientId": "<OAUTH_CLIENT_ID_FROM_STEP_1>",
    "clientSecret": "<OAUTH_CLIENT_SECRET_FROM_STEP_1>",
    "tokenEndpoint": "https://FMFAHQK-GI58232.snowflakecomputing.com/oauth/token-request"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "OAuth credentials stored successfully for snowflake_test_mcp",
  "tokenExpiry": "2025-12-22T15:30:00Z"
}
```

#### Step 4: Test MCP OAuth Connection

```bash
npx @modelcontextprotocol/inspector \
  --url http://localhost:8585/mcp \
  --auth-type oauth2 \
  --auth-params connector_name=snowflake_test_mcp
```

**Expected:**
- ✅ No browser opens
- ✅ Connection succeeds immediately
- ✅ Can call MCP tools
- ✅ Token automatically refreshes when expired

## Admin JWT Token

For API calls, use this test admin JWT token:

```
eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg
```

This token is valid for the test environment (user: `admin@openmetadata.org`).

## Troubleshooting

### "OpenMetadata server not running"

Start OpenMetadata:
```bash
cd /Users/vishnujain/IdeaProjects/openmetadata-collate/OpenMetadata
./bootstrap/openmetadata-ops.sh start
```

### "Connector does not have OAuth configured"

You haven't completed the OAuth setup (Steps 1-3 above). Either:
- Complete Snowflake OAuth setup (requires admin access)
- Use a different connector that already has OAuth configured

### "Cannot access Snowflake account"

The account `FMFAHQK-GI58232` belongs to Collate. If you don't have access:
- Use your own Snowflake account
- Ask team for access to this test account
- Create a mock connector for testing (no real Snowflake needed)

## See Also

- [OAUTH_MCP_TESTING_GUIDE.md](./OAUTH_MCP_TESTING_GUIDE.md) - Complete OAuth testing workflow
- [setup-mcp-test-snowflake.sh](./setup-mcp-test-snowflake.sh) - Automated setup script

# Quick Start: MCP OAuth Testing

This guide gets you testing MCP OAuth in **5 minutes** using existing Snowflake credentials.

## Prerequisites

- OpenMetadata running on `http://localhost:8585`
- Node.js installed (for mcp-inspector)

## Step 1: Auto-Setup Test Connector

Run the automated setup script:

```bash
cd /Users/vishnujain/IdeaProjects/openmetadata-collate/OpenMetadata
./setup-mcp-test-snowflake.sh
```

This creates a test Snowflake connector using existing credentials from `ai-platform` repo.

## Step 2: Test MCP Infrastructure (Without OAuth)

Install and run MCP Inspector:

```bash
# Install MCP Inspector (one-time)
npm install -g @modelcontextprotocol/inspector

# Test MCP connection
npx @modelcontextprotocol/inspector \
  --url http://localhost:8585/mcp \
  --auth-type oauth2 \
  --auth-params connector_name=snowflake_test_mcp
```

**Expected Result:**
- Connection will fail at OAuth step (connector uses private key, not OAuth)
- But you can verify MCP server is running and accepting connections

## Step 3: Add OAuth (Requires Snowflake Admin)

To test the **full OAuth flow**, you need admin access to Snowflake account `FMFAHQK-GI58232`.

### If You Have Snowflake Admin Access:

See detailed instructions in [SNOWFLAKE_TEST_CREDENTIALS.md](./SNOWFLAKE_TEST_CREDENTIALS.md) - Section "Option 2: Full OAuth Test"

### If You Don't Have Snowflake Admin Access:

**Option A:** Ask team for:
- OAuth client ID/secret for the Snowflake account
- Or access to configure OAuth yourself

**Option B:** Use your own Snowflake account:
1. Modify `setup-mcp-test-snowflake.sh` with your Snowflake details
2. Run OAuth setup with your account

**Option C:** Mock testing (no real Snowflake):
1. Create a test connector without real credentials
2. Modify code to skip actual token validation
3. Test MCP protocol flow without external dependencies

## Complete Testing Workflow

```bash
# Terminal 1: Start OpenMetadata (if not running)
cd /Users/vishnujain/IdeaProjects/openmetadata-collate/OpenMetadata
./bootstrap/openmetadata-ops.sh start

# Terminal 2: Watch OpenMetadata logs
tail -f openmetadata.log

# Terminal 3: Run setup and test
./setup-mcp-test-snowflake.sh

# After OAuth setup (Step 3 from SNOWFLAKE_TEST_CREDENTIALS.md):
npx @modelcontextprotocol/inspector \
  --url http://localhost:8585/mcp \
  --auth-type oauth2 \
  --auth-params connector_name=snowflake_test_mcp
```

## What You'll See (Full OAuth Working)

When OAuth is properly configured:

1. **MCP Inspector connects**
   - No browser opens ✅
   - No user interaction needed ✅

2. **OpenMetadata logs show:**
   ```
   INFO ConnectorOAuthProvider - Internal OAuth successful for connector: snowflake_test_mcp
   INFO ConnectorOAuthProvider - Access token valid, using cached token
   ```

3. **MCP Inspector shows:**
   ```
   Connected to MCP server!
   Available tools:
   - search_metadata
   - get_table_details
   - get_lineage
   ...
   ```

4. **You can call tools:**
   ```javascript
   // In MCP Inspector
   tools.call("search_metadata", {
     "query": "customer",
     "entityTypes": ["table"]
   })
   ```

## Troubleshooting

### "OpenMetadata server not running"

```bash
cd /Users/vishnujain/IdeaProjects/openmetadata-collate/OpenMetadata
./bootstrap/openmetadata-ops.sh start
```

### "Connector does not have OAuth configured"

You need to complete OAuth setup first (see Step 3 above or SNOWFLAKE_TEST_CREDENTIALS.md).

### "Connection refused on port 8585"

Check if OpenMetadata is actually running:
```bash
curl http://localhost:8585/api/v1/health-check
```

If it fails, check logs:
```bash
cat openmetadata.log
```

## Files Reference

- **setup-mcp-test-snowflake.sh** - Automated setup script
- **SNOWFLAKE_TEST_CREDENTIALS.md** - Detailed credential info
- **OAUTH_MCP_TESTING_GUIDE.md** - Complete OAuth workflow documentation

## Current Status

As of now:
- ✅ MCP server code is complete and compiled
- ✅ OAuth provider implementation is ready
- ✅ Test credentials are available (from ai-platform repo)
- ⚠️ OAuth integration with Snowflake not configured yet (requires admin)

**Next Step:** Get Snowflake OAuth credentials or team access to complete full testing.

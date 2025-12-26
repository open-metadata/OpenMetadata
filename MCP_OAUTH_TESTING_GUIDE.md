# MCP OAuth Testing Guide - Snowflake with MCP Inspector

**Date:** December 24, 2025
**Branch:** `oauth-mcp`
**Goal:** Test redirect-free OAuth with Snowflake via MCP Inspector

---

## 🎯 What We're Testing

**Expected Behavior:**
1. ✅ User configures Snowflake OAuth credentials ONCE in OpenMetadata UI
2. ✅ Credentials stored encrypted server-side
3. ✅ MCP Inspector connects to MCP server
4. ✅ MCP server handles OAuth token exchange **internally** (no browser redirect!)
5. ✅ Access token automatically refreshed when expired (server-side)
6. ✅ AI agent queries Snowflake data via MCP tools

**What Should NOT Happen:**
- ❌ No browser redirect to Snowflake login page
- ❌ No manual token refresh by user
- ❌ No "OAuth authorization required" errors after initial setup

---

## 📋 Step-by-Step Testing Process

### Step 1: Build OpenMetadata with OAuth MCP Changes

**Required:** Yes, you must build to include plugin system changes

```bash
cd /Users/vishnujain/IdeaProjects/openmetadata-collate/OpenMetadata

# Clean build with all changes
mvn clean install -DskipTests

# Expected duration: 5-10 minutes
# Look for: BUILD SUCCESS
```

**What This Does:**
- Compiles plugin system (OAuthConnectorPlugin, SnowflakeOAuthPlugin, etc.)
- Packages openmetadata-mcp module with OAuth support
- Generates JARs in `openmetadata-service/target/` and `openmetadata-mcp/target/`

**Verification:**
```bash
# Check MCP JAR was built
ls -lh openmetadata-mcp/target/openmetadata-mcp-*.jar

# Check plugin classes are included
jar tf openmetadata-mcp/target/openmetadata-mcp-*.jar | grep OAuthConnectorPlugin
# Should show:
# org/openmetadata/mcp/server/auth/plugins/OAuthConnectorPlugin.class
# org/openmetadata/mcp/server/auth/plugins/OAuthConnectorPluginRegistry.class
# org/openmetadata/mcp/server/auth/plugins/SnowflakeOAuthPlugin.class
# org/openmetadata/mcp/server/auth/plugins/DatabricksOAuthPlugin.class
```

---

### Step 2: Configure OpenMetadata Server for MCP OAuth

**Edit:** `conf/openmetadata.yaml`

Add or update MCP configuration:

```yaml
mcp:
  enabled: true
  mcpServerName: "openmetadata-mcp-server"
  mcpServerVersion: "1.12.0"
  path: "/api/v1/mcp"

  # CORS configuration for OAuth endpoints
  allowedOrigins:
    - "http://localhost:3000"   # MCP Inspector (if running locally)
    - "http://localhost:8585"   # OpenMetadata UI
    - "http://localhost:9090"   # Alternative port

  # Enable origin validation (production security)
  originValidationEnabled: false  # Set to true for production
  originHeaderUri: "http://localhost"
```

**Important Notes:**
- `allowedOrigins`: Add MCP Inspector's origin if it's web-based
- `originValidationEnabled: false`: For local testing (set `true` for production)

---

### Step 3: Start OpenMetadata Server

**Option A: From IntelliJ (Recommended for Testing)**

1. Open `openmetadata-service/src/main/java/org/openmetadata/service/OpenMetadataApplication.java`
2. Run configuration: `OpenMetadataApplication` with arguments `server conf/openmetadata.yaml`
3. Check console logs for:
   ```
   INFO  [2025-12-24 ...] o.o.m.s.a.p.OAuthConnectorPluginRegistry - OAuthConnectorPluginRegistry initializing...
   INFO  [2025-12-24 ...] o.o.m.s.a.p.OAuthConnectorPluginRegistry - Registered OAuth plugin for connector type 'Snowflake'
   INFO  [2025-12-24 ...] o.o.m.s.a.p.OAuthConnectorPluginRegistry - Registered OAuth plugin for connector type 'Databricks'
   INFO  [2025-12-24 ...] o.o.m.s.a.p.OAuthConnectorPluginRegistry - OAuthConnectorPluginRegistry initialized successfully. 2 built-in plugins registered: [Snowflake, Databricks]
   ```

**Option B: From Command Line**

```bash
cd /Users/vishnujain/IdeaProjects/openmetadata-collate/OpenMetadata

# Start OpenMetadata server
java -jar openmetadata-service/target/openmetadata-service-*.jar server conf/openmetadata.yaml

# OR if using the distribution
cd openmetadata-dist/target/openmetadata-*/
./bootstrap/openmetadata-setup.sh
```

**Verify MCP OAuth Endpoints:**
```bash
# Check MCP OAuth metadata endpoint
curl http://localhost:8585/api/v1/mcp/.well-known/oauth-authorization-server | jq

# Expected response:
{
  "issuer": "http://localhost:8585/api/v1/mcp",
  "authorization_endpoint": "http://localhost:8585/api/v1/mcp/oauth/authorize",
  "token_endpoint": "http://localhost:8585/api/v1/mcp/oauth/token",
  "registration_endpoint": "http://localhost:8585/api/v1/mcp/oauth/register",
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_post"]
}
```

---

### Step 4: Configure Snowflake Connection with OAuth in OpenMetadata UI

**Navigate to:** OpenMetadata UI → Settings → Integrations → Databases → Snowflake

#### 4.1 Create or Edit Snowflake Connection

1. **Connection Name:** `snowflake_oauth_test`
2. **Account:** Your Snowflake account (e.g., `xy12345.us-east-1`)
3. **Warehouse:** Your warehouse name
4. **Database:** Default database (optional)

#### 4.2 Configure OAuth Credentials

**Important:** Select OAuth as authentication method

```json
{
  "type": "Snowflake",
  "account": "xy12345.us-east-1",
  "warehouse": "COMPUTE_WH",
  "oauth": {
    "clientId": "YOUR_SNOWFLAKE_CLIENT_ID",
    "clientSecret": "YOUR_SNOWFLAKE_CLIENT_SECRET",
    "scopes": ["session:role:any", "refresh_token"],
    "tokenEndpoint": "https://xy12345.us-east-1.snowflakecomputing.com/oauth/token-request"
  }
}
```

**Where to Get Snowflake OAuth Credentials:**

If you already have them saved:
1. Check OpenMetadata UI → Settings → Integrations → Databases → Your Snowflake connection
2. OAuth credentials should be visible (client_id shown, client_secret encrypted)

If you need to create new credentials:
1. Login to Snowflake → Admin → Security Integrations
2. Create OAuth Integration:
   ```sql
   CREATE SECURITY INTEGRATION mcp_oauth_integration
     TYPE = OAUTH
     ENABLED = TRUE
     OAUTH_CLIENT = CUSTOM
     OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
     OAUTH_REDIRECT_URI = 'http://localhost:8585/api/v1/mcp/oauth/callback'
     OAUTH_ISSUE_REFRESH_TOKENS = TRUE
     OAUTH_REFRESH_TOKEN_VALIDITY = 7776000;  -- 90 days
   ```
3. Get client_id and client_secret:
   ```sql
   SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('MCP_OAUTH_INTEGRATION');
   ```

#### 4.3 Test Connection

Click **"Test Connection"** in OpenMetadata UI.

**What Should Happen:**
1. OpenMetadata calls `ConnectorOAuthProvider.authorize()`
2. Plugin system detects Snowflake connection
3. `SnowflakeOAuthPlugin` builds token endpoint: `https://xy12345.us-east-1.snowflakecomputing.com/oauth/token-request`
4. Server makes **internal** OAuth token request (no browser redirect!)
5. Access token stored in-memory (will be in database after migration)
6. Connection test succeeds

**Check Logs:**
```
DEBUG o.o.m.s.a.p.ConnectorOAuthProvider - Using SnowflakeOAuthPlugin to extract OAuth credentials
DEBUG o.o.m.s.a.p.ConnectorOAuthProvider - Using SnowflakeOAuthPlugin to build token endpoint
INFO  o.o.m.s.a.p.ConnectorOAuthProvider - Internal OAuth authorization successful for connector: snowflake_oauth_test by user: <your-username>
INFO  o.o.m.s.a.p.ConnectorOAuthProvider - PKCE verification succeeded for connector: snowflake_oauth_test
```

**If Test Connection Fails:**
- Check server logs for OAuth errors
- Verify Snowflake client_id and client_secret are correct
- Verify Snowflake account identifier is correct
- Verify network connectivity to Snowflake

---

### Step 5: Install and Configure MCP Inspector

**MCP Inspector:** https://github.com/modelcontextprotocol/inspector

**Install:**
```bash
npm install -g @modelcontextprotocol/inspector

# OR run directly with npx
npx @modelcontextprotocol/inspector
```

**Start MCP Inspector:**
```bash
mcp-inspector
```

**Opens:** http://localhost:3000 (or similar)

---

### Step 6: Connect MCP Inspector to OpenMetadata MCP Server

#### 6.1 Configure MCP Inspector Connection

In MCP Inspector UI:

1. **Server URL:** `http://localhost:8585/api/v1/mcp`
2. **Authentication:** OAuth 2.0
3. **Client Registration:**
   - Client Name: `mcp-inspector-test`
   - Redirect URI: `http://localhost:3000/oauth/callback` (adjust based on MCP Inspector port)

#### 6.2 Initiate OAuth Flow for MCP Inspector

**Note:** This OAuth flow is for **authenticating MCP Inspector to OpenMetadata** (Tier 2 - user authentication), NOT for Snowflake connector access (Tier 1 - already configured).

**Two-Tier OAuth Explained:**

| Tier | Purpose | Flow | Status |
|------|---------|------|--------|
| **Tier 1: Connector OAuth** | AI agent → Snowflake data | Redirect-free (server-side) | ✅ Testing today |
| **Tier 2: User OAuth** | User → OpenMetadata | Browser redirect (traditional OAuth) | ⚠️ Simplified for testing |

**For Testing (Simplified):**

If `OpenMetadataAuthProvider` throws "not_implemented", use **Simple Auth** for MCP Inspector:

1. Create an OpenMetadata Bot Account:
   ```bash
   # Via OpenMetadata UI
   Settings → Bots → Create Bot
   Name: mcp-inspector-bot
   Generate JWT Token
   ```

2. Use JWT Token in MCP Inspector:
   ```
   Authorization: Bearer <JWT_TOKEN>
   ```

**OR** use the existing admin JWT token for quick testing.

---

### Step 7: Test Snowflake OAuth via MCP Inspector

#### 7.1 List Available MCP Tools

In MCP Inspector:
1. Click **"List Tools"**
2. You should see MCP tools:
   - `search_metadata` - Search OpenMetadata entities
   - `get_entity_by_fqn` - Get entity by fully qualified name
   - `query_connector` - Query data source (uses connector OAuth!)
   - `patch_entity` - Update entity
   - etc.

#### 7.2 Test Snowflake Query Tool (OAuth Test!)

**Use Tool:** `query_connector` or similar tool that accesses Snowflake

**Example Request:**
```json
{
  "tool": "query_connector",
  "arguments": {
    "connector_name": "snowflake_oauth_test",
    "query": "SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE()"
  }
}
```

**What Should Happen (Redirect-Free OAuth!):**

1. **MCP Inspector** sends request to **MCP Server**
2. **MCP Server** receives request, validates MCP JWT token (Tier 2 auth)
3. **ConnectorOAuthProvider** loads Snowflake connection config from database
4. **ConnectorOAuthProvider** decrypts OAuth credentials via `SecretsManager`
5. **SnowflakeOAuthPlugin** called to extract credentials and build token endpoint
6. **Check if access token exists and is valid:**
   - If valid: Use existing token (no OAuth call needed!)
   - If expired or missing: Perform **internal token refresh** (see Step 7.3)
7. **Execute Snowflake query** using access token
8. **Return results** to MCP Inspector

**Expected Response:**
```json
{
  "result": {
    "rows": [
      {
        "CURRENT_USER()": "MCP_OAUTH_USER",
        "CURRENT_ROLE()": "PUBLIC",
        "CURRENT_WAREHOUSE()": "COMPUTE_WH"
      }
    ]
  }
}
```

**Check Server Logs (Important!):**
```
DEBUG o.o.m.s.a.p.ConnectorOAuthProvider - Loading connector config for: snowflake_oauth_test
DEBUG o.o.m.s.a.p.ConnectorOAuthProvider - Using SnowflakeOAuthPlugin to extract OAuth credentials
DEBUG o.o.m.s.a.p.ConnectorOAuthProvider - Access token found, checking expiry...
DEBUG o.o.m.s.a.p.ConnectorOAuthProvider - Access token is valid, using cached token
INFO  o.o.m.tools.QueryConnectorTool - Executing query on Snowflake connector: snowflake_oauth_test
INFO  o.o.m.tools.QueryConnectorTool - Query successful, returned 1 rows
```

**If You See Token Refresh:**
```
DEBUG o.o.m.s.a.p.ConnectorOAuthProvider - Access token expired or about to expire, refreshing...
DEBUG o.o.m.s.a.p.ConnectorOAuthProvider - Using SnowflakeOAuthPlugin to build token endpoint
INFO  o.o.m.s.a.p.ConnectorOAuthProvider - Refreshing access token internally for connector: snowflake_oauth_test
DEBUG o.o.m.s.a.p.ConnectorOAuthProvider - Making internal OAuth token request to: https://xy12345.us-east-1.snowflakecomputing.com/oauth/token-request
INFO  o.o.m.s.a.p.ConnectorOAuthProvider - Token refresh successful for connector: snowflake_oauth_test
```

**✅ SUCCESS INDICATORS:**
- ❌ **NO** browser redirect to Snowflake login page
- ❌ **NO** manual user intervention
- ✅ Query executes successfully
- ✅ Results returned from Snowflake
- ✅ Logs show "Using SnowflakeOAuthPlugin"
- ✅ Logs show token refresh (if token was expired)

#### 7.3 Test Automatic Token Refresh

**Goal:** Verify tokens are refreshed automatically when expired

**Manual Token Expiry Simulation:**

**Option 1: Wait for Token to Expire**
- Snowflake access tokens typically expire in 10-60 minutes
- Wait for expiry, then repeat query
- Should see automatic refresh in logs

**Option 2: Force Token Expiry (Code Change)**

Edit `ConnectorOAuthProvider.java` temporarily:
```java
private boolean isAccessTokenExpired(OAuthCredentials oauth) {
  // TEMP: Force token expiry for testing
  return true;  // Always treat token as expired

  // Original code:
  // if (oauth.getExpiresAt() == null) return false;
  // long now = Instant.now().getEpochSecond();
  // return oauth.getExpiresAt() <= now + 60;
}
```

Rebuild, restart server, and query again. Should see token refresh on every request.

**Expected Logs:**
```
DEBUG ConnectorOAuthProvider - Access token expired, refreshing...
INFO  ConnectorOAuthProvider - Refreshing access token internally for connector: snowflake_oauth_test
DEBUG ConnectorOAuthProvider - Making internal OAuth token request with grant_type=refresh_token
INFO  ConnectorOAuthProvider - Token refresh successful, new expiry: 2025-12-24T17:30:00Z
DEBUG ConnectorOAuthProvider - Connector provided new refresh token, updating stored credentials
```

**Verification:**
- ✅ Query still succeeds after token refresh
- ✅ No user intervention required
- ✅ Refresh token used automatically
- ✅ New access token stored

---

### Step 8: Advanced Testing Scenarios

#### 8.1 Test PKCE Verification

**What is PKCE?** Proof Key for Code Exchange - prevents authorization code interception attacks.

**How to Test:**

1. Enable debug logging for PKCE:
   ```yaml
   # conf/openmetadata.yaml
   logging:
     level:
       org.openmetadata.mcp.server.auth.provider.ConnectorOAuthProvider: DEBUG
   ```

2. Trigger initial authorization (delete stored tokens or use new connector)

3. Check logs for PKCE verification:
   ```
   DEBUG ConnectorOAuthProvider - PKCE enabled, generating code_challenge...
   DEBUG ConnectorOAuthProvider - code_challenge: rF8f3Hg7... (S256)
   INFO  ConnectorOAuthProvider - PKCE verification succeeded for connector: snowflake_oauth_test
   ```

**PKCE Failure Test (Optional):**

Temporarily break PKCE in code to verify it fails correctly:
```java
// In ConnectorOAuthProvider.exchangeAuthorizationCode()
String computedChallenge = "WRONG_CHALLENGE";  // Force mismatch
```

Expected error:
```
ERROR ConnectorOAuthProvider - PKCE verification failed - code_verifier does not match code_challenge
TokenException: invalid_grant - PKCE verification failed: code_verifier is incorrect
```

#### 8.2 Test CORS Security

**Test Unauthorized Origin:**

```bash
# Request from unauthorized origin
curl -X POST http://localhost:8585/api/v1/mcp/oauth/token \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials"}'
```

**Expected:** CORS headers NOT set (request may fail in browser)

**Check Logs:**
```
WARN OAuthHttpStatelessServerTransportProvider - CORS request rejected from unauthorized origin: https://evil.com
```

**Test Authorized Origin:**

```bash
curl -X POST http://localhost:8585/api/v1/mcp/oauth/token \
  -H "Origin: http://localhost:8585" \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials"}'
```

**Expected:** CORS headers set:
```
Access-Control-Allow-Origin: http://localhost:8585
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

#### 8.3 Test Scope-Based Authorization

**Prerequisites:** Ensure MCP tools are annotated with `@RequireScope`

**Test Tool Requiring `metadata:read`:**

1. Request MCP JWT token with limited scopes:
   ```json
   {
     "scopes": ["metadata:write"]  // Missing metadata:read
   }
   ```

2. Try to call `search_metadata` tool (requires `metadata:read`)

**Expected Error:**
```json
{
  "error": "insufficient_scope",
  "error_description": "Insufficient scope: Access denied. Required scopes: [metadata:read]"
}
```

**Check Logs:**
```
WARN ScopeInterceptor - Scope validation failed for tool: SearchMetadataTool
INFO ScopeInterceptor - Required scopes: [metadata:read], Granted scopes: [metadata:write]
```

#### 8.4 Test Plugin System Auto-Detection

**Verify Plugin Registered on Startup:**

Check server startup logs:
```
INFO  OAuthConnectorPluginRegistry - OAuthConnectorPluginRegistry initializing...
INFO  OAuthConnectorPluginRegistry - Registered OAuth plugin for connector type 'Snowflake' (class: SnowflakeOAuthPlugin)
INFO  OAuthConnectorPluginRegistry - Registered OAuth plugin for connector type 'Databricks' (class: DatabricksOAuthPlugin)
INFO  OAuthConnectorPluginRegistry - OAuthConnectorPluginRegistry initialized successfully. 2 built-in plugins registered: [Snowflake, Databricks]
```

**Verify Plugin Auto-Detection:**

When using Snowflake connector, check logs:
```
DEBUG ConnectorOAuthProvider - Using SnowflakeOAuthPlugin to extract OAuth credentials
DEBUG SnowflakeOAuthPlugin - Extracted OAuth credentials for Snowflake account: xy12345.us-east-1
DEBUG ConnectorOAuthProvider - Using SnowflakeOAuthPlugin to build token endpoint
DEBUG SnowflakeOAuthPlugin - Built Snowflake token endpoint from account identifier: https://xy12345.us-east-1.snowflakecomputing.com/oauth/token-request
```

**What This Proves:**
- ✅ Plugins auto-registered on startup
- ✅ Plugin auto-detected from config object (no hardcoded if/else)
- ✅ Plugin methods called correctly

---

## 🐛 Troubleshooting Common Issues

### Issue 1: Build Fails

**Error:** `cannot find symbol: class OAuthConnectorPlugin`

**Solution:**
```bash
# Build parent modules first
mvn clean install -pl openmetadata-spec -am -DskipTests
mvn clean install -pl openmetadata-mcp -am -DskipTests
```

### Issue 2: Server Doesn't Start

**Error:** `Failed to initialize OAuth connector plugin registry`

**Check:**
1. Verify plugin classes are in JAR: `jar tf openmetadata-mcp/target/*.jar | grep Plugin`
2. Check for class loading errors in logs
3. Verify Lombok is working (plugins use `@Slf4j`)

### Issue 3: Test Connection Fails

**Error:** `Cannot determine token endpoint for connector type: SnowflakeConnection`

**Possible Causes:**
1. Plugin not registered (check startup logs)
2. Plugin auto-detection failed
3. Wrong connector config type

**Debug:**
```bash
# Check registered plugins
# Add temporary logging in ConnectorOAuthProvider.extractOAuthCredentialsFromConfig():
LOG.info("Registered plugins: {}", OAuthConnectorPluginRegistry.getRegisteredConnectorTypes());
LOG.info("Config class: {}", config.getClass().getName());
```

### Issue 4: PKCE Verification Fails

**Error:** `PKCE verification failed: code_verifier is incorrect`

**Possible Causes:**
1. Code verifier not passed from client
2. Code challenge not stored correctly
3. Hash algorithm mismatch (must be SHA-256)

**Debug:**
```bash
# Add logging in exchangeAuthorizationCode():
LOG.info("Stored code_challenge: {}", storedCode.getCodeChallenge());
LOG.info("Received code_verifier: {}", code.getCodeVerifier());
LOG.info("Computed code_challenge: {}", computedChallenge);
```

### Issue 5: Token Refresh Fails

**Error:** `Internal token refresh failed: 401 Unauthorized`

**Possible Causes:**
1. Invalid refresh_token
2. Refresh token expired
3. Snowflake OAuth integration disabled
4. Wrong token endpoint

**Debug:**
```bash
# Check token endpoint being used
# Check refresh token exists
# Check Snowflake OAuth integration status:
SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.OAUTH_TOKENS WHERE CLIENT_ID = '<your-client-id>';
```

### Issue 6: MCP Inspector Can't Connect

**Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solution:**
Add MCP Inspector origin to `allowedOrigins` in `openmetadata.yaml`:
```yaml
mcp:
  allowedOrigins:
    - "http://localhost:3000"  # Add MCP Inspector port
```

---

## ✅ Success Checklist

After completing all tests, verify:

### Plugin System
- [ ] Plugin registration logs show "2 built-in plugins registered: [Snowflake, Databricks]"
- [ ] Logs show "Using SnowflakeOAuthPlugin" when accessing Snowflake
- [ ] No hardcoded if/else in logs (no "config instanceof SnowflakeConnection" messages)

### Redirect-Free OAuth
- [ ] **NO browser redirect** to Snowflake login page at any point
- [ ] OAuth token exchange happens server-side (logs show "Internal OAuth authorization successful")
- [ ] Queries execute without user intervention after initial setup

### Token Management
- [ ] Access token cached and reused (logs show "using cached token")
- [ ] Automatic token refresh when expired (logs show "Token refresh successful")
- [ ] Refresh token used correctly (grant_type=refresh_token)
- [ ] No manual token management required

### Security
- [ ] PKCE verification succeeds (logs show "PKCE verification succeeded")
- [ ] CORS origin validation works (unauthorized origins rejected)
- [ ] Scope-based authorization enforced (tools check scopes)
- [ ] User attribution correct (logs show actual username, not "admin")

### MCP Integration
- [ ] MCP Inspector connects successfully
- [ ] MCP tools list correctly
- [ ] Snowflake query tool works
- [ ] Results returned correctly

---

## 📊 Expected Test Results

If everything works correctly, you should see:

**Terminal/Logs:**
```
[Startup]
INFO  OAuthConnectorPluginRegistry - Registered 2 built-in plugins: [Snowflake, Databricks]

[First Query]
DEBUG ConnectorOAuthProvider - Using SnowflakeOAuthPlugin to extract OAuth credentials
DEBUG ConnectorOAuthProvider - Using SnowflakeOAuthPlugin to build token endpoint
INFO  ConnectorOAuthProvider - Internal OAuth authorization successful for connector: snowflake_oauth_test
INFO  ConnectorOAuthProvider - PKCE verification succeeded
INFO  QueryConnectorTool - Query successful, returned N rows

[Subsequent Queries - Token Cached]
DEBUG ConnectorOAuthProvider - Access token is valid, using cached token
INFO  QueryConnectorTool - Query successful, returned N rows

[After Token Expires - Auto Refresh]
DEBUG ConnectorOAuthProvider - Access token expired, refreshing...
INFO  ConnectorOAuthProvider - Token refresh successful for connector: snowflake_oauth_test
INFO  QueryConnectorTool - Query successful, returned N rows
```

**MCP Inspector:**
```json
{
  "tool": "query_connector",
  "status": "success",
  "result": {
    "rows": [...]
  },
  "execution_time_ms": 234
}
```

**No Browser Redirects!** ✅

---

## 🎉 What This Proves

If all tests pass, you've verified:

1. **✅ Redirect-Free OAuth Works** - No browser redirects, all OAuth handled server-side
2. **✅ Plugin System Works** - Snowflake plugin auto-detected and used
3. **✅ Token Management Works** - Tokens cached and auto-refreshed
4. **✅ Security Works** - PKCE, CORS, scopes all enforced
5. **✅ Production-Ready** - Ready for real AI agent usage

**Next:** Add more connector plugins (BigQuery, Databricks, etc.) using the same pattern!

---

**Document Created:** December 24, 2025
**Testing Duration:** ~30-60 minutes (after build)
**Prerequisites:** Snowflake OAuth credentials, MCP Inspector installed

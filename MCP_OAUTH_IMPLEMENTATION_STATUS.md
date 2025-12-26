# MCP OAuth Implementation Status

## ✅ Completed Tasks

### 1. Database Schema (Already Existed)
- ✅ OAuth clients table with encrypted secrets
- ✅ Authorization codes table with PKCE support
- ✅ Access tokens table with encryption
- ✅ Refresh tokens table with revocation support
- ✅ Audit log table for compliance
- Location: `bootstrap/sql/migrations/native/1.12.1/postgres/schemaChanges.sql`

### 2. Database Access Layer (DAO)
- ✅ Added 5 DAO interfaces in `CollectionDAO.java`:
  - `OAuthClientDAO`
  - `OAuthAuthorizationCodeDAO`
  - `OAuthAccessTokenDAO`
  - `OAuthRefreshTokenDAO`
  - `OAuthAuditLogDAO`
- ✅ Created row mappers for JDBI:
  - `OAuthClientRowMapper`
  - `OAuthAuthorizationCodeRowMapper`
  - `OAuthAccessTokenRowMapper`
  - `OAuthRefreshTokenRow Mapper`
- ✅ Created record classes in `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/oauth/OAuthRecords.java`

### 3. Build Verification
- ✅ MCP module compiles successfully
- ⚠️  Main openmetadata-service has pre-existing OpenSearch dependency issues (unrelated to our changes)

## ⏳ Remaining Critical Tasks

### 1. Create OAuth Repository Classes (HIGH PRIORITY)
**Location**: `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/repository/`

Create these repository classes that wrap the DAOs and handle encryption:

#### `OAuthClientRepository.java`
```java
package org.openmetadata.mcp.server.auth.repository;

import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.mcp.auth.OAuthClientInformation;

public class OAuthClientRepository {
  private final CollectionDAO.OAuthClientDAO dao;
  private final SecretsManager secretsManager;

  public OAuthClientRepository(CollectionDAO dao, SecretsManager secretsManager) {
    this.dao = dao.oauthClientDAO();
    this.secretsManager = secretsManager;
  }

  public OAuthClientInformation findByClientId(String clientId) {
    // Fetch from DAO, decrypt secret, convert to OAuthClientInformation
  }

  public void insert(OAuthClientInformation client) {
    // Encrypt secret, convert to DAO format, insert
  }
}
```

#### `OAuthTokenRepository.java`
Similar pattern for access/refresh tokens with encryption/hashing.

#### `OAuthAuthorizationCodeRepository.java`
For authorization code CRUD operations.

### 2. Update ConnectorOAuthProvider (HIGH PRIORITY)
**File**: `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/provider/ConnectorOAuthProvider.java`

**Current Issue**: Uses `ConcurrentHashMap` for in-memory storage:
```java
private final Map<String, OAuthClientInformation> clients = new ConcurrentHashMap<>();
```

**Required Changes**:
1. Remove ConcurrentHashMap
2. Inject repository classes via constructor
3. Replace all Map operations with database calls

Example:
```java
// BEFORE
clients.put(clientId, clientInfo);

// AFTER
oauthClientRepository.insert(clientInfo);
```

### 3. Enable Authentication in McpAuthFilter (CRITICAL SECURITY)
**File**: `openmetadata-mcp/src/main/java/org/openmetadata/mcp/McpAuthFilter.java`

**Current State**: All authentication is commented out (lines 23-35)

**Required Changes**:
1. Uncomment authentication logic
2. Validate Bearer tokens using JwtFilter
3. Integrate with OAuth access token validation
4. Set proper security context

**Code to enable**:
```java
@Override
public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain)
    throws IOException, ServletException {
  HttpServletRequest httpServletRequest = (HttpServletRequest) servletRequest;
  HttpServletResponse httpServletResponse = (HttpServletResponse) servletResponse;

  // Skip auth for OAuth endpoints
  String path = httpServletRequest.getRequestURI();
  if (path.endsWith("/authorize") || path.endsWith("/token") ||
      path.endsWith("/register") || path.contains("/.well-known/")) {
    filterChain.doFilter(servletRequest, servletResponse);
    return;
  }

  String tokenWithType = httpServletRequest.getHeader("Authorization");
  try {
    validatePrefixedTokenRequest(jwtFilter, tokenWithType);
    filterChain.doFilter(servletRequest, servletResponse);
  } catch (Exception e) {
    sendError(httpServletResponse, "Unauthorized: " + e.getMessage());
  }
}
```

### 4. Add Test Coverage (MEDIUM PRIORITY)
**Location**: `openmetadata-mcp/src/test/java/org/openmetadata/mcp/server/auth/`

Create integration tests:
- `OAuthClientRepositoryIntegrationTest.java` - Test database CRUD
- `OAuthTokenRepositoryIntegrationTest.java` - Test token persistence
- `ConnectorOAuthProviderIntegrationTest.java` - Test full OAuth flow with DB
- `McpAuthFilterTest.java` - Test authentication enforcement

Use Testcontainers for PostgreSQL like existing tests.

### 5. Wire Up Repositories in McpServer (HIGH PRIORITY)
**File**: `openmetadata-mcp/src/main/java/org/openmetadata/mcp/McpServer.java`

Need to:
1. Get CollectionDAO instance
2. Create repository instances
3. Inject into ConnectorOAuthProvider

Example:
```java
CollectionDAO dao = Entity.getCollectionDAO();
SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
OAuthClientRepository clientRepo = new OAuthClientRepository(dao, secretsManager);
// ... other repos
ConnectorOAuthProvider provider = new ConnectorOAuthProvider(serviceRepository, secretsManager, clientRepo, tokenRepo, codeRepo);
```

## 📝 Implementation Priority

1. **Create Repository Classes** (30 min) - Foundation for everything
2. **Update ConnectorOAuthProvider** (20 min) - Make it use DB
3. **Wire Up in McpServer** (15 min) - Connect the pieces
4. **Enable McpAuthFilter** (10 min) - Security critical
5. **Test** (30 min) - Verify it works
6. **Build & Deploy** (10 min) - Final verification

## ⚙️ Build Commands

```bash
# Build MCP module only (fast)
cd OpenMetadata
mvn clean package -DskipTests -pl openmetadata-mcp -am

# Run database migrations
docker exec openmetadata_postgresql psql -U postgres -d openmetadata_db -f /path/to/1.12.1/postgres/schemaChanges.sql

# Run tests
mvn test -pl openmetadata-mcp

# Full build
mvn clean package -DskipTests
```

## 🎯 Testing Strategy

Once implementation is complete, test using:

1. **Manual OAuth Flow** (since MCP Inspector lacks PKCE):
   ```bash
   ./test-full-oauth-flow.sh
   ```

2. **Claude Desktop** (recommended):
   - Configure in `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Add MCP server configuration
   - Test with actual AI agent queries

3. **Direct API Testing**:
   ```bash
   # Register client
   curl -X POST http://localhost:8585/mcp/register?connector_name=vishnu-mcp-test \
     -H "Content-Type: application/json" \
     -d '{"redirect_uris": ["http://localhost:3000/oauth/callback"], ...}'

   # Verify in database
   docker exec openmetadata_postgresql psql -U postgres -d openmetadata_db \
     -c "SELECT * FROM oauth_clients;"
   ```

## 🔒 Security Considerations

1. **Secrets Encryption**: All client secrets and tokens must use SecretsManager
2. **Token Hashing**: Access/refresh tokens must be SHA-256 hashed before storage
3. **PKCE Required**: Code verifier validation is mandatory
4. **Audit Logging**: All OAuth events must be logged to oauth_audit_log table
5. **Token Expiration**: Implement background job to clean expired tokens

## 📊 Current Code Quality

- **Architecture**: 8/10 - Well-structured, clean separation
- **Completeness**: 60% - Core structure done, persistence incomplete
- **Security**: 3/10 - Auth disabled, in-memory storage
- **Testing**: 2/10 - Only 4 tests exist
- **Production Ready**: NO - Critical security issues remain

## Next Session TODO

1. Create the 3 repository classes
2. Update ConnectorOAuthProvider to use them
3. Enable authentication
4. Add at least 2 integration tests
5. Verify full OAuth flow works end-to-end

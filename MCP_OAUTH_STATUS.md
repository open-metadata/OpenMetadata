# MCP OAuth Implementation Status

**Branch:** `oauth-mcp`
**Last Commit:** `a792f2dad7 - Implement internal OAuth flow for MCP with database persistence`
**Status Date:** December 23, 2025

---

## Executive Summary

The MCP OAuth implementation provides a **redirect-free OAuth 2.1 flow** for OpenMetadata's Model Context Protocol (MCP) server. This enables MCP clients to authenticate with external data connectors (Snowflake, Databricks, etc.) without browser-based user interaction.

**Implementation Status:** ~70% Complete
- ✅ Core OAuth provider with automatic token refresh
- ✅ Database persistence with encrypted credential storage
- ✅ Snowflake connector support
- ⚠️ Security gaps (PKCE verification, CORS configuration)
- ❌ Production-ready persistence layer
- ❌ Comprehensive test coverage

---

## ✅ Completed Work

### 1. Core OAuth Infrastructure

#### ConnectorOAuthProvider (777 lines)
**File:** `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/provider/ConnectorOAuthProvider.java`

**Features:**
- ✅ Redirect-free OAuth flow (no browser interaction after setup)
- ✅ Automatic token refresh when expired (60s before expiry)
- ✅ Server-side token exchange with external OAuth servers
- ✅ PKCE code challenge generation and storage
- ✅ Token mapping (MCP JWT → Connector OAuth tokens)
- ✅ Encrypted credential storage via SecretsManager

**Token Refresh Logic:**
```java
// Checks expiry and refreshes automatically
if (isTokenExpired(oauth)) {
    oauth = refreshAccessTokenInternal(oauth, config, connectorName);
    // Persist refreshed tokens to database
    serviceRepository.persistOAuthCredentials(service);
}
```

#### OAuthSetupHandler
**File:** `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/handlers/OAuthSetupHandler.java`

**Features:**
- ✅ One-time OAuth credential setup endpoint: `POST /api/v1/mcp/oauth/setup`
- ✅ Exchanges authorization codes for access/refresh tokens
- ✅ Encrypts and persists credentials to database
- ✅ Automatic token endpoint inference for Snowflake

### 2. Database Schema & Persistence

#### OAuth Credentials Schema
**File:** `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/common/oauthCredentials.json`

**Fields:**
- `clientId` - OAuth 2.0 client identifier
- `clientSecret` - Encrypted client secret
- `refreshToken` - Long-lived refresh token
- `accessToken` - Current access token
- `expiresAt` - Unix timestamp for token expiry
- `tokenEndpoint` - OAuth token endpoint URI
- `scopes` - Array of OAuth scopes

#### Snowflake Connection Update
**File:** `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json`

- ✅ Added `oauth` field referencing oauthCredentials schema
- ✅ Updated `authType` enum to include "oauth2"

#### Database Persistence
**File:** `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/DatabaseServiceRepository.java`

- ✅ `persistOAuthCredentials()` method for updating service with OAuth data
- ✅ Stores encrypted credentials in existing `database_service_entity` table JSON column

### 3. OAuth Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 discovery metadata | ✅ Complete |
| `/.well-known/oauth-protected-resource` | GET | RFC 9728 resource metadata | ✅ Complete |
| `/authorize` | GET | Authorization endpoint | ✅ Complete |
| `/token` | POST | Token exchange | ✅ Complete |
| `/register` | POST | Dynamic client registration | ✅ Complete |
| `/api/v1/mcp/oauth/setup` | POST | Admin OAuth setup | ✅ Complete |

### 4. Security Features Implemented

- ✅ **Encrypted Storage**: OAuth credentials encrypted via SecretsManager
- ✅ **PKCE Generation**: S256 code challenge generated and stored
- ✅ **Token Expiry**: Automatic expiry checking (60s buffer)
- ✅ **State Parameter**: CSRF protection via state validation
- ✅ **Audience Validation**: Bearer tokens include `aud` claim (RFC 8707)
- ✅ **One-Time Codes**: Authorization codes expire after single use

### 5. Transport Layer

#### OAuthHttpStatelessServerTransportProvider
**File:** `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/transport/OAuthHttpStatelessServerTransportProvider.java`

- ✅ OAuth routes integrated into MCP transport layer
- ✅ Base URL configuration for all OAuth endpoints
- ✅ RFC 8414 discovery support

#### OAuthWellKnownFilter
**File:** `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/filters/OAuthWellKnownFilter.java`

- ✅ Root-level OAuth discovery forwarding
- ✅ OIDC discovery fallback support

### 6. Documentation

| Document | Lines | Status |
|----------|-------|--------|
| `MCP_OAUTH_README.md` | 1000 | ✅ Complete OAuth 2.1 implementation guide |
| `OAUTH_SSO_INTEGRATION.md` | 453 | ✅ SSO integration architecture |
| `OAUTH_MCP_TESTING_GUIDE.md` | 244 | ✅ Testing workflow and troubleshooting |
| `QUICK_START_MCP_TESTING.md` | - | ✅ 5-minute testing guide |
| `SNOWFLAKE_TEST_CREDENTIALS.md` | - | ✅ Test credentials and setup |

### 7. Testing Infrastructure

- ✅ `test-oauth-flow.sh` - Comprehensive OAuth 2.1 flow testing (140+ lines)
- ✅ `setup-mcp-test-snowflake.sh` - Automated Snowflake setup
- ✅ `verify-mcp-setup.sh` - Setup verification script

### 8. Connector Support

- ✅ **Snowflake**: Full OAuth support with automatic token endpoint inference
- ⚠️ **Databricks**: Architecture ready, schema not defined (3 TODOs)

---

## ❌ Critical Gaps & Security Issues

### 🔴 CRITICAL - Must Fix Before Production

#### 1. PKCE Verification Missing
**File:** `ConnectorOAuthProvider.java:474`
**Issue:** PKCE code_challenge is stored but NEVER verified during token exchange
**Security Impact:** HIGH - Authorization code interception attacks possible

```java
// TODO: Implement PKCE verification once code_verifier is available in token exchange
if (storedCode.getCodeChallenge() != null) {
    LOG.debug("PKCE code_challenge was present during authorization");
}
```

**Fix Required:**
```java
// Verify PKCE code_verifier matches code_challenge
String codeVerifier = params.getCodeVerifier();
String storedChallenge = storedCode.getCodeChallenge();
String computedChallenge = Base64.getUrlEncoder().withoutPadding()
    .encodeToString(MessageDigest.getInstance("SHA-256").digest(codeVerifier.getBytes()));
if (!computedChallenge.equals(storedChallenge)) {
    throw new TokenException("invalid_grant", "PKCE verification failed");
}
```

#### 2. Wildcard CORS Configuration
**File:** `OAuthHttpStatelessServerTransportProvider.java` (5+ locations)
**Issue:** All OAuth endpoints use `Access-Control-Allow-Origin: *`
**Security Impact:** HIGH - Any origin can make requests

**Locations:**
- Line 309: Metadata endpoint
- Line 322-323: Protected resource metadata
- Line 348: Authorization endpoint
- Line 424-425: Token endpoint
- Line 448: Registration endpoint

**Fix Required:**
- Configure specific allowed origins
- Use environment variable for CORS configuration
- Validate Origin header against whitelist

#### 3. In-Memory Token Storage
**File:** `ConnectorOAuthProvider.java:85`
**Issue:** All tokens stored in `ConcurrentHashMap` (lost on restart, not multi-instance safe)

```java
// In-memory stores for OAuth flow (TODO: Move to Redis/Database for production)
private final Map<String, OAuthClientInformation> clients = new ConcurrentHashMap<>();
private final Map<String, AuthorizationCode> authorizationCodes = new ConcurrentHashMap<>();
private final Map<String, String> accessTokens = new ConcurrentHashMap<>();
private final Map<String, String> refreshTokens = new ConcurrentHashMap<>();
```

**Fix Required:**
- Create database schema for OAuth tables
- Move all token storage to PostgreSQL or Redis
- Implement token cleanup for expired entries

#### 4. No OAuth Test Coverage
**Issue:** Zero test files for OAuth functionality
**Missing Tests:**
- Unit tests for `ConnectorOAuthProvider`
- Integration tests for OAuth flow
- PKCE verification tests
- Token refresh tests
- Scope validation tests
- Security tests (CSRF, injection, etc.)

**Fix Required:**
- Create `ConnectorOAuthProviderTest.java`
- Create `OAuthFlowIntegrationTest.java`
- Add test coverage for all OAuth endpoints

#### 5. Hardcoded User Context
**File:** `ConnectorOAuthProvider.java:484`
**Issue:** Uses hardcoded "admin" user instead of authenticated user

```java
// TODO: Integrate with SecurityContext once openmetadata-service dependency is available
String userName = "admin"; // Default user for MCP operations
```

**Fix Required:**
- Integrate with OpenMetadata SecurityContext
- Extract actual authenticated user from JWT token
- Apply user-specific permissions

---

## ⚠️ High Priority Issues

### 6. No Scope-Based Authorization
**Issue:** Scopes are validated and stored but NOT enforced on MCP endpoints
**Impact:** All authenticated users have full access regardless of granted scopes

**Fix Required:**
- Implement scope checking on MCP tool endpoints
- Add annotation-based scope enforcement
- Document required scopes per endpoint

### 7. Best-Effort Token Persistence
**File:** `ConnectorOAuthProvider.java:424-434`
**Issue:** Refreshed token persistence failures silently ignored

```java
try {
    serviceRepository.persistOAuthCredentials(service);
} catch (Exception dbEx) {
    LOG.error("Failed to persist refreshed OAuth credentials", dbEx);
    // Don't fail the request - storage update is best-effort
}
```

**Fix Required:**
- Implement retry logic for database failures
- Add transaction support
- Alert on persistent storage failures

### 8. Deprecated Auth Providers
**Files:** `TokenHandler.java`, `OpenMetadataAuthProvider.java`
**Issue:** Both throw "not_implemented" exceptions

**Fix Required:**
- Complete OpenMetadataAuthProvider SSO integration
- Remove deprecated TokenHandler or implement properly
- Update documentation

---

## 📋 Medium Priority Tasks

### 9. Databricks Connector Support
**Locations:** 3 TODOs in `ConnectorOAuthProvider.java`
- Line 244-245: Token endpoint inference
- Line 259: OAuth credential extraction
- Line 386: Token refresh support

**Fix Required:**
- Define Databricks OAuth credentials schema
- Update `databricksConnection.json` with OAuth fields
- Implement token endpoint inference for Databricks

### 10. Missing Database Schema
**Issue:** No SQL migration files for OAuth tables

**Required Tables:**
- `oauth_clients` - Registered OAuth clients
- `oauth_authorization_codes` - Authorization codes with PKCE
- `oauth_access_tokens` - Issued access tokens
- `oauth_refresh_tokens` - Refresh tokens
- `oauth_token_mappings` - MCP JWT → Connector token mappings
- `oauth_audit_log` - OAuth operation audit trail

### 11. Production Hardening
**Missing Features:**
- Token introspection endpoint (RFC 7662)
- Token revocation endpoint (RFC 7009)
- Rate limiting on OAuth endpoints
- Audit logging for all OAuth operations
- HTTPS enforcement
- Client secret rotation

---

## 🔮 Future Enhancements

### 12. OpenID Connect Support
- ID token generation
- UserInfo endpoint
- OIDC discovery metadata
- JWT ID tokens instead of opaque tokens

### 13. Advanced OAuth Features
- Device authorization flow (RFC 8628)
- JWT bearer grant (RFC 7523)
- Token exchange (RFC 8693)
- Multi-tenant support

### 14. Observability
- Prometheus metrics for OAuth operations
- Distributed tracing integration
- OAuth flow debugging UI

---

## 📊 Implementation Statistics

| Category | Complete | In Progress | Not Started | Total |
|----------|----------|-------------|-------------|-------|
| Core OAuth Flow | 5 | 1 | 0 | 6 |
| Security Features | 6 | 0 | 4 | 10 |
| Database Persistence | 2 | 0 | 1 | 3 |
| API Endpoints | 6 | 0 | 2 | 8 |
| Test Coverage | 0 | 0 | 4 | 4 |
| Documentation | 5 | 0 | 2 | 7 |
| **TOTAL** | **24** | **1** | **13** | **38** |

**Completion:** 63% (24/38 tasks)

---

## 🚀 Recommended Implementation Priority

### Phase 1: Security Fixes (CRITICAL - 1 week)
1. ✅ Implement PKCE verification
2. ✅ Fix CORS wildcard configuration
3. ✅ Add OAuth unit tests (80%+ coverage)
4. ✅ Integrate SecurityContext for user context

### Phase 2: Production Readiness (2 weeks)
5. ✅ Create database schema for OAuth tables
6. ✅ Migrate token storage from in-memory to database
7. ✅ Implement scope-based authorization
8. ✅ Add comprehensive integration tests
9. ✅ Implement token cleanup mechanism

### Phase 3: Connector Expansion (1 week)
10. ✅ Add Databricks OAuth support
11. ✅ Test with multiple Snowflake instances
12. ✅ Document connector onboarding process

### Phase 4: Hardening (1 week)
13. ✅ Add audit logging
14. ✅ Implement rate limiting
15. ✅ Add Prometheus metrics
16. ✅ Production deployment guide

**Total Estimated Effort:** 5 weeks

---

## 📝 File Change Summary

### New Files Created (14)
1. `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/provider/ConnectorOAuthProvider.java`
2. `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/handlers/OAuthSetupHandler.java`
3. `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/OAuthSetupRequest.java`
4. `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/common/oauthCredentials.json`
5. `MCP_OAUTH_README.md`
6. `OAUTH_SSO_INTEGRATION.md`
7. `OAUTH_MCP_TESTING_GUIDE.md`
8. `QUICK_START_MCP_TESTING.md`
9. `SNOWFLAKE_TEST_CREDENTIALS.md`
10. `scripts/test-oauth-flow.sh`
11. `scripts/setup-mcp-test-snowflake.sh`
12. `scripts/verify-mcp-setup.sh`
13. `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/filters/OAuthWellKnownFilter.java`
14. `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/transport/OAuthHttpStatelessServerTransportProvider.java`

### Modified Files (5)
1. `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/DatabaseServiceRepository.java`
2. `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json`
3. `openmetadata-mcp/src/main/java/org/openmetadata/mcp/McpServer.java`
4. `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/auth/handlers/AuthorizationHandler.java`
5. `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/transport/HttpServletStatelessServerTransport.java`

---

## 🎯 Next Steps

1. **Immediate:** Fix PKCE verification (CRITICAL security issue)
2. **This Week:** Add comprehensive OAuth test coverage
3. **Next Week:** Design and implement database schema for OAuth persistence
4. **Month 1:** Complete Phase 1 & 2 (Security + Production Readiness)

---

## 📞 Contact & Resources

- **Branch:** `oauth-mcp` (1 commit ahead of origin)
- **Base Branch:** `main`
- **Documentation:** See `MCP_OAUTH_README.md` for complete implementation guide
- **Testing:** Run `./scripts/test-oauth-flow.sh` for comprehensive flow testing

# OpenMetadata MCP OAuth Implementation

OAuth 2.0 authentication server for Model Context Protocol (MCP) integration with OpenMetadata, enabling secure access to metadata through Claude Desktop and other MCP clients.

## Overview

This module implements a complete OAuth 2.0 Authorization Code Flow with PKCE for MCP clients, enabling **user authentication** via OpenMetadata's existing SSO providers (Google, Okta, Azure AD, Auth0, AWS Cognito, Custom OIDC, LDAP, SAML) or Basic Auth. The implementation provides secure, standards-compliant access to OpenMetadata's metadata management capabilities through MCP tools.

**Important**: This is **user SSO authentication** for MCP clients, not connector-based OAuth for data sources. Users authenticate with their OpenMetadata credentials (SSO or username/password), and MCP tools execute with that user's permissions.

## Features

### OAuth 2.0 Implementation
- **Authorization Code Flow with PKCE** - RFC 7636 compliant, preventing authorization code interception attacks
- **Refresh Token Rotation** - Automatic token refresh with rotation for enhanced security
- **Token Encryption** - Fernet symmetric encryption for tokens at rest
- **CSRF Protection** - State parameter validation across the OAuth flow
- **Session Fixation Prevention** - Session regeneration after successful authentication

### Authentication Methods
- **SSO Integration** - OAuth 2.0 integration with Google, Okta, Azure AD, Auth0, AWS Cognito, Custom OIDC, LDAP, and SAML providers via pac4j
- **Basic Auth** - Username/password authentication with OpenMetadata credentials
- **User Impersonation** - Support for impersonated user contexts in MCP tools
- **Auto-Detection** - Automatically selects SSO or Basic Auth based on OpenMetadata configuration

### Security Features
- **PKCE Validation** - SHA-256 code challenge/verifier validation
- **Token Expiry Management** - Configurable access token (1 hour) and refresh token (7 days) lifetimes
- **Rate Limiting** - Registration (10/hour per IP) and token (30/minute per IP) endpoint protection
- **Thread-Safe Concurrent Processing** - ThreadLocal storage for request isolation
- **Audit Logging** - OAuth operations logged via SLF4J (oauth_audit_log table available for future use)

### Database-Driven Configuration
- **Runtime Configuration** - Update MCP settings without server restart via REST API
- **Cluster Synchronization** - Database polling (10-second interval) ensures all cluster instances have consistent configuration
- **Configuration Change Listeners** - Dynamic CORS origin updates when configuration changes
- **Persistent Storage** - Configuration changes persist across server restarts (database-first, YAML fallback)
- **HTTP Timeout Configuration** - Configurable connection and read timeouts for SSO provider metadata fetching

### MCP Integration
- **Claude Desktop Support** - First-class integration with Claude Desktop MCP client
- **OAuth Discovery Endpoints** - Standard .well-known endpoints for client configuration
- **Dynamic Client Registration** - RFC 7591 compliant client registration
- **JWKS Support** - Public key endpoint for JWT validation

## Architecture

### Core Components

**UserSSOOAuthProvider**
- Main OAuth provider implementing authorization code flow
- Handles both Google SSO and Basic Auth flows
- Token generation, validation, and refresh logic
- PKCE challenge/verifier validation with timing-safe comparison

**OAuthHttpStatelessServerTransportProvider**
- HTTP transport layer for OAuth endpoints
- Routes authorization, token, and discovery requests
- Servlet-based stateless request handling
- Provider-aware OAuth scope configuration

**SecurityConfigurationManager**
- Singleton manager for runtime security configuration (authentication, authorization, MCP settings)
- Database-first configuration loading with YAML fallback
- Configuration change listener pattern for reactive updates
- Cluster-aware polling mechanism (10-second interval) to detect changes across instances
- Rollback mechanism for failed configuration updates
- Thread-safe synchronized getters for consistent configuration reads

**OAuth Repositories**
- OAuthClientRepository - Client management and validation
- OAuthAuthorizationCodeRepository - Authorization code CRUD operations
- OAuthAccessTokenRepository - Access token lifecycle management
- OAuthRefreshTokenRepository - Refresh token rotation and cleanup
- McpPendingAuthRequestRepository - Database-backed OAuth state persistence
- OAuthAuditLogRepository - Comprehensive audit trail

### Database Schema

Five core OAuth tables with audit logging:

- **oauth_clients** - Dynamically registered MCP clients via RFC 7591
- **oauth_authorization_codes** - Short-lived codes (10 min TTL) with PKCE challenge
- **oauth_access_tokens** - JWT access tokens (1 hour TTL) with encryption
- **oauth_refresh_tokens** - Refresh tokens (7 days TTL) with automatic rotation
- **mcp_pending_auth_requests** - OAuth state parameters for cross-domain redirects (10 min TTL)
- **oauth_audit_log** - Comprehensive audit trail of all OAuth operations

**Cleanup Job**: OAuthTokenCleanupJob runs every 10 minutes to purge expired tokens and pending requests.

## OAuth Flow

### Authorization Code Flow with PKCE

```
┌─────────────┐                                                    ┌──────────────┐
│   Claude    │                                                    │ OpenMetadata │
│   Desktop   │                                                    │     MCP      │
│ (MCP Client)│                                                    │    Server    │
└──────┬──────┘                                                    └──────┬───────┘
       │                                                                  │
       │  1. Generate PKCE code_verifier (random 43-128 chars)           │
       │     Calculate code_challenge = BASE64URL(SHA256(verifier))      │
       │                                                                  │
       │  2. GET /api/v1/mcp/authorize                                   │
       │     ?client_id={registered_client_id}                          │
       │     &redirect_uri=http://127.0.0.1:XXXXX/callback              │
       │     &code_challenge={challenge}                                 │
       │     &code_challenge_method=S256                                 │
       │     &state={client_state}                                       │
       │─────────────────────────────────────────────────────────────────>│
       │                                                                  │
       │                        3. Store OAuth state in database:        │
       │                           - client_id, redirect_uri             │
       │                           - code_challenge, method              │
       │                           - state, scopes, TTL (10 min)         │
       │                           Generate authRequestId                │
       │                                                                  │
       │  4. 302 Redirect to Auth Page                                   │
       │     /api/v1/mcp/authorize?state=mcp:{authRequestId}            │
       │<─────────────────────────────────────────────────────────────────│
       │                                                                  │
       │  5. User authenticates via:                                     │
       │     ┌──────────────────────────────────────┐                    │
       │     │  Option A: SSO Provider              │                    │
       │     │  - Redirect to SSO provider:         │                    │
       │     │    • Google OAuth                    │                    │
       │     │    • Okta                            │                    │
       │     │    • Azure AD                        │                    │
       │     │    • Auth0                           │                    │
       │     │    • AWS Cognito                     │                    │
       │     │    • Custom OIDC                     │                    │
       │     │    • LDAP                            │                    │
       │     │    • SAML                            │                    │
       │     │  - User grants consent               │                    │
       │     │  - SSO callback with ID token (pac4j)│                    │
       │     └──────────────────────────────────────┘                    │
       │                  OR                                              │
       │     ┌─────────────────────────────┐                             │
       │     │  Option B: Basic Auth       │                             │
       │     │  - Username/password form   │                             │
       │     │  - Validate with            │                             │
       │     │    OpenMetadata             │                             │
       │     └─────────────────────────────┘                             │
       │                                                                  │
       │                        6. Lookup OAuth state from DB using      │
       │                           authRequestId from state parameter    │
       │                           Generate authorization code           │
       │                           Store code + code_challenge in DB     │
       │                                                                  │
       │  7. 302 Redirect with authorization code                        │
       │     {redirect_uri}?code={auth_code}&state={client_state}       │
       │<─────────────────────────────────────────────────────────────────│
       │                                                                  │
       │  8. POST /api/v1/mcp/token                                      │
       │     grant_type=authorization_code                               │
       │     code={auth_code}                                            │
       │     code_verifier={verifier}                                    │
       │     client_id={registered_client_id}                           │
       │     redirect_uri=http://127.0.0.1:XXXXX/callback              │
       │─────────────────────────────────────────────────────────────────>│
       │                                                                  │
       │                        9. PKCE Validation:                      │
       │                           Lookup code_challenge from DB         │
       │                           Verify: BASE64URL(SHA256(verifier))   │
       │                                 == code_challenge               │
       │                           Delete authorization code (single-use)│
       │                                                                  │
       │  10. 200 OK                                                     │
       │      {                                                           │
       │        "access_token": "eyJhbGc...",  // JWT, 1 hour TTL       │
       │        "refresh_token": "fernet_encrypted", // 7 days TTL       │
       │        "token_type": "Bearer",                                  │
       │        "expires_in": 3600                                       │
       │      }                                                           │
       │<─────────────────────────────────────────────────────────────────│
       │                                                                  │
       │  11. Use MCP Tools                                              │
       │      Authorization: Bearer eyJhbGc...                           │
       │─────────────────────────────────────────────────────────────────>│
       │      MCP Tool Execution (lineage, search, discovery, etc.)      │
       │<─────────────────────────────────────────────────────────────────│
       │                                                                  │
       │  12. Token Expiry - Refresh Flow                                │
       │      POST /api/v1/mcp/token                                     │
       │      grant_type=refresh_token                                   │
       │      refresh_token={encrypted_token}                            │
       │─────────────────────────────────────────────────────────────────>│
       │                                                                  │
       │                        13. Refresh Token Rotation:              │
       │                           - Decrypt and validate refresh token  │
       │                           - Delete old refresh token            │
       │                           - Generate new access + refresh tokens│
       │                                                                  │
       │  14. 200 OK                                                     │
       │      {                                                           │
       │        "access_token": "eyJhbGc...",  // New JWT               │
       │        "refresh_token": "new_encrypted", // New rotated token   │
       │        "token_type": "Bearer",                                  │
       │        "expires_in": 3600                                       │
       │      }                                                           │
       │<─────────────────────────────────────────────────────────────────│
       │                                                                  │
```

### Key Security Mechanisms

**PKCE (Proof Key for Code Exchange)**
- Client generates random code_verifier (43-128 characters)
- Calculates code_challenge = BASE64URL(SHA256(code_verifier))
- Server stores code_challenge with authorization code
- Client proves possession by sending code_verifier on token exchange
- Server validates: BASE64URL(SHA256(code_verifier)) == stored code_challenge
- Prevents authorization code interception attacks

**Database-Backed State Persistence**
- OAuth state parameters stored in database, not HTTP sessions
- Survives cross-domain redirects (e.g., Google OAuth callback)
- Each request gets unique authRequestId embedded in state parameter
- 10-minute TTL prevents stale state attacks
- Single-use: deleted after successful callback

**Token Security**
- Access tokens: JWT signed with RSA-256, validated via JWKS endpoint
- Refresh tokens: Fernet symmetric encryption at rest
- Authorization codes: Single-use, 10-minute expiry, tied to PKCE challenge
- Refresh token rotation: Old token invalidated when new one issued

## Configuration

### MCP Configuration (Database-Driven)

MCP-specific settings are managed via REST API with database persistence:

```bash
# Get current MCP configuration
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8585/api/v1/system/mcp/config

# Update MCP configuration (no restart required)
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://metadata.example.com",
    "allowedOrigins": ["https://app.example.com"],
    "connectTimeout": 30000,
    "readTimeout": 60000,
    "enabled": true
  }' \
  http://localhost:8585/api/v1/system/mcp/config
```

**Configuration Properties:**
- `baseUrl` - OAuth issuer URL (used for metadata endpoints)
- `allowedOrigins` - CORS whitelist for OAuth endpoints (use specific origins, not `*`)
- `connectTimeout` - HTTP connection timeout for SSO provider metadata (milliseconds)
- `readTimeout` - HTTP read timeout for SSO provider metadata (milliseconds)
- `enabled` - Enable/disable MCP server

**Key Features:**
- Changes take effect immediately across all cluster instances (10-second polling interval)
- Configuration persists across server restarts (database-first, YAML fallback)
- CORS origins update dynamically without restart via listener pattern

### OAuth Server Configuration

The OAuth server is configured in `openmetadata.yaml`:

- **JWT Configuration** - RSA key pair for token signing, JWKS endpoint URL
- **Token Expiry** - Access token (1 hour) and refresh token (7 days) lifetimes
- **Rate Limiting** - Registration (10/hour per IP) and token endpoint (30/minute per IP) rate limits
- **SSO Provider** - Google, Okta, Azure AD, etc. OAuth client ID and secret for SSO integration
- **Callback URLs** - Allowed redirect URIs for OAuth clients

### Client Registration

MCP clients use **Dynamic Client Registration (RFC 7591)** via `POST /api/v1/mcp/register`:

- **client_name** - Human-readable client name
- **redirect_uris** - Allowed callback URLs for OAuth redirects
- **scopes** - Requested OAuth scopes (openid, profile, email, offline_access)
- **grant_types** - Supported grant types (authorization_code, refresh_token)

The registration endpoint returns a `client_id` and optional `client_secret` for the OAuth flow.

## MCP Tools Integration

All MCP tools authenticate using the Bearer token from the OAuth flow:

- **GetLineageTool** - Retrieve entity lineage with authorization checks
- **SearchTool** - Search metadata with user permissions
- **DiscoveryTool** - Discover entities with access control

**Permission Model**: Tool permissions are enforced by OpenMetadata's Authorizer using the user's identity from the JWT. This ensures MCP users have the same access as they would in the OpenMetadata UI - respecting all policies, roles, and ownership rules. OAuth authenticates the user; the Authorizer enforces what they can access.

The transport provider extracts and validates the JWT on every request, setting up the security context for downstream MCP tool execution.

## Recent Improvements

### Security and Reliability Fixes

**Thread Safety and Concurrency**
- Fixed race conditions in configuration reads with synchronized getters
- Implemented ThreadLocal cleanup in outer finally block to prevent memory leaks
- Added rollback mechanism for failed configuration updates

**HTTP Client Configuration**
- Replaced JVM-wide system properties with pac4j-specific HTTP timeouts
- Configurable connection and read timeouts for SSO provider metadata fetching
- Prevents timeout changes from affecting other HTTP clients

**Session Security**
- Added null check after session regeneration to handle invalidate/recreate fallback
- Synchronized pac4j client callback URL modification to prevent race conditions
- Improved CSRF protection with proper session handling

**Configuration Management**
- Database-first loading ensures configuration persists across restarts
- Cluster polling (10-second interval) for consistent configuration across instances
- Configuration change listeners for dynamic CORS updates without restart
- URL validation for MCP configuration API (prevents invalid protocols, partial wildcards)

**Input Validation**
- Validates baseUrl protocol (HTTP/HTTPS only)
- Rejects partial wildcard origins (e.g., `https://*.example.com`)
- Accepts exact wildcard (`*`) for development environments

### Unit Tests

**SecurityConfigurationManagerTest** (9 tests)
- Singleton pattern verification
- Listener registration and removal
- Thread-safe configuration access (10 threads × 100 iterations)
- Synchronized getters preventing race conditions (50 concurrent threads)
- Rollback mechanism validation
- Configuration getter behavior

**MCPConfigurationIntegrationTest** (9 tests, on hold)
- Database-first loading verification
- Configuration update via API
- Configuration persistence across cache reload
- Configuration change detection with polling
- Input validation (invalid protocols, wildcard origins)
- Listener notification on configuration reload
- Multiple sequential updates

## Testing

### OAuth Flow Testing

15 comprehensive integration tests in `UserSSOOAuthProviderIntegrationTest`:

- Authorization endpoint validation (client_id, redirect_uri, PKCE parameters)
- Token exchange with PKCE verification
- Refresh token rotation
- Invalid PKCE challenge/verifier rejection
- Expired authorization code handling
- Invalid client_id and redirect_uri validation
- Missing parameter error handling

### Security Testing

- PKCE challenge/verifier validation across multiple test cases
- Token expiry and refresh flow validation
- Authorization code single-use enforcement
- CSRF state parameter validation
- Rate limiting behavior validation

### SSO Integration Testing

Tests SSO provider integration using pac4j with mock identity providers (Google, Okta, Azure AD, etc.). The UserSSOOAuthProvider auto-detects the configured SSO provider from OpenMetadata's authentication configuration.

## Deployment

### Database Migrations

Schema migrations in `bootstrap/sql/migrations/native/1.12.0/`:

- **mysql/schemaChanges.sql** - OAuth tables creation (oauth_clients, oauth_authorization_codes, oauth_access_tokens, oauth_refresh_tokens, mcp_pending_auth_requests, oauth_audit_log)
- **postgres/schemaChanges.sql** - OAuth tables creation (PostgreSQL equivalent)

### Server Initialization

OAuth components initialized in `McpServer`:

1. JwtFilter and authorizer setup
2. OAuth repositories instantiation
3. UserSSOOAuthProvider initialization with SSO config
4. OAuthHttpStatelessServerTransportProvider registration at /mcp/*
5. SSO callback servlet and Basic Auth login servlet registration
6. OAuthTokenCleanupJob scheduled (10-minute intervals)

### Environment Variables

**SSO Provider Configuration** (varies by provider):
- **OIDC_CLIENT_ID** - OAuth client ID for SSO provider (Google, Okta, Azure, etc.)
- **OIDC_CLIENT_SECRET** - OAuth client secret for SSO provider
- **OIDC_TYPE** - SSO provider type (google, okta, azure, auth0, aws-cognito, custom-oidc)
- **OIDC_DISCOVERY_URI** - OIDC discovery endpoint URL

**JWT Token Configuration**:
- **JWT_ISSUER** - JWT issuer claim for token validation
- **JWT_KEY_ID** - RSA key pair ID for token signing

**MCP Configuration** (optional, can be set via API):
- **MCP_BASE_URL** - OAuth issuer base URL
- **MCP_ALLOWED_ORIGINS** - Comma-separated CORS origins

## Security Considerations

- **Public Client Security** - PKCE mandatory for all authorization code flows
- **Redirect URI Validation** - HTTP redirect URIs restricted to loopback addresses per RFC 8252; HTTPS URIs validated against registered client URIs
- **Token Storage** - Refresh tokens encrypted at rest using Fernet
- **Session Management** - Stateless design with database-backed state persistence
- **Audit Trail** - All OAuth operations logged for compliance and forensics
- **Rate Limiting** - Registration (10/hour per IP) and token (30/minute per IP) endpoint rate limiting
- **CORS Security** - Deny-all CORS when MCP configuration is unavailable (no permissive localhost fallback)
- **Single-Use Codes** - Authorization codes deleted after exchange
- **Token Rotation** - Refresh tokens rotated on every refresh to limit exposure
- **Timing-Safe Comparisons** - CSRF and PKCE validation use MessageDigest.isEqual() to prevent timing attacks
- **Provider-Aware Scopes** - OAuth scopes automatically adjusted based on SSO provider (Google, Okta, Azure, etc.)
- **JWK Caching** - 6-hour TTL with cache-miss retry for responsive key rotation handling

## License

Apache License 2.0
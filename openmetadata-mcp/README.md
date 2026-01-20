# OpenMetadata MCP OAuth Implementation

OAuth 2.0 authentication server for Model Context Protocol (MCP) integration with OpenMetadata, enabling secure access to metadata through Claude Desktop and other MCP clients.

## Overview

This module implements a complete OAuth 2.0 Authorization Code Flow with PKCE for MCP clients, supporting both Google SSO and Basic Auth authentication methods. The implementation provides secure, standards-compliant access to OpenMetadata's metadata management capabilities through MCP tools.

## Features

### OAuth 2.0 Implementation
- **Authorization Code Flow with PKCE** - RFC 7636 compliant, preventing authorization code interception attacks
- **Refresh Token Rotation** - Automatic token refresh with rotation for enhanced security
- **Token Encryption** - Fernet symmetric encryption for tokens at rest
- **CSRF Protection** - State parameter validation across the OAuth flow
- **Session Fixation Prevention** - Session regeneration after successful authentication

### Authentication Methods
- **Google SSO** - OAuth 2.0 integration with Google Identity Platform via pac4j
- **Basic Auth** - Username/password authentication with OpenMetadata credentials
- **User Impersonation** - Support for impersonated user contexts in MCP tools

### Security Features
- **PKCE Validation** - SHA-256 code challenge/verifier validation
- **Token Expiry Management** - Configurable access token (1 hour) and refresh token (7 days) lifetimes
- **Rate Limiting** - Token endpoint protection (100 requests/hour per client)
- **Thread-Safe Concurrent Processing** - ThreadLocal storage for request isolation
- **Comprehensive Audit Logging** - All OAuth operations logged to oauth_audit_log table

### MCP Integration
- **Claude Desktop Support** - First-class integration with Claude Desktop MCP client
- **OAuth Discovery Endpoints** - Standard .well-known endpoints for client configuration
- **Dynamic Client Registration** - RFC 7591 compliant client registration
- **JWKS Support** - Public key endpoint for JWT validation

## Architecture

### Core Components

**UserSSOOAuthProvider** (1148 lines)
- Main OAuth provider implementing authorization code flow
- Handles both Google SSO and Basic Auth flows
- Token generation, validation, and refresh logic
- PKCE challenge/verifier validation

**OAuthHttpStatelessServerTransportProvider** (511 lines)
- HTTP transport layer for OAuth endpoints
- Routes authorization, token, and discovery requests
- Servlet-based stateless request handling

**McpAuthFilter**
- Authentication filter for MCP endpoints
- JWT token validation
- OAuth endpoint exemptions (no auth required for .well-known endpoints)
- CORS preflight support
- User impersonation context management

**OAuth Repositories**
- OAuthClientRepository - Client management and validation
- OAuthAuthorizationCodeRepository - Authorization code CRUD operations
- OAuthAccessTokenRepository - Access token lifecycle management
- OAuthRefreshTokenRepository - Refresh token rotation and cleanup
- McpPendingAuthRequestRepository - Database-backed OAuth state persistence
- OAuthAuditLogRepository - Comprehensive audit trail

### Database Schema

Five core OAuth tables with audit logging:

- **oauth_clients** - Registered MCP clients (Claude Desktop, custom clients)
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
       │     ?client_id=claude-desktop                                   │
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
       │     ┌─────────────────────────────┐                             │
       │     │  Option A: Google SSO       │                             │
       │     │  - Redirect to Google OAuth │                             │
       │     │  - User grants consent      │                             │
       │     │  - Google callback with     │                             │
       │     │    ID token (pac4j)         │                             │
       │     └─────────────────────────────┘                             │
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
       │     client_id=claude-desktop                                    │
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

### OAuth Server Configuration

The OAuth server is configured in `openmetadata.yaml`:

- **JWT Configuration** - RSA key pair for token signing, JWKS endpoint URL
- **Token Expiry** - Access token (1 hour) and refresh token (7 days) lifetimes
- **Rate Limiting** - Token endpoint rate limits (100 requests/hour per client)
- **SSO Provider** - Google OAuth client ID and secret for SSO integration
- **Callback URLs** - Allowed redirect URIs for OAuth clients

### Client Registration

Clients are registered via POST /api/v1/mcp/register:

- **client_id** - Unique identifier (e.g., "claude-desktop")
- **redirect_uris** - Allowed callback URLs (localhost for Claude Desktop)
- **scopes** - Requested OAuth scopes
- **grant_types** - Supported grant types (authorization_code, refresh_token)

Claude Desktop is pre-registered with localhost redirect URIs.

## MCP Tools Integration

All MCP tools authenticate using the Bearer token from the OAuth flow:

- **GetLineageTool** - Retrieve entity lineage with authorization checks
- **SearchTool** - Search metadata with user permissions
- **DiscoveryTool** - Discover entities with access control
- **User Impersonation** - ImpersonationContext ThreadLocal for impersonated requests

The McpAuthFilter extracts and validates the JWT on every request, setting up the security context for downstream MCP tool execution.

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

Tests Google OAuth integration using pac4j with mock Google Identity Provider.

## Deployment

### Database Migrations

Schema migrations in `bootstrap/sql/migrations/native/1.12.1/`:

- **mysql/schemaChanges.sql** - OAuth tables creation for MySQL
- **postgres/schemaChanges.sql** - OAuth tables creation for PostgreSQL
- **mysql/postDataMigration.sql** - Snowflake backward compatibility migration
- **postgres/postDataMigration.sql** - Snowflake backward compatibility migration

### Server Initialization

OAuth components initialized in `McpApplication`:

1. JwtFilter and authorizer setup
2. OAuth repositories instantiation
3. UserSSOOAuthProvider initialization with SSO config
4. OAuthHttpStatelessServerTransportProvider registration
5. McpAuthFilter registration for /api/v1/mcp/* endpoints
6. OAuthTokenCleanupJob scheduled (10-minute intervals)

### Environment Variables

- **GOOGLE_CLIENT_ID** - Google OAuth client ID for SSO
- **GOOGLE_CLIENT_SECRET** - Google OAuth client secret
- **JWT_ISSUER** - JWT issuer claim for token validation
- **JWT_KEY_ID** - RSA key pair ID for token signing

## Security Considerations

- **Public Client Security** - PKCE mandatory for all authorization code flows
- **Token Storage** - Refresh tokens encrypted at rest using Fernet
- **Session Management** - Stateless design with database-backed state persistence
- **Audit Trail** - All OAuth operations logged for compliance and forensics
- **Rate Limiting** - Protection against brute force and token exhaustion attacks
- **Single-Use Codes** - Authorization codes deleted after exchange
- **Token Rotation** - Refresh tokens rotated on every refresh to limit exposure

## License

Apache License 2.0
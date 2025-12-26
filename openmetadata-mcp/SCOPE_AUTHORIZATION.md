# Scope-Based Authorization Implementation

## Overview

This document describes the scope-based authorization system implemented for OpenMetadata MCP endpoints. The implementation adds fine-grained access control at the tool level, ensuring that OAuth clients can only execute operations they have been explicitly granted permission to perform.

## Architecture

The scope-based authorization system consists of several key components:

### 1. Annotation-Based Scope Declaration

**File**: `RequireScope.java`
- **Location**: `/server/auth/annotations/RequireScope.java`
- **Purpose**: Declares which scopes are required to execute a tool
- **Usage**: Applied to tool classes

```java
@RequireScope({"metadata:read"})
public class SearchMetadataTool implements McpTool {
    // Tool implementation
}
```

**Features**:
- Support for multiple scopes (OR logic by default)
- Optional AND logic via `requireAll` parameter
- Runtime retention for reflection-based enforcement

### 2. Scope Validation Logic

**File**: `ScopeValidator.java`
- **Location**: `/server/auth/ScopeValidator.java`
- **Purpose**: Contains the core scope validation logic
- **Features**:
  - OR mode: At least one scope must match
  - AND mode: All scopes must match
  - Detailed error messages with missing scopes
  - Static utility methods for easy integration

### 3. Authorization Exception

**File**: `AuthorizationException.java`
- **Location**: `/server/auth/AuthorizationException.java`
- **Purpose**: Specialized exception for scope validation failures
- **Features**:
  - Includes required scopes in exception
  - Includes granted scopes in exception
  - Enables detailed error responses to clients

### 4. Enhanced AuthContext

**File**: `AuthContext.java` (updated)
- **Location**: `/server/auth/middleware/AuthContext.java`
- **New Methods**:
  - `getScopes()`: Get all granted scopes
  - `hasAnyScope(String...)`: Check for at least one scope
  - `hasAllScopes(String...)`: Check for all scopes
  - `requireScopes(String[], boolean)`: Validate and throw on failure
  - `requireAnyScope(String...)`: Validate OR logic
  - `requireAllScopes(String...)`: Validate AND logic

### 5. Scope Interceptor

**File**: `ScopeInterceptor.java`
- **Location**: `/server/auth/ScopeInterceptor.java`
- **Purpose**: Intercepts tool execution to validate scopes
- **Integration**: Called in `DefaultToolContext.callTool()`

### 6. Tool Execution Integration

**File**: `DefaultToolContext.java` (updated)
- **Changes**:
  - Added `ScopeInterceptor.validateToolScopes(tool)` before each tool execution
  - Separate exception handling for scope vs. resource authorization
  - Detailed error responses with scope information

## Scope Definitions

### Standard Scopes

| Scope | Description | Tools |
|-------|-------------|-------|
| `metadata:read` | Read-only access to metadata | search_metadata, get_entity_details, get_entity_lineage |
| `metadata:write` | Write access to metadata | patch_entity, create_glossary, create_glossary_term |
| `connector:access` | Access to connector operations | Reserved for future use |

### Legacy Scopes (Backward Compatibility)

| Legacy Scope | Maps To | Status |
|--------------|---------|--------|
| `read` | `metadata:read` | Supported |
| `write` | `metadata:write` | Supported |

## Tool Scope Assignments

### Read-Only Tools

```java
@RequireScope({"metadata:read"})
```

- **SearchMetadataTool**: Search and query metadata entities
- **GetEntityTool**: Retrieve detailed entity information
- **GetLineageTool**: Get entity lineage relationships

### Write Tools

```java
@RequireScope({"metadata:write"})
```

- **PatchEntityTool**: Update entities via JSON Patch
- **GlossaryTool**: Create glossaries
- **GlossaryTermTool**: Create glossary terms

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Client Request (with Bearer Token)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ BearerAuthenticator                                         │
│ • Validates token                                            │
│ • Extracts scopes from AccessToken                          │
│ • Creates AuthContext with scopes                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ DefaultToolContext.callTool()                               │
│ • Instantiates tool                                         │
│ • Calls ScopeInterceptor.validateToolScopes(tool)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ ScopeInterceptor                                            │
│ • Reads @RequireScope annotation from tool class           │
│ • Gets AuthContext.getCurrent()                             │
│ • Validates scopes using ScopeValidator                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
    ┌──────────────┐   ┌──────────────┐
    │ Valid Scopes │   │Invalid Scopes│
    └──────┬───────┘   └──────┬───────┘
           │                  │
           ▼                  ▼
    ┌──────────────┐   ┌──────────────────────────┐
    │Execute Tool  │   │Throw AuthorizationException│
    └──────────────┘   └──────────────────────────┘
```

## Error Response Format

When scope validation fails, clients receive a detailed error response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{
        \"error\": \"Insufficient scope: Access denied: At least one of [metadata:write] is required. Granted scopes: [metadata:read]\",
        \"statusCode\": 403,
        \"requiredScopes\": [\"metadata:write\"],
        \"grantedScopes\": [\"metadata:read\"]
      }"
    }],
    "isError": true
  }
}
```

## Testing

### Manual Testing Script

```bash
#!/bin/bash

# 1. Get authorization code with limited scope
AUTH_RESPONSE=$(curl -s -i "http://localhost:8585/mcp/authorize?
  client_id=example-client&
  redirect_uri=http://localhost:8585/callback&
  response_type=code&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256&
  scope=metadata:read&
  state=test123")

CODE=$(echo "$AUTH_RESPONSE" | grep "Location:" | sed 's/.*code=\([^&]*\).*/\1/' | tr -d '\r')

# 2. Exchange for access token
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8585/mcp/token \
  -d "grant_type=authorization_code" \
  -d "code=$CODE" \
  -d "redirect_uri=http://localhost:8585/callback" \
  -d "code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" \
  -d "client_id=example-client" \
  -d "client_secret=example-secret")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

# 3. Test read operation (should succeed)
echo "Testing read operation..."
curl -X POST http://localhost:8585/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_metadata","arguments":{"query":"*"}}}' \
  | jq

# 4. Test write operation (should fail with 403)
echo "Testing write operation..."
curl -X POST http://localhost:8585/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"patch_entity","arguments":{"entityType":"table","entityFqn":"test.table","patch":"[{}]"}}}' \
  | jq
```

### Expected Results

**Read operation**: Success with results
**Write operation**: Error with:
- `statusCode: 403`
- `requiredScopes: ["metadata:write"]`
- `grantedScopes: ["metadata:read"]`

## Configuration

### Requesting Scopes in OAuth Flow

Clients should request the minimum required scopes:

```
GET /mcp/authorize?
  scope=metadata:read          # Read-only access
  scope=metadata:read+metadata:write  # Full access
```

### Default Scopes

If no scope is specified, the client configuration determines the default scopes. It's recommended to always explicitly request scopes.

## Implementation Checklist

- [x] Created `@RequireScope` annotation
- [x] Created `ScopeValidator` utility class
- [x] Created `AuthorizationException`
- [x] Enhanced `AuthContext` with scope methods
- [x] Created `ScopeInterceptor`
- [x] Applied `@RequireScope` to all tools
- [x] Updated `DefaultToolContext` to use interceptor
- [x] Updated documentation (MCP_OAUTH_README.md)
- [x] Added testing examples
- [x] Code formatted with Spotless

## Future Enhancements

### Planned Features

1. **Dynamic Scope Registration**: Allow tools to register custom scopes
2. **Hierarchical Scopes**: Support for scope inheritance (e.g., `metadata:*`)
3. **Scope Discovery**: Add endpoint to list available scopes
4. **Scope Groups**: Pre-defined scope bundles for common use cases
5. **Audit Logging**: Log all scope validation events
6. **Scope Metadata**: Rich metadata for each scope (description, category)

### Potential Improvements

1. **Method-Level Scopes**: Support `@RequireScope` on individual methods
2. **Conditional Scopes**: Scope requirements based on request parameters
3. **Scope Transformation**: Map legacy scopes to new format automatically
4. **Scope Analytics**: Track which scopes are most commonly used
5. **Scope Recommendations**: Suggest optimal scopes based on usage patterns

## Security Considerations

### Best Practices

1. **Principle of Least Privilege**: Request only necessary scopes
2. **Scope Rotation**: Consider implementing scope expiration
3. **Audit Trail**: Log all scope denials for security monitoring
4. **Scope Review**: Regularly review and update scope assignments
5. **Defense in Depth**: Scopes complement, not replace, resource-level authorization

### Attack Vectors and Mitigations

| Attack Vector | Mitigation |
|---------------|------------|
| Scope escalation | Scopes are validated at runtime from immutable token |
| Token replay | Use short-lived tokens with expiration |
| Scope enumeration | Rate limit authorization requests |
| Privilege creep | Regular scope audits and rotation |

## Troubleshooting

### Common Issues

**Issue**: Tool execution returns 403 even with correct token
- **Cause**: Token missing required scope
- **Solution**: Check `requiredScopes` in error response and re-authorize

**Issue**: No scope validation occurs
- **Cause**: AuthContext not set
- **Solution**: Ensure OAuth authentication middleware is enabled

**Issue**: All tools fail with scope error
- **Cause**: Token has no scopes
- **Solution**: Verify token generation includes scope claim

## References

- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [OAuth 2.0 Bearer Token Usage RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750)
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP_OAUTH_README.md](./MCP_OAUTH_README.md) - Full OAuth implementation documentation

## Files Changed

### New Files Created

1. `/server/auth/annotations/RequireScope.java` - Scope requirement annotation
2. `/server/auth/ScopeValidator.java` - Scope validation utility
3. `/server/auth/AuthorizationException.java` - Scope authorization exception
4. `/server/auth/ScopeInterceptor.java` - Scope enforcement interceptor
5. `/SCOPE_AUTHORIZATION.md` - This documentation

### Files Modified

1. `/server/auth/middleware/AuthContext.java` - Added scope helper methods
2. `/tools/DefaultToolContext.java` - Integrated scope validation
3. `/tools/SearchMetadataTool.java` - Added `@RequireScope` annotation
4. `/tools/GetEntityTool.java` - Added `@RequireScope` annotation
5. `/tools/GetLineageTool.java` - Added `@RequireScope` annotation
6. `/tools/PatchEntityTool.java` - Added `@RequireScope` annotation
7. `/tools/GlossaryTool.java` - Added `@RequireScope` annotation
8. `/tools/GlossaryTermTool.java` - Added `@RequireScope` annotation
9. `/MCP_OAUTH_README.md` - Added scope documentation section

## Version History

- **v1.0** (2025-12-24): Initial implementation
  - Basic scope validation with OR logic
  - Standard scopes: `metadata:read`, `metadata:write`
  - Applied to all existing tools
  - Comprehensive documentation

---

**Maintainer**: OpenMetadata Team
**Last Updated**: 2025-12-24

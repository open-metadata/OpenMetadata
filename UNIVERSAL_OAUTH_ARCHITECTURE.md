# Universal OAuth Architecture for OpenMetadata MCP

**Date:** December 23, 2025
**Goal:** Support OAuth 2.0 authentication for ALL OpenMetadata connectors and identity providers, not just Snowflake/Databricks

---

## Executive Summary

The current MCP OAuth implementation supports Snowflake and Databricks, but OpenMetadata connects to **100+ data sources** and integrates with **multiple identity providers**. This document outlines the architecture for **universal OAuth support** across all connectors and IDPs.

---

## Current State vs. Target State

### ✅ Current Implementation (Completed Today)

**Supported Connectors:**
- ✅ Snowflake (fully implemented)
- ✅ Databricks (fully implemented)

**Features Implemented:**
- ✅ PKCE verification (OAuth 2.1 security)
- ✅ CORS origin validation (production security)
- ✅ SecurityContext integration (user attribution)
- ✅ Scope-based authorization (fine-grained access)
- ✅ Database persistence schema (OAuth tables)
- ✅ Automatic token refresh (server-side)

### 🎯 Target State (Universal Support)

**Database Connectors:**
- All SQL databases (PostgreSQL, MySQL, Oracle, SQL Server, etc.)
- Cloud data warehouses (Snowflake, Databricks, BigQuery, Redshift, Azure Synapse)
- NoSQL databases (MongoDB, Cassandra, DynamoDB, Elasticsearch)
- Analytics platforms (Looker, Tableau, PowerBI, Metabase)

**Identity Providers:**
- Enterprise SSO (Okta, Azure AD, Google Workspace, Auth0)
- SAML 2.0 providers
- OpenID Connect providers
- Custom OAuth 2.0 servers

**Total Coverage:** 100+ data sources × Multiple IDPs = Scalable architecture

---

## Architecture Principles

### 1. **Plugin-Based Connector Support**

Instead of hardcoding each connector, use a **plugin registry pattern**:

```java
public interface OAuthConnectorPlugin {
    String getConnectorType(); // "Snowflake", "Databricks", "BigQuery", etc.

    // Extract OAuth credentials from connection config
    OAuthCredentials extractCredentials(Object config);

    // Set OAuth credentials on connection config
    void setCredentials(Object config, OAuthCredentials oauth);

    // Build token endpoint URL
    String buildTokenEndpoint(Object config, OAuthCredentials oauth);

    // Connector-specific OAuth scopes
    List<String> getDefaultScopes();

    // Validate OAuth configuration
    boolean isOAuthConfigured(Object config);
}
```

**Benefits:**
- ✅ Add new connectors without modifying core code
- ✅ Each connector owns its OAuth logic
- ✅ Easy to test individually
- ✅ Clear separation of concerns

### 2. **Universal IDP Integration**

Support multiple authentication flows:

```
┌─────────────────────────────────────────────────────────────┐
│                  MCP OAuth Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐         ┌──────────────────┐          │
│  │ MCP Client      │────────▶│ OAuth Provider   │          │
│  │ (Claude/IDEs)   │         │ (Router)         │          │
│  └─────────────────┘         └────────┬─────────┘          │
│                                        │                     │
│                              ┌─────────┴─────────┐          │
│                              │                   │           │
│                    ┌─────────▼────────┐ ┌───────▼────────┐ │
│                    │ Connector OAuth  │ │ OpenMetadata   │ │
│                    │ (Data Sources)   │ │ SSO (IDPs)     │ │
│                    └─────────┬────────┘ └───────┬────────┘ │
│                              │                   │           │
│              ┌───────────────┼───────────┐      │          │
│              │               │           │       │          │
│        ┌─────▼─────┐  ┌─────▼─────┐ ┌──▼───┐ ┌▼────┐    │
│        │ Snowflake │  │ Databricks│ │BigQry│ │Okta │    │
│        │  Plugin   │  │  Plugin   │ │Plugin│ │ SSO │    │
│        └───────────┘  └───────────┘ └──────┘ └─────┘    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 3. **Two-Tier OAuth System**

**Tier 1: Connector OAuth** (Data Access)
- Purpose: Access data in external systems (Snowflake, Databricks, etc.)
- Flow: Redirect-free, stored credentials, automatic refresh
- Users: Administrators configure once per connector
- Current Status: ✅ Implemented for Snowflake/Databricks

**Tier 2: OpenMetadata SSO** (User Authentication)
- Purpose: Authenticate users via corporate identity providers
- Flow: Browser redirect, user consent, OpenID Connect
- Users: End users authenticate with company credentials
- Current Status: ❌ Not implemented

---

## Implementation Roadmap

### Phase 1: Connector Plugin System (1 week)

#### 1.1 Create Plugin Interface
**File:** `OAuthConnectorPlugin.java`
```java
package org.openmetadata.mcp.server.auth.plugins;

public interface OAuthConnectorPlugin {
    String getConnectorType();
    OAuthCredentials extractCredentials(Object config);
    void setCredentials(Object config, OAuthCredentials oauth);
    String buildTokenEndpoint(Object config, OAuthCredentials oauth);
    List<String> getDefaultScopes();
    boolean isOAuthConfigured(Object config);

    // Optional: Custom token refresh logic
    default OAuthCredentials refreshToken(
        OAuthCredentials oauth, Object config) throws Exception {
        return null; // Use default refresh logic
    }
}
```

#### 1.2 Create Plugin Registry
**File:** `OAuthConnectorPluginRegistry.java`
```java
public class OAuthConnectorPluginRegistry {
    private static final Map<String, OAuthConnectorPlugin> plugins = new ConcurrentHashMap<>();

    public static void registerPlugin(OAuthConnectorPlugin plugin) {
        plugins.put(plugin.getConnectorType(), plugin);
    }

    public static OAuthConnectorPlugin getPlugin(String connectorType) {
        return plugins.get(connectorType);
    }

    public static OAuthConnectorPlugin getPluginForConfig(Object config) {
        // Auto-detect connector type from config class
    }
}
```

#### 1.3 Refactor Existing Connectors
Convert Snowflake and Databricks to plugins:

**SnowflakeOAuthPlugin.java:**
```java
public class SnowflakeOAuthPlugin implements OAuthConnectorPlugin {
    @Override
    public String getConnectorType() {
        return "Snowflake";
    }

    @Override
    public OAuthCredentials extractCredentials(Object config) {
        return ((SnowflakeConnection) config).getOauth();
    }

    @Override
    public void setCredentials(Object config, OAuthCredentials oauth) {
        ((SnowflakeConnection) config).setOauth(oauth);
    }

    @Override
    public String buildTokenEndpoint(Object config, OAuthCredentials oauth) {
        SnowflakeConnection sf = (SnowflakeConnection) config;
        return "https://" + sf.getAccount() + ".snowflakecomputing.com/oauth/token-request";
    }

    @Override
    public List<String> getDefaultScopes() {
        return Arrays.asList("refresh_token", "session:role:ANY");
    }
}
```

**DatabricksOAuthPlugin.java:**
```java
public class DatabricksOAuthPlugin implements OAuthConnectorPlugin {
    @Override
    public String getConnectorType() {
        return "Databricks";
    }

    @Override
    public String buildTokenEndpoint(Object config, OAuthCredentials oauth) {
        DatabricksConnection db = (DatabricksConnection) config;
        String hostPort = db.getHostPort().replaceFirst("^https?://", "");
        return "https://" + hostPort + "/oidc/v1/token";
    }

    @Override
    public List<String> getDefaultScopes() {
        return Arrays.asList("all-apis", "sql");
    }
}
```

#### 1.4 Update ConnectorOAuthProvider
Replace hardcoded if/else with plugin lookup:

```java
private OAuthCredentials extractOAuthCredentialsFromConfig(Object config) {
    OAuthConnectorPlugin plugin = OAuthConnectorPluginRegistry.getPluginForConfig(config);
    if (plugin != null) {
        return plugin.extractCredentials(config);
    }
    return null;
}

private String buildTokenEndpoint(Object config, OAuthCredentials oauth) {
    if (oauth.getTokenEndpoint() != null) {
        return oauth.getTokenEndpoint().toString();
    }

    OAuthConnectorPlugin plugin = OAuthConnectorPluginRegistry.getPluginForConfig(config);
    if (plugin != null) {
        return plugin.buildTokenEndpoint(config, oauth);
    }

    throw new IllegalArgumentException("No OAuth plugin found for connector type");
}
```

### Phase 2: Add High-Priority Connectors (2 weeks)

#### 2.1 Cloud Data Warehouses
- **BigQuery** (Google Cloud)
  - Token endpoint: `https://oauth2.googleapis.com/token`
  - Scopes: `https://www.googleapis.com/auth/bigquery`
  - Auth type: Service Account JSON key

- **Redshift** (AWS)
  - Token endpoint: Regional AWS STS
  - Scopes: AWS IAM roles
  - Auth type: IAM role credentials

- **Azure Synapse** (Microsoft)
  - Token endpoint: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
  - Scopes: `https://database.windows.net/.default`
  - Auth type: Azure AD Service Principal

#### 2.2 Database Connectors
- **PostgreSQL** (via OAuth proxy)
- **MySQL** (via OAuth proxy)
- **Oracle** (OAuth 2.0 support in 12c+)
- **MongoDB Atlas** (API keys or OAuth)

#### 2.3 Analytics Platforms
- **Looker**
  - Token endpoint: `https://<instance>.looker.com/api/4.0/login`
  - API3 credentials or OAuth

- **Tableau**
  - Token endpoint: Tableau Server OAuth
  - Connected Apps

- **Power BI**
  - Token endpoint: Azure AD
  - Service Principal

### Phase 3: OpenMetadata SSO Integration (2 weeks)

#### 3.1 Complete OpenMetadataAuthProvider

**Current Issue:** Throws "not_implemented" exception

**Implementation Plan:**
1. Integrate with existing OpenMetadata SSO configuration
2. Support multiple IDP protocols:
   - OpenID Connect (Okta, Auth0, Google)
   - SAML 2.0 (Azure AD, OneLogin)
   - Custom OAuth 2.0

3. User authentication flow:
```
User → MCP Client → MCP OAuth → OpenMetadata SSO → IDP
                                       ↓
                                 JWT Token
                                       ↓
                                  MCP Client
```

#### 3.2 IDP Configuration Schema

**File:** Create `idpConfiguration.json` schema
```json
{
  "type": "object",
  "properties": {
    "provider": {
      "enum": ["okta", "azure-ad", "google", "auth0", "custom-oidc", "saml"]
    },
    "authorizationEndpoint": {"type": "string"},
    "tokenEndpoint": {"type": "string"},
    "userInfoEndpoint": {"type": "string"},
    "clientId": {"type": "string"},
    "clientSecret": {"type": "string", "format": "password"},
    "scopes": {"type": "array", "items": {"type": "string"}},
    "redirectUri": {"type": "string"}
  }
}
```

#### 3.3 SSO Provider Plugins

Similar to connector plugins, create IDP plugins:

```java
public interface SSOProviderPlugin {
    String getProviderName();
    String getAuthorizationUrl(IDPConfiguration config, String state);
    OAuthToken exchangeCode(String code, IDPConfiguration config);
    UserInfo getUserInfo(String accessToken, IDPConfiguration config);
}
```

**Implementations:**
- `OktaSSOPlugin`
- `AzureADSSOPlugin`
- `GoogleSSOPlugin`
- `Auth0SSOPlugin`
- `GenericOIDCPlugin` (for any OIDC-compliant IDP)
- `SAMLSSOPlugin`

### Phase 4: Universal Configuration UI (1 week)

#### 4.1 Connector OAuth Setup UI
- Auto-detect which connectors support OAuth
- Show connector-specific setup instructions
- Test OAuth connection before saving
- Display token status and expiry

#### 4.2 IDP Configuration UI
- Configure OpenMetadata SSO settings
- Support multiple IDPs simultaneously
- User group mapping from IDP to OpenMetadata roles

---

## Database Schema Extensions

### Additional Table: `oauth_connector_plugins`

```sql
CREATE TABLE oauth_connector_plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_type VARCHAR(255) UNIQUE NOT NULL,
    plugin_class VARCHAR(500) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    default_scopes JSONB,
    configuration JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_oauth_connector_plugins_type ON oauth_connector_plugins(connector_type);
CREATE INDEX idx_oauth_connector_plugins_enabled ON oauth_connector_plugins(enabled);
```

### Additional Table: `oauth_idp_configurations`

```sql
CREATE TABLE oauth_idp_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name VARCHAR(255) UNIQUE NOT NULL,
    provider_type VARCHAR(100) NOT NULL, -- okta, azure-ad, google, etc.
    authorization_endpoint TEXT NOT NULL,
    token_endpoint TEXT NOT NULL,
    user_info_endpoint TEXT,
    client_id VARCHAR(500) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    scopes JSONB,
    configuration JSONB, -- provider-specific settings
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_oauth_idp_provider_name ON oauth_idp_configurations(provider_name);
CREATE INDEX idx_oauth_idp_enabled ON oauth_idp_configurations(enabled);
```

---

## Connector OAuth Support Matrix

| Connector | OAuth Support | Token Endpoint Pattern | Priority |
|-----------|---------------|------------------------|----------|
| **Snowflake** | ✅ Implemented | `{account}.snowflakecomputing.com/oauth/token-request` | Done |
| **Databricks** | ✅ Implemented | `{workspace}/oidc/v1/token` | Done |
| **BigQuery** | 🟡 Planned | `oauth2.googleapis.com/token` | High |
| **Redshift** | 🟡 Planned | AWS STS Regional | High |
| **Azure Synapse** | 🟡 Planned | `login.microsoftonline.com/{tenant}/oauth2/v2.0/token` | High |
| **PostgreSQL** | 🟡 Planned | Via OAuth Proxy | Medium |
| **MySQL** | 🟡 Planned | Via OAuth Proxy | Medium |
| **Oracle** | 🟡 Planned | Oracle OAuth 2.0 | Medium |
| **MongoDB Atlas** | 🟡 Planned | Atlas API | Medium |
| **Looker** | 🟡 Planned | `{instance}.looker.com/api/4.0/login` | Medium |
| **Tableau** | 🟡 Planned | Connected Apps | Medium |
| **Power BI** | 🟡 Planned | Azure AD | Medium |
| **Elasticsearch** | 🟡 Planned | Security Tokens API | Low |
| **Cassandra** | ❌ Not Supported | No native OAuth | N/A |

---

## Identity Provider Support Matrix

| IDP | Protocol | Status | Priority |
|-----|----------|--------|----------|
| **Okta** | OIDC | 🟡 Planned | High |
| **Azure AD** | OIDC/SAML | 🟡 Planned | High |
| **Google Workspace** | OIDC | 🟡 Planned | High |
| **Auth0** | OIDC | 🟡 Planned | High |
| **OneLogin** | SAML/OIDC | 🟡 Planned | Medium |
| **Keycloak** | OIDC | 🟡 Planned | Medium |
| **AWS Cognito** | OIDC | 🟡 Planned | Medium |
| **Ping Identity** | SAML/OIDC | 🟡 Planned | Low |
| **Custom OIDC** | OIDC | 🟡 Planned | Medium |
| **LDAP** | N/A | ❌ Out of Scope | N/A |

---

## Testing Strategy

### 1. Plugin Unit Tests
Each connector plugin needs:
- Credential extraction tests
- Token endpoint building tests
- Scope validation tests
- Configuration validation tests

### 2. Integration Tests
- End-to-end OAuth flow with test IDP (Mockito/WireMock)
- Token refresh simulation
- Multi-connector scenarios
- SSO + Connector OAuth combination

### 3. Compatibility Matrix Testing
Test matrix: 5 connectors × 3 IDPs = 15 test scenarios
- Automated CI/CD testing
- Mock IDP responses
- Test token expiry and refresh

---

## Migration Path from Current Implementation

### Step 1: Extract Existing Code to Plugins
- Move Snowflake logic → SnowflakeOAuthPlugin
- Move Databricks logic → DatabricksOAuthPlugin
- No behavior change, just refactoring

### Step 2: Add Plugin Registry
- Register existing plugins
- Update ConnectorOAuthProvider to use registry
- Verify existing flows still work

### Step 3: Add New Connector Plugins
- Implement one connector at a time
- Test thoroughly before next
- Document setup process

### Step 4: Implement SSO Integration
- Complete OpenMetadataAuthProvider
- Add first IDP (Okta)
- Expand to other IDPs

---

## Success Metrics

**Phase 1 Success:**
- ✅ Plugin system supports 10+ connectors
- ✅ No code changes needed to add new connectors
- ✅ All existing tests pass

**Phase 2 Success:**
- ✅ Support top 10 data warehouses/databases
- ✅ 80%+ of OpenMetadata users can use OAuth

**Phase 3 Success:**
- ✅ SSO integration works with top 3 IDPs
- ✅ Users can authenticate via corporate SSO
- ✅ Proper role mapping from IDP to OpenMetadata

**Overall Success:**
- ✅ Universal OAuth architecture
- ✅ Scalable to 100+ connectors
- ✅ Support for any OIDC/SAML IDP
- ✅ Production-ready security
- ✅ Comprehensive documentation

---

## Next Immediate Steps

1. **Create Plugin Interface** (2 days)
   - Define OAuthConnectorPlugin interface
   - Create OAuthConnectorPluginRegistry
   - Write plugin discovery mechanism

2. **Refactor Snowflake/Databricks** (2 days)
   - Convert to plugin implementations
   - Update ConnectorOAuthProvider
   - Verify backward compatibility

3. **Add BigQuery Plugin** (3 days)
   - Implement BigQueryOAuthPlugin
   - Test with real Google Cloud OAuth
   - Document setup process

4. **Add Redshift Plugin** (3 days)
   - Implement RedshiftOAuthPlugin
   - Handle AWS IAM complexity
   - Document setup process

5. **Start SSO Integration** (1 week)
   - Design IDP plugin interface
   - Implement OktaSSOPlugin
   - Test user authentication flow

---

## Documentation Requirements

For each connector plugin, provide:
1. **Setup Guide** - How to configure OAuth in the data source
2. **Scopes Reference** - Required OAuth scopes explained
3. **Token Lifecycle** - Expiry times, refresh behavior
4. **Troubleshooting** - Common issues and solutions
5. **API Reference** - Plugin interface implementation

For each IDP integration, provide:
1. **Configuration Guide** - How to register OpenMetadata as OAuth app
2. **User Mapping** - How to map IDP groups to OM roles
3. **SSO Flow** - User authentication sequence
4. **Fallback Auth** - What happens if IDP is down
5. **Security Notes** - Best practices

---

**Remember:** The goal is **universal support**, not just Snowflake/Databricks. Every design decision should enable adding new connectors and IDPs with minimal code changes.

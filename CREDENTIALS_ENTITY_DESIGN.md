# RFC: Credentials Entity with OAuth Support

## Summary

This RFC proposes extracting credentials from service connections into a standalone **Credentials** entity that can be managed centrally, reused across services, and support OAuth workflows with per-user token management.

## Motivation

### Current Problems

1. **Tight Coupling**: Credentials are embedded directly in connection schemas, making them non-reusable
2. **Duplication**: Same credentials must be configured multiple times across different services  
3. **Limited OAuth Support**: No framework for per-user OAuth tokens or token refresh workflows
4. **Management Complexity**: Credentials scattered across connection types with no central management
5. **Security Concerns**: No standardized approach for OAuth token lifecycle management

### Goals

- Enable credential reusability across multiple services
- Provide centralized credential management in Settings
- Support OAuth 2.0 workflows with per-user token management
- Maintain backward compatibility with existing connections
- Leverage existing SecretsManager infrastructure for encryption

## Detailed Design

### 1. Credentials Entity Schema

**Location**: `openmetadata-spec/src/main/resources/json/schema/entity/credentials.json`

```json
{
  "$id": "https://open-metadata.org/schema/entity/credentials.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Credentials",
  "description": "Reusable credentials entity for authenticating to external services",
  "type": "object",
  "javaType": "org.openmetadata.schema.entity.Credentials",
  "javaInterfaces": ["org.openmetadata.schema.EntityInterface"],
  "definitions": {
    "credentialType": {
      "type": "string",
      "enum": [
        "BasicAuth",
        "ApiToken",
        "ApiKeyAuth",
        "OAuth2ClientCredentials",
        "OAuth2AzureAD", 
        "PersonalAccessToken",
        "AWSCredentials",
        "AzureServicePrincipal",
        "GCPCredentials",
        "CertificateAuth",
        "SaslAuth",
        "PrivateKeyAuth",
        "GitToken",
        "GitHubAuth",
        "GitLabAuth",
        "BitbucketAuth",
        "KubernetesAuth",
        "CustomAuth"
      ]
    },
    "oAuthConfig": {
      "type": "object", 
      "properties": {
        "authorizationUrl": {"type": "string", "format": "uri"},
        "tokenUrl": {"type": "string", "format": "uri"},
        "clientId": {"type": "string"},
        "clientSecret": {"type": "string", "format": "password"},
        "scopes": {"type": "array", "items": {"type": "string"}},
        "redirectUri": {"type": "string", "format": "uri"},
        "supportRefreshToken": {"type": "boolean", "default": true},
        "tokenExpiration": {"type": "integer", "description": "Token expiration in seconds"}
      },
      "required": ["authorizationUrl", "tokenUrl", "clientId", "clientSecret"]
    },
    "certificateAuth": {
      "type": "object",
      "properties": {
        "certificateFile": {"type": "string", "description": "Path to certificate file"},
        "certificateValue": {"type": "string", "description": "Certificate content"},
        "privateKeyFile": {"type": "string", "description": "Path to private key file"},
        "privateKeyValue": {"type": "string", "format": "password", "description": "Private key content"},
        "privateKeyPassphrase": {"type": "string", "format": "password", "description": "Private key passphrase"},
        "trustStoreFile": {"type": "string", "description": "Path to trust store file"},
        "trustStorePassword": {"type": "string", "format": "password", "description": "Trust store password"}
      }
    },
    "saslAuth": {
      "type": "object",
      "properties": {
        "username": {"type": "string"},
        "password": {"type": "string", "format": "password"},
        "mechanism": {
          "type": "string",
          "enum": ["PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512", "GSSAPI", "OAUTHBEARER"],
          "default": "PLAIN"
        },
        "securityProtocol": {
          "type": "string", 
          "enum": ["PLAINTEXT", "SSL", "SASL_PLAINTEXT", "SASL_SSL"],
          "default": "SASL_SSL"
        }
      },
      "required": ["username", "password", "mechanism"]
    },
    "privateKeyAuth": {
      "type": "object",
      "properties": {
        "username": {"type": "string"},
        "privateKey": {"type": "string", "format": "password", "description": "Private key content"},
        "privateKeyFile": {"type": "string", "description": "Path to private key file"},
        "privateKeyPassphrase": {"type": "string", "format": "password", "description": "Private key passphrase"}
      },
      "required": ["username"]
    }
  },
  "properties": {
    "id": {"$ref": "../type/basic.json#/definitions/uuid"},
    "name": {"$ref": "../type/basic.json#/definitions/entityName"},
    "fullyQualifiedName": {"$ref": "../type/basic.json#/definitions/fullyQualifiedEntityName"},
    "displayName": {"type": "string"},
    "description": {"$ref": "../type/basic.json#/definitions/markdown"},
    "credentialType": {"$ref": "#/definitions/credentialType"},
    "serviceTypes": {
      "type": "array",
      "items": {"$ref": "./services/serviceType.json"},
      "description": "Service types this credential can be used with"
    },
    "credentialConfig": {
      "description": "Credential configuration based on type",
      "oneOf": [
        {"$ref": "../security/credentials/basicAuth.json"},
        {"$ref": "../security/credentials/accessTokenAuth.json"},
        {"$ref": "../security/credentials/apiAccessTokenAuth.json"},
        {"$ref": "../security/credentials/awsCredentials.json"},
        {"$ref": "../security/credentials/azureCredentials.json"},
        {"$ref": "../security/credentials/gcpCredentials.json"},
        {"$ref": "../security/credentials/githubCredentials.json"},
        {"$ref": "../security/credentials/gitlabCredentials.json"},
        {"$ref": "../security/credentials/bitbucketCredentials.json"},
        {"$ref": "../security/credentials/kubernetesCredentials.json"},
        {"$ref": "#/definitions/oAuthConfig"},
        {"$ref": "#/definitions/certificateAuth"},
        {"$ref": "#/definitions/saslAuth"},
        {"$ref": "#/definitions/privateKeyAuth"}
      ]
    },
    "isOAuth": {"type": "boolean", "default": false},
    "requiresUserAuthentication": {
      "type": "boolean", 
      "default": false,
      "description": "Whether this credential requires individual user authentication (OAuth)"
    },
    "tags": {"$ref": "../type/tagLabel.json#/definitions/tagLabels"},
    "owner": {"$ref": "../type/entityReference.json"},
    "createdBy": {"type": "string"},
    "updatedBy": {"type": "string"},
    "createdAt": {"$ref": "../type/basic.json#/definitions/timestamp"},
    "updatedAt": {"$ref": "../type/basic.json#/definitions/timestamp"}
  },
  "required": ["name", "credentialType", "credentialConfig"],
  "additionalProperties": false
}
```

### 2. OAuth Token Management

#### OAuth Token Entity Schema

**Location**: `openmetadata-spec/src/main/resources/json/schema/entity/oAuthToken.json`

```json
{
  "$id": "https://open-metadata.org/schema/entity/oAuthToken.json",
  "title": "OAuth Token",
  "description": "User-specific OAuth tokens for credentials",
  "type": "object",
  "javaType": "org.openmetadata.schema.entity.OAuthToken",
  "properties": {
    "id": {"$ref": "../type/basic.json#/definitions/uuid"},
    "userId": {"$ref": "../type/basic.json#/definitions/uuid"},
    "credentialsId": {"$ref": "../type/basic.json#/definitions/uuid"},
    "accessToken": {"type": "string", "format": "password"},
    "refreshToken": {"type": "string", "format": "password"},
    "tokenType": {"type": "string", "default": "Bearer"},
    "expiresAt": {"$ref": "../type/basic.json#/definitions/timestamp"},
    "scopes": {"type": "array", "items": {"type": "string"}},
    "isActive": {"type": "boolean", "default": true},
    "createdAt": {"$ref": "../type/basic.json#/definitions/timestamp"},
    "updatedAt": {"$ref": "../type/basic.json#/definitions/timestamp"}
  },
  "required": ["userId", "credentialsId", "accessToken"]
}
```

#### Backend OAuth Service Architecture

```java
// OAuth Service Interface
public interface OAuthService {
    String generateAuthorizationUrl(UUID credentialsId, String state);
    OAuthToken handleCallback(String code, String state, UUID userId);
    OAuthToken refreshToken(UUID tokenId);
    boolean validateToken(UUID tokenId);
    void revokeToken(UUID tokenId);
    Optional<OAuthToken> getUserToken(UUID userId, UUID credentialsId);
}

// Token Repository
@Repository
public interface OAuthTokenRepository extends EntityRepository<OAuthToken> {
    Optional<OAuthToken> findByUserIdAndCredentialsId(UUID userId, UUID credentialsId);
    List<OAuthToken> findExpiredTokens();
    List<OAuthToken> findTokensByCredentialsId(UUID credentialsId);
    void deleteByCredentialsId(UUID credentialsId);
}

// OAuth State Management
public class OAuthState {
    private UUID userId;
    private UUID credentialsId; 
    private String returnUrl;
    private long timestamp;
    
    // JWT-signed state parameter for security
    public String toSignedToken(String secret) { /* JWT implementation */ }
    public static OAuthState fromSignedToken(String token, String secret) { /* JWT verification */ }
}
```

### 3. Updated Connection Schemas

All connection schemas will be updated to support credential references:

```json
{
  "title": "BigQueryConnection", 
  "properties": {
    "type": {"$ref": "#/definitions/bigqueryType"},
    "scheme": {"$ref": "#/definitions/bigqueryScheme"},
    "hostPort": {"type": "string"},
    "credentialsRef": {
      "title": "Credentials Reference",
      "description": "Reference to stored credentials entity",
      "$ref": "../../type/entityReference.json"
    },
    "legacyCredentials": {
      "title": "Legacy Credentials (Deprecated)",
      "description": "Direct credentials - use credentialsRef instead",
      "$ref": "../../../../security/credentials/gcpCredentials.json",
      "deprecated": true
    }
  }
}
```

### 4. OAuth User Authentication Flow

#### Flow Description:

1. **Credential Creation**: Admin creates OAuth credential in Settings with client ID/secret
2. **Service Configuration**: User selects OAuth credential when configuring service
3. **User Authentication**: System detects OAuth credential needs user authentication
4. **Authorization Redirect**: User redirected to `/api/v1/oauth/authorize/{credentialsId}`
5. **Provider Redirect**: Backend redirects to OAuth provider (e.g., Google) with signed state
6. **User Consent**: User grants permissions on OAuth provider
7. **Callback Handling**: Provider redirects to `/api/v1/oauth/callback` with authorization code
8. **Token Exchange**: Backend exchanges code for access/refresh tokens
9. **Token Storage**: User-specific token stored in database (encrypted via SecretsManager)
10. **Service Usage**: When service runs operations, it retrieves user's token automatically

#### API Endpoints:

```java
@Path("/v1/oauth")
public class OAuthResource {
    
    @GET
    @Path("/authorize/{credentialsId}")
    public Response authorize(
        @PathParam("credentialsId") String credentialsId,
        @QueryParam("returnUrl") String returnUrl,
        @Context SecurityContext securityContext) {
        // Generate signed state and redirect to OAuth provider
    }
    
    @GET 
    @Path("/callback")
    public Response callback(
        @QueryParam("code") String code, 
        @QueryParam("state") String state,
        @QueryParam("error") String error) {
        // Handle OAuth callback and token exchange
    }
    
    @GET
    @Path("/status/{credentialsId}")
    public Response getAuthStatus(
        @PathParam("credentialsId") String credentialsId,
        @Context SecurityContext securityContext) {
        // Check if user has valid token for this credential
    }
}
```

### 5. API Design

#### Credentials Management APIs:

```java
@Path("/v1/credentials")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CredentialsResource extends EntityResource<Credentials, CredentialsRepository> {
    
    @POST
    public Response createCredentials(
        @Valid CreateCredentials request,
        @Context UriInfo uriInfo,
        @Context SecurityContext securityContext) {
        // Create new credentials entity
    }
    
    @GET
    public ResultList<Credentials> listCredentials(
        @Context UriInfo uriInfo,
        @Context SecurityContext securityContext,
        @QueryParam("serviceType") String serviceType,
        @QueryParam("credentialType") String credentialType) {
        // List credentials with filtering
    }
    
    @GET 
    @Path("/{id}")
    public Credentials getCredentials(
        @PathParam("id") String id,
        @Context UriInfo uriInfo,
        @Context SecurityContext securityContext) {
        // Get specific credential (masked sensitive data)
    }
    
    @PUT
    @Path("/{id}")  
    public Response updateCredentials(
        @PathParam("id") String id,
        @Valid Credentials credentials,
        @Context UriInfo uriInfo,
        @Context SecurityContext securityContext) {
        // Update credentials
    }
    
    @DELETE
    @Path("/{id}")
    public Response deleteCredentials(
        @PathParam("id") String id,
        @Context SecurityContext securityContext) {
        // Delete credentials and associated tokens
    }
    
    @POST
    @Path("/{id}/test")
    public Response testCredentials(
        @PathParam("id") String id,
        @Context SecurityContext securityContext) {
        // Test credential connectivity
    }
}

@Path("/v1/oauth-tokens")
public class OAuthTokenResource {
    
    @GET
    public ResultList<OAuthTokenSummary> getUserTokens(
        @Context SecurityContext securityContext) {
        // Get user's OAuth tokens (without sensitive data)
    }
    
    @DELETE
    @Path("/{tokenId}")
    public Response revokeToken(
        @PathParam("tokenId") String tokenId,
        @Context SecurityContext securityContext) {
        // Revoke specific token
    }
    
    @POST
    @Path("/{tokenId}/refresh")
    public Response refreshToken(
        @PathParam("tokenId") String tokenId,
        @Context SecurityContext securityContext) {
        // Manually refresh token
    }
}
```

### 6. Database Schema Changes

#### New Tables:

```sql
-- Credentials table
CREATE TABLE credentials_entity (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    fqn VARCHAR(512) NOT NULL UNIQUE,
    display_name VARCHAR(256),
    description TEXT,
    credential_type VARCHAR(50) NOT NULL,
    service_types JSON,
    credential_config JSON NOT NULL,
    is_oauth BOOLEAN DEFAULT FALSE,
    requires_user_authentication BOOLEAN DEFAULT FALSE,
    tags JSON,
    owner_id VARCHAR(36),
    created_by VARCHAR(256) NOT NULL,
    updated_by VARCHAR(256) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE,
    INDEX idx_credentials_name (name),
    INDEX idx_credentials_type (credential_type),
    INDEX idx_credentials_oauth (is_oauth),
    FOREIGN KEY (owner_id) REFERENCES user_entity(id)
);

-- OAuth tokens table  
CREATE TABLE oauth_token_entity (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    credentials_id VARCHAR(36) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMP,
    scopes JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_credential (user_id, credentials_id),
    INDEX idx_token_expiry (expires_at),
    INDEX idx_token_credentials (credentials_id),
    FOREIGN KEY (user_id) REFERENCES user_entity(id) ON DELETE CASCADE,
    FOREIGN KEY (credentials_id) REFERENCES credentials_entity(id) ON DELETE CASCADE
);
```

### 7. Migration Strategy

#### Phase 1: Parallel Support (Backward Compatibility)
- Deploy new Credentials entity alongside existing connection schemas
- Support both `credentialsRef` and legacy embedded credentials in connections
- No breaking changes to existing services

#### Phase 2: Migration Tools
```bash
# CLI migration commands
openmetadata-cli credentials migrate --dry-run
openmetadata-cli credentials migrate --service-type database
openmetadata-cli credentials migrate --service-id <uuid>
openmetadata-cli credentials list-duplicates
```

#### Phase 3: Gradual Deprecation
- Mark embedded credentials as deprecated in schemas
- Add UI warnings for legacy credential usage
- Provide migration prompts in service configuration
- Eventually remove legacy support (major version)

### 8. Security Considerations

1. **Encryption**: All sensitive credential data encrypted using existing SecretsManager
2. **Access Control**: Role-based permissions for credential management (Admin, Owner, Viewer)
3. **OAuth State Security**: JWT-signed state parameters prevent CSRF attacks
4. **Token Storage**: OAuth tokens encrypted at rest and in transit
5. **Audit Logging**: All credential operations and token usage logged
6. **Token Rotation**: Automatic refresh token handling with graceful fallback
7. **Scope Validation**: OAuth scopes validated against service requirements

### 9. Frontend Implementation

#### Settings UI for Credentials Management:
- Create/Edit/Delete credentials
- Test credential connectivity  
- View OAuth authentication status
- Manage user OAuth tokens

#### Service Configuration Updates:
- Dropdown to select existing credentials
- OAuth authentication flow integration
- Migration prompts for legacy credentials

#### OAuth Flow Handling:
```typescript
// OAuth authentication flow
async function authenticateOAuthCredential(credentialsId: string) {
  // Check if user already has valid token
  const status = await checkOAuthStatus(credentialsId);
  
  if (!status.isAuthenticated) {
    // Redirect to OAuth authorization
    window.location.href = `/api/v1/oauth/authorize/${credentialsId}?returnUrl=${encodeURIComponent(window.location.href)}`;
  }
  
  return status;
}
```

### 10. Comprehensive Connection Type → Credential Type Mapping

Based on analysis of all OpenMetadata connection schemas, here's the complete mapping:

#### Database Connections

| Connection Type | Compatible Credential Types | Primary Use Case |
|-----------------|----------------------------|------------------|
| **BigQuery** | `GCPCredentials` | GCP Service Account, ADC, External Account |
| **Athena** | `AWSCredentials` | AWS Access Keys, IAM Roles, Session Tokens |
| **Snowflake** | `BasicAuth`, `PrivateKeyAuth` | Username/Password or Private Key Authentication |
| **AzureSQL** | `AzureServicePrincipal` | Azure AD Service Principal |
| **Databricks** | `PersonalAccessToken`, `OAuth2ClientCredentials`, `AzureServicePrincipal` | PAT, OAuth2, or Azure AD |
| **UnityCatalog** | `PersonalAccessToken`, `OAuth2ClientCredentials`, `AzureServicePrincipal` | Same as Databricks |
| **Redshift** | `BasicAuth`, `AWSCredentials` | Username/Password or IAM Authentication |
| **MySQL/PostgreSQL** | `BasicAuth` | Traditional username/password |
| **Oracle/MSSQL** | `BasicAuth` | Traditional username/password |
| **MongoDB** | `BasicAuth` | Username/password with connection string |
| **Cassandra** | `BasicAuth` | Username/password + optional cloud config |
| **DynamoDB** | `AWSCredentials` | AWS Access Keys, IAM Roles |
| **Clickhouse/Doris** | `BasicAuth` | Username/password |
| **Iceberg** | Multiple based on catalog (AWS/GCP/Azure) | Depends on catalog backend |
| **Glue** | `AWSCredentials` | AWS Access Keys, IAM Roles |

#### Dashboard Connections

| Connection Type | Compatible Credential Types | Primary Use Case |
|-----------------|----------------------------|------------------|
| **PowerBI** | `AzureServicePrincipal` | Azure AD Service Principal |
| **Tableau** | `BasicAuth`, `PersonalAccessToken` | Username/Password or PAT |
| **Looker** | `OAuth2ClientCredentials`, `GitHubAuth`, `GitLabAuth` | OAuth + Git credentials for .lkml files |
| **MicroStrategy** | `BasicAuth` | Username/password with login mode |
| **QuickSight** | `AWSCredentials` | AWS Access Keys, IAM Roles |
| **Grafana** | `BasicAuth` | Username/password |
| **Superset** | `BasicAuth` | Username/password |
| **ThoughtSpot** | `BasicAuth`, `ApiToken` | Username/Password or API token |
| **Metabase** | `BasicAuth` | Username/password |

#### Pipeline Connections

| Connection Type | Compatible Credential Types | Primary Use Case |
|-----------------|----------------------------|------------------|
| **Airflow** | `BasicAuth` | Database connection (MySQL/PostgreSQL) |
| **Dagster** | `BasicAuth`, `ApiToken` | GraphQL endpoint authentication |
| **Azure Data Factory** | `AzureServicePrincipal` | Azure AD Service Principal |
| **Fivetran** | `ApiKeyAuth` | API key authentication |
| **Airbyte** | `BasicAuth` | Username/password |
| **dbt Cloud** | `ApiToken` | Service token |
| **AWS Glue Pipeline** | `AWSCredentials` | AWS Access Keys, IAM Roles |
| **NiFi** | `BasicAuth`, `CertificateAuth` | Username/Password or Client Certificates |
| **Kafka Connect** | `SaslAuth`, `CertificateAuth` | SASL or SSL certificate authentication |

#### Messaging Connections

| Connection Type | Compatible Credential Types | Primary Use Case |
|-----------------|----------------------------|------------------|
| **Kafka** | `SaslAuth`, `CertificateAuth` | SASL username/password + SSL certificates |
| **RedPanda** | `SaslAuth`, `CertificateAuth` | Similar to Kafka |
| **Kinesis** | `AWSCredentials` | AWS Access Keys, IAM Roles |
| **Pulsar** | `ApiToken` | Token-based authentication |

#### Storage Connections

| Connection Type | Compatible Credential Types | Primary Use Case |
|-----------------|----------------------------|------------------|
| **S3** | `AWSCredentials` | AWS Access Keys, IAM Roles |
| **Google Cloud Storage** | `GCPCredentials` | GCP Service Account |
| **Azure Data Lake** | `AzureServicePrincipal` | Azure AD Service Principal |

#### Search Connections

| Connection Type | Compatible Credential Types | Primary Use Case |
|-----------------|----------------------------|------------------|
| **Elasticsearch** | `BasicAuth`, `ApiKeyAuth` | Username/Password or API Key |
| **OpenSearch** | `BasicAuth`, `AWSCredentials` | Basic Auth or AWS IAM |

#### Metadata Connections

| Connection Type | Compatible Credential Types | Primary Use Case |
|-----------------|----------------------------|------------------|
| **Alation** | `BasicAuth`, `ApiToken` | Username/Password or API Access Token |
| **Apache Atlas** | `BasicAuth` | Username/password |
| **Amundsen** | `BasicAuth` | Neo4j username/password |

#### Security Connections

| Connection Type | Compatible Credential Types | Primary Use Case |
|-----------------|----------------------------|------------------|
| **Apache Ranger** | `BasicAuth` | Username/password |

#### Drive/File Connections

| Connection Type | Compatible Credential Types | Primary Use Case |
|-----------------|----------------------------|------------------|
| **Google Drive** | `GCPCredentials` | GCP Service Account |
| **SharePoint** | `AzureServicePrincipal` | Azure AD Service Principal |

#### OAuth-Enabled Services

Services that can support OAuth2 user authentication flows:

**Current OAuth Support:**
- **Databricks**: OAuth2 client credentials flow
- **Looker**: OAuth2 for API access
- **PowerBI**: Azure AD OAuth flows

**Potential OAuth Expansion:**
- **BigQuery**: Google OAuth2 for per-user access
- **Snowflake**: OAuth2 with external OAuth providers
- **Tableau**: Tableau Online OAuth flows
- **GitHub/GitLab**: OAuth Apps for repository access

#### Credential Type Usage Statistics

Based on connection analysis:

| Credential Type | Usage Count | Primary Services |
|-----------------|-------------|------------------|
| `BasicAuth` | 35+ | Traditional databases, legacy systems |
| `AWSCredentials` | 15+ | All AWS services, S3, Athena, Glue, etc. |
| `AzureServicePrincipal` | 10+ | Azure services, PowerBI, Data Factory |
| `GCPCredentials` | 8+ | BigQuery, GCS, Google services |
| `ApiToken` | 12+ | Modern SaaS platforms, APIs |
| `OAuth2ClientCredentials` | 5+ | Databricks, Looker, modern platforms |
| `SaslAuth` | 3+ | Kafka, messaging systems |
| `CertificateAuth` | 2+ | High-security enterprise systems |

### 11. Example Usage Scenarios

#### Scenario A: BigQuery with Service Account (Traditional)
```javascript
// 1. Create service account credential
POST /api/v1/credentials
{
  "name": "BigQuery Production SA",
  "credentialType": "ServiceAccount",
  "serviceTypes": ["BigQuery", "CloudStorage"],
  "credentialConfig": {
    "type": "service_account",
    "project_id": "my-project",
    "private_key": "...",
    "client_email": "service@my-project.iam.gserviceaccount.com"
  }
}

// 2. Use in BigQuery connection
{
  "type": "BigQuery",
  "hostPort": "bigquery.googleapis.com", 
  "credentialsRef": {
    "id": "credential-uuid",
    "type": "credentials"
  }
}
```

#### Scenario B: BigQuery with OAuth (Per-User Tokens)
```javascript
// 1. Admin creates OAuth credential
POST /api/v1/credentials  
{
  "name": "BigQuery OAuth",
  "credentialType": "OAuth2",
  "serviceTypes": ["BigQuery"],
  "isOAuth": true,
  "requiresUserAuthentication": true,
  "credentialConfig": {
    "authorizationUrl": "https://accounts.google.com/o/oauth2/auth",
    "tokenUrl": "https://oauth2.googleapis.com/token",
    "clientId": "123456789.apps.googleusercontent.com",
    "clientSecret": "...",
    "scopes": [
      "https://www.googleapis.com/auth/bigquery",
      "https://www.googleapis.com/auth/cloud-platform"
    ],
    "redirectUri": "https://openmetadata.example.com/api/v1/oauth/callback"
  }
}

// 2. User configures service with OAuth credential
{
  "type": "BigQuery",
  "credentialsRef": {
    "id": "oauth-credential-uuid", 
    "type": "credentials"
  }
}

// 3. When user accesses service:
//    - System checks if user has valid token
//    - If not, redirects to OAuth flow
//    - User grants permissions
//    - Token stored and used for subsequent operations
```

## Benefits

1. **Reusability**: Single credential used across multiple services
2. **Central Management**: All credentials managed from one location
3. **OAuth Support**: Full OAuth 2.0 workflow with per-user tokens
4. **Security**: Leverages existing encryption and secrets management
5. **Flexibility**: Supports both traditional and OAuth authentication
6. **Backward Compatibility**: Gradual migration without breaking changes
7. **User Experience**: Simplified service configuration and credential management

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration complexity | High | Phased rollout with backward compatibility |
| OAuth token management | Medium | Robust refresh token handling and monitoring |
| Security vulnerabilities | High | Security review, encrypted storage, audit logging |
| Performance impact | Low | Efficient token caching and database indexing |
| User adoption | Medium | Clear migration guides and UI improvements |

## Testing Strategy

1. **Unit Tests**: All OAuth service components and credential management
2. **Integration Tests**: End-to-end OAuth flows with mock providers
3. **Security Tests**: Token encryption, state validation, CSRF protection  
4. **Migration Tests**: Legacy credential compatibility and migration tools
5. **Performance Tests**: Token retrieval and refresh under load

## Success Metrics

- [ ] 100% backward compatibility maintained during migration
- [ ] OAuth authentication success rate > 99%
- [ ] Token refresh success rate > 98%
- [ ] Migration of 80%+ existing connections to new credential system
- [ ] Zero security incidents related to token management
- [ ] User satisfaction improvement in credential management workflows

## Implementation Timeline

### Phase 1 (4-6 weeks): Foundation
- [ ] Create credential and OAuth token schemas
- [ ] Implement backend repositories and services
- [ ] Add OAuth endpoints and flow handling
- [ ] Database migrations

### Phase 2 (3-4 weeks): Connection Integration  
- [ ] Update all connection schemas to support credential references
- [ ] Implement credential resolution in service connections
- [ ] Add backward compatibility layer

### Phase 3 (4-5 weeks): Frontend Development
- [ ] Credentials management UI in Settings
- [ ] OAuth authentication flow integration
- [ ] Service configuration updates
- [ ] Migration tools and prompts

### Phase 4 (2-3 weeks): Migration and Documentation
- [ ] Migration utilities and CLI tools
- [ ] Documentation and user guides
- [ ] Security review and testing
- [ ] Deployment and monitoring

## Open Questions

1. Should we support credential inheritance/templates for organization-wide defaults?
2. How should we handle OAuth credential rotation for high-security environments?
3. Should credentials support environment-specific configurations (dev/staging/prod)?
4. What's the appropriate token expiration policy for different service types?
5. Should we support credential sharing between users/teams with fine-grained permissions?

---

**Reviewers**: @openmetadata/backend-team @openmetadata/frontend-team @openmetadata/security-team

**Labels**: `enhancement`, `security`, `oauth`, `credentials`, `breaking-change`
# Bot Impersonation Feature - Design Document

## 1. Overview

### 1.1 Purpose
Enable bots in OpenMetadata to impersonate users when performing actions, ensuring proper attribution of changes to the actual user while maintaining audit trail of bot involvement.

### 1.2 Background
Currently, when bots perform actions (e.g., ingestion pipelines, automation workflows), the `updatedBy` field shows the bot's name. This obscures who actually initiated the action. With impersonation, we can track:
- **updatedBy**: The actual user who initiated the action
- **impersonatedBy**: The bot that executed the action on behalf of the user

### 1.3 Goals
- Allow bots to act on behalf of users with proper authorization
- Maintain complete audit trail showing both user and bot
- Use impersonated user's permissions for authorization checks
- Provide secure, policy-based control over impersonation capabilities
- Display impersonation context in UI and activity feeds

### 1.4 Non-Goals
- User-to-user impersonation (only bot-to-user)
- Impersonation for authentication purposes
- Bypassing authorization checks

## 2. Design Principles

1. **Security First**: Only authorized bots can impersonate, with strict validation
2. **Transparency**: All impersonated actions are clearly visible in audit logs and UI
3. **Permission Inheritance**: Use impersonated user's permissions, not bot's
4. **Backward Compatibility**: Existing entities without impersonation continue to work
5. **Auditability**: Complete trail of who did what via which bot

## 3. Architecture

### 3.1 Token Exchange Flow (On-Demand Impersonation)

Since JWT tokens are pre-generated and bots cannot dynamically create tokens with different `impersonatedUser` claims, we need a **token exchange API** that allows bots to obtain short-lived impersonation tokens on-demand.

```
┌─────────────────────────────────────────────────────────┐
│ Bot Client (Ingestion/Automation)                       │
│                                                          │
│ 1. Bot has standard JWT token:                          │
│    - isBot: true                                         │
│    - sub: "ingestion-bot"                               │
│    - No impersonatedUser claim                          │
└─────────────────┬────────────────────────────────────────┘
                  │
                  │ POST /api/v1/users/impersonate
                  │ Authorization: Bearer <bot-token>
                  │ Body: { "targetUser": "alice" }
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Token Exchange API                                       │
│                                                          │
│ 2. Validates bot token                                  │
│ 3. Checks bot has allowImpersonation=true               │
│ 4. Validates IMPERSONATE permission via policy          │
│ 5. Generates new JWT with:                              │
│    - isBot: true                                         │
│    - sub: "ingestion-bot"                               │
│    - impersonatedUser: "alice"                          │
│    - exp: short TTL (1 hour)                            │
│ 6. Returns impersonation token                          │
└─────────────────┬────────────────────────────────────────┘
                  │
                  │ Response: { "accessToken": "eyJ..." }
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Bot Client                                               │
│                                                          │
│ 7. Uses impersonation token for API calls               │
│ 8. Token includes impersonatedUser claim                │
└─────────────────┬────────────────────────────────────────┘
                  │
                  │ PATCH /api/v1/tables/{id}
                  │ Authorization: Bearer <impersonation-token>
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ JwtFilter (Authentication)                              │
│                                                          │
│ 2. Validates JWT and extracts claims                    │
│ 3. Verifies: isBot == true                              │
│ 4. Checks bot has allowImpersonation flag               │
│ 5. Creates CatalogSecurityContext:                      │
│    - principal: "ingestion-bot"                         │
│    - impersonatedUser: "alice"                          │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ DefaultAuthorizer (Authorization)                       │
│                                                          │
│ 6. Validates impersonation permission:                  │
│    - Check policy: bot can IMPERSONATE user?            │
│    - Can be restricted by team/domain                   │
│ 7. Creates SubjectContext for "alice"                   │
│ 8. Evaluates permissions using alice's context          │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ EntityRepository (Persistence)                          │
│                                                          │
│ 9. Sets entity fields:                                  │
│    - updatedBy: "alice"                                 │
│    - impersonatedBy: "ingestion-bot"                    │
│    - updatedAt: current_timestamp                       │
│ 10. Stores to database                                  │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Database & Search Index                                 │
│                                                          │
│ entity_table:                                            │
│ ┌──────────┬────────┬───────────┬─────────────────┐    │
│ │ id       │ name   │ updatedBy │ impersonatedBy  │    │
│ ├──────────┼────────┼───────────┼─────────────────┤    │
│ │ uuid-123 │ table1 │ alice     │ ingestion-bot   │    │
│ └──────────┴────────┴───────────┴─────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Component Details

#### 3.2.1 JWT Token Structure

**Standard Token (No Impersonation)**
```json
{
  "sub": "alice",
  "email": "alice@example.com",
  "isBot": false,
  "exp": 1234567890
}
```

**Impersonation Token**
```json
{
  "sub": "ingestion-bot",
  "email": "ingestion-bot@example.com",
  "isBot": true,
  "impersonatedUser": "alice",
  "exp": 1234567890
}
```

#### 3.2.2 Security Context

**CatalogSecurityContext Extension**
```java
public record CatalogSecurityContext(
    Principal principal,           // The bot
    String scheme,
    String authenticationScheme,
    Set<String> userRoles,
    boolean isBot,
    String impersonatedUser        // NEW: The actual user
) implements SecurityContext
```

**SubjectContext Enhancement**
```java
public record SubjectContext(
    User user,                     // The impersonated user (or actual user)
    String impersonatedBy          // NEW: The bot name (if impersonating)
)
```

## 4. Authorization Model

### 4.1 Three-Level Security Check

#### Level 1: Bot Capability Flag
```java
// User entity schema
{
  "name": "ingestion-bot",
  "isBot": true,
  "allowImpersonation": true  // NEW: Must be explicitly enabled
}
```

#### Level 2: Impersonation Permission
```java
// New MetadataOperation enum value
public enum MetadataOperation {
    // ... existing operations
    IMPERSONATE  // NEW: Permission to impersonate users
}
```

#### Level 3: Policy-Based Control
```json
{
  "name": "IngestionBotImpersonationPolicy",
  "description": "Allow ingestion bot to impersonate users in Engineering domain",
  "rules": [
    {
      "name": "ImpersonateEngineeringUsers",
      "resources": ["user"],
      "operations": ["Impersonate"],
      "effect": "allow",
      "condition": "hasDomain('Engineering')"
    }
  ]
}
```

### 4.2 Authorization Flow

```java
// Pseudo-code for validation in JwtFilter
void validateImpersonation(String botName, String targetUser) {
    // 1. Bot must have isBot=true (already validated)

    // 2. Check bot has allowImpersonation flag
    User bot = Entity.getEntityByName(USER, botName, "allowImpersonation", NON_DELETED);
    if (!Boolean.TRUE.equals(bot.getAllowImpersonation())) {
        throw new AuthorizationException("Bot not authorized to impersonate");
    }

    // 3. Check policy grants IMPERSONATE permission
    SubjectContext botContext = SubjectContext.getSubjectContext(botName);
    User targetUserEntity = Entity.getEntityByName(USER, targetUser, "", NON_DELETED);
    ResourceContext resourceContext = new ResourceContext(USER, targetUserEntity.getId(), null);
    OperationContext operationContext = new OperationContext(USER, MetadataOperation.IMPERSONATE);

    // This throws AuthorizationException if not permitted
    PolicyEvaluator.hasPermission(botContext, resourceContext, operationContext);

    // 4. Validation passed - impersonation allowed
}
```

### 4.3 Permission Evaluation

When a bot impersonates a user, authorization checks use the **impersonated user's permissions**, not the bot's:

```java
// In DefaultAuthorizer
public static SubjectContext getSubjectContext(SecurityContext securityContext) {
    CatalogSecurityContext catalogContext = (CatalogSecurityContext) securityContext;

    // Use impersonated user if present, otherwise use principal
    String userName = catalogContext.impersonatedUser() != null
        ? catalogContext.impersonatedUser()
        : catalogContext.getUserPrincipal().getName();

    User user = Entity.getEntityByName(Entity.USER, userName, USER_FIELDS, NON_DELETED);

    // Track who is impersonating (if applicable)
    String impersonatedBy = catalogContext.impersonatedUser() != null
        ? catalogContext.getUserPrincipal().getName()
        : null;

    return new SubjectContext(user, impersonatedBy);
}
```

**Example**: If `ingestion-bot` impersonates `alice`:
- CRUD operations are authorized using alice's roles/teams/policies
- If alice lacks permission to update a table, the operation fails
- This prevents privilege escalation

## 5. Data Model Changes

### 5.1 JSON Schema Updates

#### 5.1.1 Base Type Definition
```json
// openmetadata-spec/src/main/resources/json/schema/type/basic.json
{
  "definitions": {
    "impersonatedBy": {
      "description": "Bot user that performed the action on behalf of the actual user.",
      "type": "string"
    }
  }
}
```

#### 5.1.2 Entity Schema Pattern
```json
// Example: openmetadata-spec/src/main/resources/json/schema/entity/data/table.json
{
  "properties": {
    "updatedBy": {
      "description": "User who made the update.",
      "type": "string"
    },
    "impersonatedBy": {
      "description": "Bot that performed the update on behalf of updatedBy user.",
      "$ref": "../../type/basic.json#/definitions/impersonatedBy"
    },
    "updatedAt": {
      "$ref": "../../type/basic.json#/definitions/timestamp"
    }
  }
}
```

#### 5.1.3 User Schema for Bot Capability
```json
// openmetadata-spec/src/main/resources/json/schema/entity/teams/user.json
{
  "properties": {
    "isBot": {
      "description": "When true, indicates this is a bot user.",
      "type": "boolean",
      "default": false
    },
    "allowImpersonation": {
      "description": "When true, this bot is allowed to impersonate users (subject to policy checks).",
      "type": "boolean",
      "default": false
    }
  }
}
```

### 5.2 Java Entity Interface

```java
// openmetadata-spec/src/main/java/org/openmetadata/schema/EntityInterface.java
public interface EntityInterface {
    // ... existing methods

    String getUpdatedBy();
    void setUpdatedBy(String updatedBy);

    // NEW: Impersonation tracking
    default String getImpersonatedBy() {
        return null;
    }

    default void setImpersonatedBy(String botName) {
        /* no-op implementation to be overridden */
    }
}
```

### 5.3 Database Schema Migration

#### MySQL Migration
```sql
-- bootstrap/sql/migrations/native/1.7.0/mysql/schemaChanges.sql

-- Add impersonatedBy column to all entity tables
ALTER TABLE table_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE dashboard_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE pipeline_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE topic_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE container_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE database_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE database_schema_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE chart_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE report_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE metric_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE ml_model_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE glossary_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE glossary_term_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE tag_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE classification_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE policy_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE test_suite_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE test_case_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;
ALTER TABLE event_subscription_entity ADD COLUMN impersonatedBy VARCHAR(256) DEFAULT NULL;

-- Add allowImpersonation flag to user_entity
ALTER TABLE user_entity ADD COLUMN allowImpersonation BOOLEAN DEFAULT FALSE;

-- Add index for querying by impersonatedBy
CREATE INDEX idx_table_entity_impersonatedBy ON table_entity(impersonatedBy);
-- Repeat for high-traffic entities...
```

#### PostgreSQL Migration
```sql
-- bootstrap/sql/migrations/native/1.7.0/postgres/schemaChanges.sql

-- Same as MySQL with appropriate syntax
ALTER TABLE table_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256);
-- ... etc
```

### 5.4 Elasticsearch/OpenSearch Index Mapping

```json
// Update index mappings to include impersonatedBy
{
  "mappings": {
    "properties": {
      "updatedBy": {
        "type": "keyword"
      },
      "impersonatedBy": {
        "type": "keyword"
      },
      "updatedAt": {
        "type": "date"
      }
    }
  }
}
```

## 6. Implementation Details

### 6.1 Token Exchange API (New Endpoint)

**API Specification:**
```yaml
POST /api/v1/users/impersonate
Authorization: Bearer <bot-token>
Content-Type: application/json

Request Body:
{
  "targetUser": "alice",
  "expirySeconds": 3600  // Optional, defaults to 1 hour, max 24 hours
}

Response:
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsIn...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "impersonatedUser": "alice"
}
```

**Implementation:**
```java
// openmetadata-service/src/main/java/org/openmetadata/service/resources/teams/UserResource.java

@POST
@Path("/impersonate")
@Operation(
    operationId = "generateImpersonationToken",
    summary = "Generate impersonation token for bot",
    description = "Generate a short-lived JWT token that allows the bot to impersonate a specific user",
    responses = {
      @ApiResponse(
          responseCode = "200",
          description = "Impersonation token generated successfully",
          content = @Content(
              mediaType = APPLICATION_JSON,
              schema = @Schema(implementation = JWTAuthMechanism.class))),
      @ApiResponse(responseCode = "403", description = "Bot not authorized to impersonate"),
      @ApiResponse(responseCode = "404", description = "Target user not found")
    })
@Produces(APPLICATION_JSON)
@Consumes(APPLICATION_JSON)
public Response generateImpersonationToken(
    @Context SecurityContext securityContext,
    @Valid ImpersonationRequest request) {

    // 1. Extract bot from security context
    String botName = SecurityUtil.getUserName(securityContext);
    CatalogSecurityContext catalogContext = (CatalogSecurityContext) securityContext;

    // 2. Validate this is a bot user
    if (!catalogContext.isBot()) {
        throw new AuthorizationException("Only bot users can generate impersonation tokens");
    }

    // 3. Get bot user and verify allowImpersonation flag
    User bot = repository.getByName(
        null,
        botName,
        new EntityUtil.Fields(Set.of("allowImpersonation")),
        Include.NON_DELETED
    );

    if (!Boolean.TRUE.equals(bot.getAllowImpersonation())) {
        throw new AuthorizationException(
            String.format("Bot '%s' is not authorized to impersonate users", botName)
        );
    }

    // 4. Validate target user exists
    String targetUser = request.getTargetUser();
    User user = repository.getByName(
        null,
        targetUser,
        new EntityUtil.Fields(Set.of("email", "roles", "teams", "isAdmin")),
        Include.NON_DELETED
    );

    // 5. Check IMPERSONATE permission via policy
    SubjectContext botContext = SubjectContext.getSubjectContext(botName);
    ResourceContext userResourceContext = new ResourceContext(
        Entity.USER,
        user.getId(),
        null
    );
    OperationContext impersonateOperation = new OperationContext(
        Entity.USER,
        MetadataOperation.IMPERSONATE
    );

    try {
        PolicyEvaluator.hasPermission(botContext, userResourceContext, impersonateOperation);
    } catch (AuthorizationException e) {
        throw new AuthorizationException(
            String.format("Bot '%s' is not authorized to impersonate user '%s'",
                botName, targetUser),
            e
        );
    }

    // 6. Generate impersonation token with short expiry
    long expirySeconds = request.getExpirySeconds() != null
        ? Math.min(request.getExpirySeconds(), 24 * 3600)  // Max 24 hours
        : 3600;  // Default 1 hour

    JWTAuthMechanism authMechanism = JWTTokenGenerator.getInstance()
        .generateImpersonationToken(
            botName,
            targetUser,
            getRoleListFromUser(bot),
            bot.getIsAdmin(),
            bot.getEmail(),
            expirySeconds
        );

    // 7. Audit log
    LOG.info("Impersonation token generated: bot={}, target={}, expirySeconds={}",
        botName, targetUser, expirySeconds);

    return Response.ok(authMechanism).build();
}
```

**New Request Schema:**
```json
// openmetadata-spec/src/main/resources/json/schema/auth/impersonationRequest.json
{
  "$id": "https://open-metadata.org/schema/auth/impersonationRequest.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ImpersonationRequest",
  "description": "Request to generate an impersonation token",
  "type": "object",
  "javaType": "org.openmetadata.schema.auth.ImpersonationRequest",
  "properties": {
    "targetUser": {
      "description": "Username of the user to impersonate",
      "type": "string"
    },
    "expirySeconds": {
      "description": "Token expiry in seconds (default 3600, max 86400)",
      "type": "integer",
      "minimum": 60,
      "maximum": 86400,
      "default": 3600
    }
  },
  "required": ["targetUser"],
  "additionalProperties": false
}
```

### 6.2 JWTTokenGenerator Enhancement

Add new method to generate impersonation tokens:

```java
// openmetadata-service/src/main/java/org/openmetadata/service/security/jwt/JWTTokenGenerator.java

public class JWTTokenGenerator {
    public static final String IMPERSONATED_USER_CLAIM = "impersonatedUser";  // NEW

    // NEW: Generate impersonation token
    public JWTAuthMechanism generateImpersonationToken(
        String botName,
        String targetUser,
        Set<String> botRoles,
        boolean isBotAdmin,
        String botEmail,
        long expiryInSeconds
    ) {
        try {
            Algorithm algorithm = getAlgorithm(tokenValidationAlgorithm, null, privateKey);

            Date expiryDate = getCustomExpiryDate(expiryInSeconds);

            String token = JWT.create()
                .withSubject(botName)
                .withClaim(EMAIL_CLAIM, botEmail)
                .withClaim(IS_BOT_CLAIM, true)
                .withClaim(TOKEN_TYPE, ServiceTokenType.BOT.value())
                .withClaim(IMPERSONATED_USER_CLAIM, targetUser)  // NEW: Add impersonation claim
                .withExpiresAt(expiryDate)
                .withIssuer(issuer)
                .withKeyId(kid)
                .sign(algorithm);

            JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism()
                .withJWTToken(token)
                .withJWTTokenExpiresAt(expiryDate.getTime());

            return jwtAuthMechanism;
        } catch (JWTCreationException e) {
            throw AuthenticationException.invalidToken("Failed to generate impersonation token", e);
        }
    }

    private Date getCustomExpiryDate(long expiryInSeconds) {
        return Date.from(
            LocalDateTime.now()
                .plusSeconds(expiryInSeconds)
                .atZone(ZoneId.systemDefault())
                .toInstant()
        );
    }
}
```

### 6.3 JwtFilter Enhancement

```java
// openmetadata-service/src/main/java/org/openmetadata/service/security/JwtFilter.java

public class JwtFilter implements ContainerRequestFilter {
    public static final String IMPERSONATED_USER_CLAIM = "impersonatedUser";  // NEW

    @Override
    public void filter(ContainerRequestContext requestContext) {
        // ... existing code ...

        String tokenFromHeader = extractToken(requestContext.getHeaders());
        Map<String, Claim> claims = validateJwtAndGetClaims(tokenFromHeader);

        String userName = findUserNameFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims);
        String email = findEmailFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims, principalDomain);
        boolean isBotUser = isBot(claims);

        // NEW: Extract and validate impersonation
        String impersonatedUser = null;
        if (claims.containsKey(IMPERSONATED_USER_CLAIM)) {
            impersonatedUser = claims.get(IMPERSONATED_USER_CLAIM).asString();
            validateImpersonation(userName, impersonatedUser, isBotUser);
        }

        // Check existing validations
        checkValidationsForToken(claims, tokenFromHeader, userName);

        // Create security context with impersonation
        CatalogPrincipal catalogPrincipal = new CatalogPrincipal(userName, email);
        String scheme = requestContext.getUriInfo().getRequestUri().getScheme();

        CatalogSecurityContext catalogSecurityContext = new CatalogSecurityContext(
            catalogPrincipal,
            scheme,
            SecurityContext.DIGEST_AUTH,
            getUserRolesFromClaims(claims, isBotUser),
            isBotUser,
            impersonatedUser  // NEW
        );

        requestContext.setSecurityContext(catalogSecurityContext);
    }

    private void validateImpersonation(String botName, String targetUser, boolean isBot) {
        // 1. Only bots can impersonate
        if (!isBot) {
            throw new AuthorizationException("Only bot users can impersonate");
        }

        // 2. Check bot has allowImpersonation flag
        User bot = Entity.getEntityByName(Entity.USER, botName, "allowImpersonation", Include.NON_DELETED);
        if (!Boolean.TRUE.equals(bot.getAllowImpersonation())) {
            throw new AuthorizationException(
                String.format("Bot '%s' is not authorized to impersonate users", botName)
            );
        }

        // 3. Verify target user exists
        try {
            Entity.getEntityByName(Entity.USER, targetUser, "", Include.NON_DELETED);
        } catch (EntityNotFoundException e) {
            throw new AuthorizationException(
                String.format("Cannot impersonate non-existent user '%s'", targetUser)
            );
        }

        // 4. Check policy permission (done in DefaultAuthorizer during actual operation)
        // We defer this to avoid loading full context here
    }
}
```

### 6.3 DefaultAuthorizer Update

```java
// openmetadata-service/src/main/java/org/openmetadata/service/security/DefaultAuthorizer.java

public class DefaultAuthorizer implements Authorizer {

    @Override
    public void authorize(
        SecurityContext securityContext,
        OperationContext operationContext,
        ResourceContextInterface resourceContext
    ) {
        CatalogSecurityContext catalogContext = (CatalogSecurityContext) securityContext;

        // NEW: If impersonating, verify impersonation permission first
        if (catalogContext.impersonatedUser() != null) {
            validateImpersonationPermission(
                catalogContext.getUserPrincipal().getName(),
                catalogContext.impersonatedUser()
            );
        }

        // Use impersonated user's context for authorization
        SubjectContext subjectContext = getSubjectContext(securityContext);

        if (subjectContext.isAdmin()) {
            return;
        }

        if (isReviewer(resourceContext, subjectContext)) {
            return;
        }

        PolicyEvaluator.hasPermission(subjectContext, resourceContext, operationContext);
    }

    // NEW: Validate impersonation permission
    private void validateImpersonationPermission(String botName, String targetUser) {
        SubjectContext botContext = SubjectContext.getSubjectContext(botName);
        User targetUserEntity = Entity.getEntityByName(
            Entity.USER,
            targetUser,
            "",
            Include.NON_DELETED
        );

        ResourceContext userResourceContext = new ResourceContext(
            Entity.USER,
            targetUserEntity.getId(),
            null
        );

        OperationContext impersonateOperation = new OperationContext(
            Entity.USER,
            MetadataOperation.IMPERSONATE
        );

        try {
            PolicyEvaluator.hasPermission(botContext, userResourceContext, impersonateOperation);
        } catch (AuthorizationException e) {
            throw new AuthorizationException(
                String.format("Bot '%s' is not authorized to impersonate user '%s'",
                    botName, targetUser),
                e
            );
        }
    }

    public static SubjectContext getSubjectContext(SecurityContext securityContext) {
        if (securityContext == null || securityContext.getUserPrincipal() == null) {
            throw new AuthenticationException("No principal in security context");
        }

        CatalogSecurityContext catalogContext = (CatalogSecurityContext) securityContext;

        // NEW: Use impersonated user if present
        String userName = catalogContext.impersonatedUser() != null
            ? catalogContext.impersonatedUser()
            : SecurityUtil.getUserName(securityContext);

        String impersonatedBy = catalogContext.impersonatedUser() != null
            ? catalogContext.getUserPrincipal().getName()
            : null;

        User user = Entity.getEntityByName(Entity.USER, userName, USER_FIELDS, Include.NON_DELETED);
        return new SubjectContext(user, impersonatedBy);
    }
}
```

### 6.4 EntityRepository Update

```java
// openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/EntityRepository.java

public abstract class EntityRepository<T extends EntityInterface> {

    protected void prepareInternal(T entity, CreateEntity request, String updatedBy) {
        // ... existing code ...

        entity.setUpdatedBy(updatedBy);
        entity.setUpdatedAt(System.currentTimeMillis());

        // NEW: Set impersonatedBy from SubjectContext
        SubjectContext subjectContext = SubjectContext.getSubjectContext(updatedBy);
        if (subjectContext.impersonatedBy() != null) {
            entity.setImpersonatedBy(subjectContext.impersonatedBy());
        }

        // ... rest of existing code ...
    }

    public final PutResponse<T> update(UriInfo uriInfo, T original, T updated, String updatedBy) {
        setFieldsInternal(original, putFields);
        updated.setUpdatedBy(updatedBy);
        updated.setUpdatedAt(System.currentTimeMillis());

        // NEW: Set impersonatedBy
        SubjectContext subjectContext = SubjectContext.getSubjectContext(updatedBy);
        if (subjectContext.impersonatedBy() != null) {
            updated.setImpersonatedBy(subjectContext.impersonatedBy());
        }

        // ... rest of existing code ...
    }
}
```

## 7. Frontend Changes

### 7.1 Type Definitions (Auto-generated)

```typescript
// Generated from schema
export interface EntityReference {
  id: string;
  name: string;
  fullyQualifiedName?: string;
  // ... other fields
}

export interface Table extends EntityInterface {
  // ... other fields
  updatedBy?: string;
  impersonatedBy?: string;  // NEW
  updatedAt?: number;
}
```

### 7.2 UI Components

#### Entity Header Component
```tsx
// Display impersonation badge
const EntityHeader = ({ entity }: { entity: EntityInterface }) => {
  return (
    <div className="entity-header">
      <div className="updated-info">
        {entity.impersonatedBy ? (
          <Tooltip
            title={`Action performed by ${entity.updatedBy} via bot ${entity.impersonatedBy}`}
          >
            <span>
              Updated by <strong>{entity.updatedBy}</strong>
              <Tag color="blue" className="impersonation-tag">
                via {entity.impersonatedBy}
              </Tag>
            </span>
          </Tooltip>
        ) : (
          <span>Updated by <strong>{entity.updatedBy}</strong></span>
        )}
        <span className="timestamp">{formatDateTime(entity.updatedAt)}</span>
      </div>
    </div>
  );
};
```

#### Activity Feed
```tsx
// Show impersonation in activity feed
const ActivityFeedItem = ({ activity }: { activity: ChangeEvent }) => {
  const displayName = activity.impersonatedBy
    ? `${activity.userName} (via ${activity.impersonatedBy})`
    : activity.userName;

  return (
    <div className="activity-item">
      <Avatar name={activity.userName} />
      <div>
        <strong>{displayName}</strong> {activity.action} {activity.entityType}
        <time>{formatRelativeTime(activity.timestamp)}</time>
      </div>
    </div>
  );
};
```

### 7.3 Admin Settings UI

```tsx
// Bot configuration page
const BotSettings = ({ bot }: { bot: User }) => {
  const [allowImpersonation, setAllowImpersonation] = useState(bot.allowImpersonation);

  return (
    <div className="bot-settings">
      <h3>Impersonation Settings</h3>
      <Switch
        checked={allowImpersonation}
        onChange={(checked) => {
          updateBotSettings(bot.id, { allowImpersonation: checked });
          setAllowImpersonation(checked);
        }}
      />
      <p className="help-text">
        Allow this bot to impersonate users (subject to policy restrictions)
      </p>

      {allowImpersonation && (
        <Alert type="warning">
          This bot can perform actions on behalf of users. Ensure appropriate
          impersonation policies are configured.
        </Alert>
      )}
    </div>
  );
};
```

## 8. Usage Examples

### 8.1 Python SDK Usage

```python
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
    AuthProvider
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig
)

# Initialize OM client with bot token
bot_token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."  # Bot's standard JWT token

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider=AuthProvider.openmetadata,
    securityConfig=OpenMetadataJWTClientConfig(jwtToken=bot_token)
)

metadata = OpenMetadata(server_config)

# Step 1: Request impersonation token for a specific user
impersonation_response = metadata.client.post(
    "/users/impersonate",
    data={
        "targetUser": "alice",
        "expirySeconds": 3600
    }
)

impersonation_token = impersonation_response["accessToken"]
print(f"Obtained impersonation token for alice: {impersonation_token[:50]}...")

# Step 2: Create new OM client with impersonation token
impersonation_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider=AuthProvider.openmetadata,
    securityConfig=OpenMetadataJWTClientConfig(jwtToken=impersonation_token)
)

impersonation_metadata = OpenMetadata(impersonation_config)

# Step 3: Perform operations as alice (via bot)
from metadata.generated.schema.entity.data.table import Table

table = impersonation_metadata.get_by_name(
    entity=Table,
    fqn="sample_data.ecommerce_db.shopify.dim_customer"
)

table.description = "Updated by alice via ingestion-bot"

updated_table = impersonation_metadata.patch(table)

# Result:
# - updatedBy will be "alice"
# - impersonatedBy will be "ingestion-bot"
# - Authorization checks use alice's permissions

print(f"Updated table: {updated_table.fullyQualifiedName}")
print(f"Updated by: {updated_table.updatedBy}")
print(f"Impersonated by: {updated_table.impersonatedBy}")
```

### 8.2 Ingestion Workflow Example

```python
# In ingestion connector code
class CustomIngestionSource(Source):
    def __init__(self, config, metadata_config):
        self.config = config
        self.metadata = OpenMetadata(metadata_config)
        self.impersonation_token = None
        self.impersonation_metadata = None

    def prepare(self):
        """Request impersonation token for the user who triggered ingestion"""
        if self.config.impersonateUser:
            response = self.metadata.client.post(
                "/users/impersonate",
                data={
                    "targetUser": self.config.impersonateUser,
                    "expirySeconds": 7200  # 2 hours for ingestion job
                }
            )
            self.impersonation_token = response["accessToken"]

            # Create new metadata client with impersonation
            impersonation_config = OpenMetadataConnection(
                hostPort=self.metadata.config.hostPort,
                authProvider=AuthProvider.openmetadata,
                securityConfig=OpenMetadataJWTClientConfig(
                    jwtToken=self.impersonation_token
                )
            )
            self.impersonation_metadata = OpenMetadata(impersonation_config)

    def yield_create_request(self, entity_data):
        """Use impersonation client if available"""
        client = self.impersonation_metadata or self.metadata

        # All operations will be attributed to impersonateUser
        # but tracked as performed by ingestion bot
        return CreateTableRequest(
            name=entity_data.name,
            description=entity_data.description,
            # ... other fields
        )
```

### 8.3 REST API Examples

#### Get Impersonation Token
```bash
curl -X POST https://localhost:8585/api/v1/users/impersonate \
  -H "Authorization: Bearer <bot-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUser": "alice",
    "expirySeconds": 3600
  }'

# Response:
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "impersonatedUser": "alice",
  "jwtTokenExpiry": {
    "expiresAt": 1699123456789
  }
}
```

#### Use Impersonation Token
```bash
# Update table using impersonation token
IMPERSONATION_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik..."

curl -X PATCH https://localhost:8585/api/v1/tables/{table-id} \
  -H "Authorization: Bearer $IMPERSONATION_TOKEN" \
  -H "Content-Type: application/json-patch+json" \
  -d '[{
    "op": "add",
    "path": "/description",
    "value": "Updated via impersonation"
  }]'

# Response includes:
{
  "id": "...",
  "name": "dim_customer",
  "updatedBy": "alice",
  "impersonatedBy": "ingestion-bot",
  "updatedAt": 1699120000000
}
```

#### Verify Impersonation in Activity Feed
```bash
curl -X GET "https://localhost:8585/api/v1/feed?entityLink=<#E::table::..." \
  -H "Authorization: Bearer <token>"

# Response shows:
{
  "data": [
    {
      "id": "...",
      "type": "entityUpdated",
      "userName": "alice",
      "impersonatedBy": "ingestion-bot",
      "timestamp": 1699120000000,
      "changeDescription": {
        "fieldsUpdated": [
          {
            "name": "description",
            "oldValue": "...",
            "newValue": "Updated via impersonation"
          }
        ]
      }
    }
  ]
}
```

### 8.4 Error Scenarios

#### Bot Without Impersonation Permission
```bash
curl -X POST https://localhost:8585/api/v1/users/impersonate \
  -H "Authorization: Bearer <bot-token-without-permission>" \
  -d '{"targetUser": "alice"}'

# Response: 403 Forbidden
{
  "code": 403,
  "message": "Bot 'my-bot' is not authorized to impersonate users",
  "exceptionType": "AuthorizationException"
}
```

#### Bot Without allowImpersonation Flag
```bash
# Response: 403 Forbidden
{
  "code": 403,
  "message": "Bot 'my-bot' is not authorized to impersonate users",
  "exceptionType": "AuthorizationException"
}
```

#### Policy Restriction Violation
```bash
# Bot tries to impersonate user from different domain
curl -X POST https://localhost:8585/api/v1/users/impersonate \
  -H "Authorization: Bearer <bot-token>" \
  -d '{"targetUser": "bob-from-marketing"}'

# Response: 403 Forbidden
{
  "code": 403,
  "message": "Bot 'engineering-bot' is not authorized to impersonate user 'bob-from-marketing'",
  "exceptionType": "AuthorizationException"
}
```

#### Non-Bot User Attempt
```bash
# Regular user tries to get impersonation token
curl -X POST https://localhost:8585/api/v1/users/impersonate \
  -H "Authorization: Bearer <regular-user-token>" \
  -d '{"targetUser": "alice"}'

# Response: 403 Forbidden
{
  "code": 403,
  "message": "Only bot users can generate impersonation tokens",
  "exceptionType": "AuthorizationException"
}
```

## 9. API Changes

### 9.1 REST API Behavior

All existing CRUD endpoints remain unchanged. Impersonation is handled transparently through JWT token claims.

### 9.2 New Endpoint Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/users/impersonate` | Request impersonation token | Bot with `allowImpersonation=true` |

### 8.2 Search and Filter Support

```bash
# Search for entities updated by specific user via bot
GET /api/v1/search/query?q=impersonatedBy:ingestion-bot

# Search for specific user's actions (including impersonated)
GET /api/v1/search/query?q=updatedBy:alice

# Activity feed with impersonation filter
GET /api/v1/feed?filterType=impersonated&bot=ingestion-bot
```

## 9. Security Considerations

### 9.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Unauthorized Impersonation** | Three-level validation: isBot + allowImpersonation flag + policy permission |
| **Privilege Escalation** | Use impersonated user's permissions, not bot's |
| **Token Theft** | Standard JWT security + short expiry + token validation |
| **Audit Trail Tampering** | Immutable audit logs with both user and bot tracked |
| **Policy Bypass** | Impersonation permission checked on every request |

### 9.2 Security Best Practices

1. **Least Privilege**: Only enable `allowImpersonation` for bots that absolutely need it
2. **Policy Restrictions**: Use domain/team-based policies to limit scope
3. **Token Expiry**: Impersonation tokens should have shorter expiry (e.g., 1 hour)
4. **Audit Monitoring**: Alert on impersonation usage patterns
5. **Regular Review**: Periodic audit of which bots have impersonation enabled

### 9.3 Attack Scenarios and Defenses

#### Scenario 1: Malicious Bot Attempts Impersonation
```
Attack: Bot without allowImpersonation tries to include impersonatedUser claim
Defense: JwtFilter validates allowImpersonation flag, rejects request
Result: 403 Forbidden - "Bot not authorized to impersonate"
```

#### Scenario 2: Bot Tries to Impersonate Admin
```
Attack: Bot with impersonation tries to impersonate admin user
Defense: Policy checks if bot can impersonate that specific user
Result: 403 Forbidden - "Bot 'X' not authorized to impersonate user 'admin'"
```

#### Scenario 3: Stolen Impersonation Token
```
Attack: Attacker obtains valid impersonation token
Defense:
  - Short token expiry (1 hour)
  - Token bound to specific user
  - Audit logs show suspicious activity patterns
  - Can revoke bot's allowImpersonation flag
Result: Limited blast radius, quick detection and mitigation
```

## 10. Testing Strategy

### 10.1 Unit Tests

```java
// JwtFilterTest.java
@Test
public void testImpersonationValidation_Success() {
    // Given: Bot with allowImpersonation=true and valid token
    String token = generateImpersonationToken("test-bot", "alice");

    // When: Filter processes request
    CatalogSecurityContext context = jwtFilter.getCatalogSecurityContext(token);

    // Then: Context contains impersonation info
    assertEquals("test-bot", context.getUserPrincipal().getName());
    assertEquals("alice", context.impersonatedUser());
}

@Test
public void testImpersonationValidation_BotNotAuthorized() {
    // Given: Bot with allowImpersonation=false
    User bot = createBot("test-bot", false);
    String token = generateImpersonationToken("test-bot", "alice");

    // When/Then: Validation fails
    assertThrows(AuthorizationException.class, () -> {
        jwtFilter.validateJwtAndGetClaims(token);
    });
}

@Test
public void testNonBotCannotImpersonate() {
    // Given: Regular user tries to impersonate
    String token = JWT.create()
        .withSubject("alice")
        .withClaim("isBot", false)
        .withClaim("impersonatedUser", "bob")
        .sign(algorithm);

    // When/Then: Validation fails
    assertThrows(AuthorizationException.class, () -> {
        jwtFilter.validateJwtAndGetClaims(token);
    });
}
```

```java
// EntityRepositoryTest.java
@Test
public void testEntityUpdate_WithImpersonation() {
    // Given: Bot impersonating user
    SubjectContext context = new SubjectContext(
        createUser("alice"),
        "ingestion-bot"  // impersonatedBy
    );

    Table table = createTable();

    // When: Update entity
    tableRepository.update(null, table, updatedTable, "alice");

    // Then: Both fields are set
    assertEquals("alice", updatedTable.getUpdatedBy());
    assertEquals("ingestion-bot", updatedTable.getImpersonatedBy());
}
```

### 10.2 Integration Tests

```java
// ImpersonationIntegrationTest.java
@Test
public void testEndToEndImpersonation() {
    // 1. Create bot with impersonation enabled
    User bot = createBot("test-bot", true);
    bot.setAllowImpersonation(true);

    // 2. Create policy allowing impersonation
    Policy policy = createImpersonationPolicy("test-bot", "alice");

    // 3. Generate impersonation token
    String token = generateImpersonationToken("test-bot", "alice");

    // 4. Make API call to update entity
    Response response = updateTable(tableId, token, newDescription);

    // 5. Verify response
    assertEquals(200, response.getStatus());

    // 6. Verify database state
    Table updated = getTable(tableId);
    assertEquals("alice", updated.getUpdatedBy());
    assertEquals("test-bot", updated.getImpersonatedBy());

    // 7. Verify audit log
    List<ChangeEvent> events = getChangeEvents(tableId);
    assertEquals("alice", events.get(0).getUserName());
    assertEquals("test-bot", events.get(0).getImpersonatedBy());
}

@Test
public void testImpersonationWithoutPolicy_Fails() {
    // Setup: Bot with flag but no policy
    User bot = createBot("test-bot", true);
    String token = generateImpersonationToken("test-bot", "alice");

    // When: Attempt operation
    Response response = updateTable(tableId, token, newDescription);

    // Then: Fails with 403
    assertEquals(403, response.getStatus());
    assertTrue(response.getEntity().toString().contains("not authorized to impersonate"));
}
```

### 10.3 Security Tests

```java
@Test
public void testPrivilegeEscalation_Prevented() {
    // Given: alice can edit tables in Engineering domain
    //        bob can only view tables
    //        bot impersonates bob

    User alice = createUser("alice", "Engineering", "DataSteward");
    User bob = createUser("bob", "Engineering", "DataConsumer");
    User bot = createBot("test-bot", true);

    Table table = createTableInDomain("Engineering");

    // When: Bot impersonates bob and tries to update table
    String token = generateImpersonationToken("test-bot", "bob");
    Response response = updateTable(table.getId(), token, "New description");

    // Then: Operation fails (bob lacks permission)
    assertEquals(403, response.getStatus());
}

@Test
public void testCrossDomainImpersonation_Restricted() {
    // Given: Policy allows impersonation only within Engineering domain
    User bot = createBot("test-bot", true);
    createDomainRestrictedImpersonationPolicy("test-bot", "Engineering");

    User engineeringUser = createUserInDomain("alice", "Engineering");
    User marketingUser = createUserInDomain("bob", "Marketing");

    // When: Try to impersonate within domain
    String token1 = generateImpersonationToken("test-bot", "alice");
    Response response1 = updateEntity(token1);
    assertEquals(200, response1.getStatus());  // Success

    // When: Try to impersonate outside domain
    String token2 = generateImpersonationToken("test-bot", "bob");
    Response response2 = updateEntity(token2);
    assertEquals(403, response2.getStatus());  // Failure
}
```

### 10.4 Performance Tests

```java
@Test
public void testImpersonationOverhead() {
    // Measure overhead of impersonation validation

    // Baseline: Normal request
    long baseline = measureRequestTime(() -> updateTableNormal());

    // With impersonation
    long withImpersonation = measureRequestTime(() -> updateTableWithImpersonation());

    // Assert: Overhead < 10%
    double overhead = (withImpersonation - baseline) / (double) baseline;
    assertTrue(overhead < 0.10, "Impersonation overhead should be < 10%");
}
```

## 11. Migration Plan

### Phase 1: Schema and Backend (Week 1-2)
1. Add JSON schema definitions
2. Add database migrations
3. Update EntityInterface
4. Regenerate Java/Python/TypeScript models
5. Update JwtFilter, CatalogSecurityContext, SubjectContext
6. Deploy to dev environment

### Phase 2: Authorization (Week 2-3)
7. Add IMPERSONATE to MetadataOperation enum
8. Update DefaultAuthorizer with validation logic
9. Update EntityRepository to populate impersonatedBy
10. Add unit tests and integration tests
11. Deploy to staging environment

### Phase 3: Bot Support (Week 3-4)
12. Add allowImpersonation to User schema
13. Update bot creation APIs
14. Update Python SDK to support impersonation tokens
15. Update ingestion framework
16. Test with sample ingestion workflows

### Phase 4: Frontend (Week 4-5)
17. Update UI components to display impersonation
18. Add bot configuration page
19. Update activity feed
20. Add filtering by impersonatedBy

### Phase 5: Documentation and Rollout (Week 5-6)
21. Write user documentation
22. Write admin guide for policy configuration
23. Create migration guide for bot users
24. Gradual rollout to production
25. Monitor and adjust policies

## 12. Monitoring and Observability

### 12.1 Metrics

```java
// Metrics to track
- impersonation.requests.total (counter)
- impersonation.requests.by_bot (counter, labeled by bot name)
- impersonation.requests.by_target_user (counter, labeled by user)
- impersonation.validation.failures (counter, labeled by reason)
- impersonation.authorization.duration (histogram)
```

### 12.2 Logging

```java
// Log examples
LOG.info("Impersonation validated: bot={}, target={}, operation={}",
    botName, targetUser, operation);

LOG.warn("Impersonation attempt blocked: bot={}, target={}, reason={}",
    botName, targetUser, reason);

LOG.debug("Impersonation token processed: bot={}, user={}, entity={}",
    botName, userName, entityType);
```

### 12.3 Alerts

```yaml
# Alert on suspicious patterns
- name: HighImpersonationFailureRate
  condition: impersonation.validation.failures > 10/min
  severity: warning

- name: UnauthorizedImpersonationAttempts
  condition: impersonation.requests{reason="unauthorized"} > 5/min
  severity: critical

- name: CrossDomainImpersonationSpike
  condition: impersonation.requests{cross_domain="true"} > 20/min
  severity: warning
```

## 13. Documentation

### 13.1 User Guide

**For Bot Users:**
- How to enable impersonation for your bot
- How to generate impersonation tokens
- Examples in Python SDK and REST API
- Troubleshooting common issues

**For Admins:**
- How to configure impersonation policies
- Best practices for security
- How to audit impersonation usage
- How to investigate suspicious activity

### 13.2 API Documentation

Update OpenAPI specification:
```yaml
components:
  securitySchemes:
    BotImpersonation:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        JWT token with impersonation claim. Bot must have allowImpersonation=true
        and policy permission to impersonate the target user.

        Token claims:
        - isBot: true (required)
        - impersonatedUser: string (target username)
```

## 14. Future Enhancements

### 14.1 Impersonation Audit Report
- UI dashboard showing all impersonated actions
- Exportable audit reports
- Anomaly detection for unusual patterns

### 14.2 Temporary Impersonation Tokens
- Time-limited impersonation grants
- Automatic expiry after specific duration
- Revocable impersonation sessions

### 14.3 Impersonation Approval Workflow
- Require admin approval for sensitive impersonations
- Approval via UI or API
- Notification to impersonated user

### 14.4 Delegation Instead of Impersonation
- User explicitly delegates actions to bot
- Delegation scope limited to specific operations/entities
- User can revoke delegation anytime

## 15. Appendix

### 15.1 Related Work
- AWS IAM Role Assumption
- Kubernetes Service Account Impersonation
- Google Cloud Service Account Impersonation

### 15.2 Security Standards
- OWASP API Security Top 10
- NIST 800-53 Access Control Guidelines
- SOC 2 Audit Requirements

### 15.3 Glossary
- **Impersonation**: Bot acting on behalf of a user
- **Subject**: The entity performing authorization checks (user or bot)
- **Principal**: The authenticated entity in security context
- **Policy**: Rule defining what operations are allowed
- **Resource Context**: Entity being accessed
- **Operation Context**: Type of action being performed

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Authors**: OpenMetadata Engineering
**Status**: Draft for Review

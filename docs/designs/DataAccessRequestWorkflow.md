# Data Access Request Workflow Design

## Overview
Implement a comprehensive Data Access Request system that enables users to request access to data assets (Tables, Dashboards, Topics, ML Models) through customizable workflows with approval gates, and automatically provision access via reverse metadata connectors upon approval.

## Architecture Components

### 1. Schema Layer (openmetadata-spec)

#### New Schema: Data Access Request Entity
**Location**: `openmetadata-spec/src/main/resources/json/schema/entity/governance/dataAccessRequest.json`

```json
{
  "$id": "https://open-metadata.org/schema/entity/governance/dataAccessRequest.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DataAccessRequest",
  "description": "A request for access to a data asset with approval workflow",
  "javaType": "org.openmetadata.schema.entity.governance.DataAccessRequest",
  "javaInterfaces": ["org.openmetadata.schema.EntityInterface"],
  "type": "object",
  "properties": {
    "id": {
      "description": "Unique identifier of this access request",
      "$ref": "../../type/basic.json#/definitions/uuid"
    },
    "name": {
      "description": "Name that identifies this access request",
      "$ref": "../../type/basic.json#/definitions/entityName"
    },
    "displayName": {
      "description": "Display name for this access request",
      "type": "string"
    },
    "requestor": {
      "description": "User requesting access",
      "$ref": "../../type/entityReference.json"
    },
    "targetAsset": {
      "description": "Data asset for which access is requested",
      "$ref": "../../type/basic.json#/definitions/entityLink"
    },
    "targetAssetRef": {
      "description": "Reference to the target data asset",
      "$ref": "../../type/entityReference.json"
    },
    "targetAssetType": {
      "description": "Type of the target asset",
      "type": "string",
      "enum": ["table", "dashboard", "topic", "mlmodel", "container", "databaseSchema", "database"]
    },
    "accessLevel": {
      "description": "Level of access requested",
      "type": "string",
      "enum": ["Read", "Write", "Admin", "Custom"],
      "default": "Read"
    },
    "justification": {
      "description": "Business justification for the access request",
      "$ref": "../../type/basic.json#/definitions/markdown"
    },
    "duration": {
      "description": "Duration in days for temporary access (null for permanent)",
      "type": "integer",
      "minimum": 1,
      "maximum": 365
    },
    "expiresAt": {
      "description": "Timestamp when access expires",
      "$ref": "../../type/basic.json#/definitions/timestamp"
    },
    "customFormData": {
      "description": "Custom form data captured during request",
      "type": "object",
      "additionalProperties": true
    },
    "status": {
      "description": "Status of the access request",
      "type": "string",
      "enum": ["Pending", "Approved", "Rejected", "Expired", "Revoked"],
      "default": "Pending"
    },
    "workflowInstanceId": {
      "description": "ID of the workflow instance handling this request",
      "$ref": "../../type/basic.json#/definitions/uuid"
    },
    "approvalHistory": {
      "description": "History of approval actions",
      "type": "array",
      "items": {
        "$ref": "#/definitions/approvalAction"
      }
    },
    "provisioningStatus": {
      "description": "Status of access provisioning on source system",
      "type": "string",
      "enum": ["NotStarted", "InProgress", "Completed", "Failed", "Revoked"],
      "default": "NotStarted"
    },
    "provisioningError": {
      "description": "Error message if provisioning failed",
      "type": "string"
    },
    "grantedPolicies": {
      "description": "Policies created/granted for this access",
      "$ref": "../../type/entityReferenceList.json"
    },
    "accessDetails": {
      "description": "Specific access configuration details",
      "$ref": "#/definitions/accessConfiguration"
    },
    "version": {
      "$ref": "../../type/entityHistory.json#/definitions/entityVersion"
    },
    "updatedAt": {
      "$ref": "../../type/basic.json#/definitions/timestamp"
    },
    "updatedBy": {
      "type": "string"
    },
    "createdAt": {
      "$ref": "../../type/basic.json#/definitions/timestamp"
    },
    "createdBy": {
      "type": "string"
    },
    "deleted": {
      "type": "boolean",
      "default": false
    }
  },
  "definitions": {
    "approvalAction": {
      "type": "object",
      "properties": {
        "id": {
          "$ref": "../../type/basic.json#/definitions/uuid"
        },
        "approver": {
          "$ref": "../../type/entityReference.json"
        },
        "action": {
          "type": "string",
          "enum": ["Approved", "Rejected", "RequestedChanges"]
        },
        "comment": {
          "type": "string"
        },
        "timestamp": {
          "$ref": "../../type/basic.json#/definitions/timestamp"
        }
      },
      "required": ["id", "approver", "action", "timestamp"]
    },
    "accessConfiguration": {
      "type": "object",
      "description": "Detailed access configuration",
      "properties": {
        "rowLevelFilter": {
          "description": "SQL WHERE clause for row-level security",
          "type": "string"
        },
        "columns": {
          "description": "Specific columns to grant access to",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "maskingRules": {
          "description": "Data masking rules to apply",
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "column": {"type": "string"},
              "maskingFunction": {"type": "string"}
            }
          }
        },
        "customPermissions": {
          "description": "Custom permissions specific to the data platform",
          "type": "object",
          "additionalProperties": true
        }
      }
    }
  },
  "required": ["id", "name", "requestor", "targetAsset", "targetAssetType", "accessLevel", "status"],
  "additionalProperties": false
}
```

#### New Workflow Node: Data Access Request Task
**Location**: `openmetadata-spec/src/main/resources/json/schema/governance/workflows/elements/nodes/userTask/dataAccessRequestTask.json`

```json
{
  "$id": "https://open-metadata.org/schema/governance/workflows/elements/nodes/userTask/dataAccessRequestTask.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DataAccessRequestTaskDefinition",
  "description": "Defines a Task for approving data access requests",
  "javaInterfaces": [
    "org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface"
  ],
  "javaType": "org.openmetadata.schema.governance.workflows.elements.nodes.userTask.DataAccessRequestTaskDefinition",
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "default": "userTask"
    },
    "subType": {
      "type": "string",
      "default": "dataAccessRequestTask"
    },
    "name": {
      "$ref": "../../../../../type/basic.json#/definitions/entityName"
    },
    "displayName": {
      "type": "string"
    },
    "description": {
      "$ref": "../../../../../type/basic.json#/definitions/markdown"
    },
    "config": {
      "type": "object",
      "properties": {
        "assignees": {
          "type": "object",
          "properties": {
            "addReviewers": {
              "type": "boolean",
              "default": false
            },
            "addOwners": {
              "type": "boolean",
              "default": true
            },
            "teams": {
              "type": "array",
              "items": {"type": "string"}
            },
            "users": {
              "type": "array",
              "items": {"type": "string"}
            }
          }
        },
        "approvalThreshold": {
          "type": "integer",
          "minimum": 1,
          "default": 1
        },
        "rejectionThreshold": {
          "type": "integer",
          "minimum": 1,
          "default": 1
        },
        "customFormSchema": {
          "description": "JSON Schema for custom form fields",
          "type": "object"
        },
        "showAssetDetails": {
          "type": "boolean",
          "default": true
        },
        "showRequestorDetails": {
          "type": "boolean",
          "default": true
        }
      },
      "required": ["assignees"]
    },
    "input": {
      "type": "array",
      "items": {"type": "string"},
      "default": ["dataAccessRequest", "relatedEntity"]
    },
    "output": {
      "type": "array",
      "items": {"type": "string"},
      "default": ["updatedBy", "approvalDecision"]
    },
    "branches": {
      "type": "array",
      "items": {"type": "string"},
      "default": ["approved", "rejected"]
    }
  }
}
```

#### New Workflow Node: Grant Access Task
**Location**: `openmetadata-spec/src/main/resources/json/schema/governance/workflows/elements/nodes/automatedTask/grantDataAccessTask.json`

```json
{
  "$id": "https://open-metadata.org/schema/governance/workflows/elements/nodes/automatedTask/grantDataAccessTask.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GrantDataAccessTaskDefinition",
  "description": "Automated task to grant data access via reverse metadata connector",
  "javaInterfaces": [
    "org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface"
  ],
  "javaType": "org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.GrantDataAccessTaskDefinition",
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "default": "automatedTask"
    },
    "subType": {
      "type": "string",
      "default": "grantDataAccessTask"
    },
    "name": {
      "$ref": "../../../../../type/basic.json#/definitions/entityName"
    },
    "displayName": {
      "type": "string"
    },
    "description": {
      "$ref": "../../../../../type/basic.json#/definitions/markdown"
    },
    "config": {
      "type": "object",
      "properties": {
        "createPolicy": {
          "description": "Create a Policy entity in OpenMetadata",
          "type": "boolean",
          "default": true
        },
        "policyName": {
          "description": "Template for policy name",
          "type": "string",
          "default": "Access-{requestor}-{asset}"
        },
        "notifyRequestor": {
          "type": "boolean",
          "default": true
        },
        "notifyOwners": {
          "type": "boolean",
          "default": true
        },
        "rollbackOnFailure": {
          "type": "boolean",
          "default": true
        }
      }
    },
    "input": {
      "type": "array",
      "items": {"type": "string"},
      "default": ["dataAccessRequest", "approvalDecision"]
    },
    "output": {
      "type": "array",
      "items": {"type": "string"},
      "default": ["provisioningStatus", "grantedPolicyId"]
    }
  }
}
```

#### Enhanced Reverse Ingestion Config
**Location**: `openmetadata-spec/src/main/resources/json/schema/metadataIngestion/reverseingestionconfig/accessPolicyConfig.json`

```json
{
  "$id": "https://open-metadata.org/schema/metadataIngestion/reverseingestionconfig/accessPolicyConfig.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Access Policy Config",
  "type": "object",
  "description": "Configuration for granting data access via reverse ingestion",
  "javaType": "org.openmetadata.schema.metadataIngestion.reverseingestionconfig.AccessPolicyConfig",
  "properties": {
    "policyType": {
      "description": "Type of access policy",
      "type": "string",
      "enum": ["Grant", "RowLevelSecurity", "ColumnLevelSecurity", "DataMasking"],
      "default": "Grant"
    },
    "user": {
      "description": "User or service account to grant access to",
      "type": "string"
    },
    "role": {
      "description": "Role to grant (platform-specific)",
      "type": "string"
    },
    "accessLevel": {
      "description": "Level of access",
      "type": "string",
      "enum": ["Read", "Write", "Admin", "Custom"],
      "default": "Read"
    },
    "duration": {
      "description": "Duration in days for temporary access",
      "type": "integer",
      "minimum": 1
    },
    "expiresAt": {
      "description": "Timestamp when access expires",
      "type": "integer"
    },
    "rowLevelFilter": {
      "description": "SQL WHERE clause for row-level security",
      "type": "string"
    },
    "columns": {
      "description": "Specific columns to grant access to",
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "maskingRules": {
      "description": "Data masking rules",
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "column": {"type": "string"},
          "maskingFunction": {"type": "string"}
        }
      }
    },
    "customConfig": {
      "description": "Platform-specific configuration",
      "type": "object",
      "additionalProperties": true
    }
  },
  "required": ["policyType", "user", "accessLevel"],
  "additionalProperties": false
}
```

### 2. Backend Services (openmetadata-service)

#### New Repository
**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/DataAccessRequestRepository.java`

```java
public class DataAccessRequestRepository extends EntityRepository<DataAccessRequest> {

    public DataAccessRequestRepository() {
        super(
            "dataAccessRequest",
            Entity.DATA_ACCESS_REQUEST,
            DataAccessRequest.class,
            Entity.getCollectionDAO().dataAccessRequestDAO(),
            "",
            ""
        );
    }

    // Find requests by requestor
    public ResultList<DataAccessRequest> listByRequestor(UUID requestorId, ListFilter filter);

    // Find requests by target asset
    public ResultList<DataAccessRequest> listByAsset(String assetFqn, ListFilter filter);

    // Find pending requests for approver
    public ResultList<DataAccessRequest> listPendingForApprover(UUID approverId, ListFilter filter);

    // Update provisioning status
    public void updateProvisioningStatus(UUID requestId, ProvisioningStatus status, String error);

    // Add approval action
    public void addApprovalAction(UUID requestId, ApprovalAction action);

    // Find expired access requests
    public List<DataAccessRequest> findExpiredRequests();

    // Mark as revoked
    public void revokeAccess(UUID requestId, String revokedBy, String reason);
}
```

#### New Workflow Handler Methods
**File**: `openmetadata-service/src/main/java/org/openmetadata/service/governance/workflows/WorkflowHandler.java`

```java
// Add to existing WorkflowHandler class

public ProcessInstance triggerDataAccessWorkflow(
    String workflowName,
    DataAccessRequest request
) {
    Map<String, Object> variables = new HashMap<>();
    variables.put("dataAccessRequestId", request.getId().toString());
    variables.put("requestor", request.getRequestor().getName());
    variables.put("targetAsset", request.getTargetAsset());
    variables.put("accessLevel", request.getAccessLevel());
    variables.put("customFormData", JsonUtils.pojoToJson(request.getCustomFormData()));

    String businessKey = request.getId().toString();
    return triggerByKey(workflowName, businessKey, variables);
}

public void grantDataAccess(UUID requestId) {
    DataAccessRequestRepository repository = Entity.getDataAccessRequestRepository();
    DataAccessRequest request = repository.get(null, requestId, EntityUtil.Fields.EMPTY_FIELDS);

    // Get the service for the target asset
    EntityReference assetRef = request.getTargetAssetRef();
    EntityReference serviceRef = getServiceForEntity(assetRef);

    // Create reverse ingestion operation
    ReverseIngestionPipeline pipeline = createAccessGrantPipeline(request, serviceRef);

    // Execute via ingestion framework
    executeReverseIngestion(pipeline);
}
```

#### New Automated Task Implementation
**File**: `openmetadata-service/src/main/java/org/openmetadata/service/governance/workflows/elements/nodes/automatedTask/GrantDataAccessTask.java`

```java
public class GrantDataAccessTask implements WorkflowNodeInterface {

    @Override
    public void execute(DelegateExecution execution) {
        String requestIdStr = (String) execution.getVariable("dataAccessRequestId");
        UUID requestId = UUID.fromString(requestIdStr);

        DataAccessRequestRepository repository = Entity.getDataAccessRequestRepository();

        try {
            // Update status to in-progress
            repository.updateProvisioningStatus(requestId, ProvisioningStatus.IN_PROGRESS, null);

            // Grant access via reverse metadata connector
            WorkflowHandler.getInstance().grantDataAccess(requestId);

            // Create Policy entity in OpenMetadata
            Policy policy = createAccessPolicy(requestId);
            Entity.getPolicyRepository().create(null, policy);

            // Update request with granted policy
            DataAccessRequest request = repository.get(null, requestId, EntityUtil.Fields.EMPTY_FIELDS);
            request.setGrantedPolicies(List.of(policy.getEntityReference()));
            request.setProvisioningStatus(ProvisioningStatus.COMPLETED);
            repository.put(null, request);

            // Set output variable
            execution.setVariable("provisioningStatus", "COMPLETED");
            execution.setVariable("grantedPolicyId", policy.getId().toString());

        } catch (Exception e) {
            LOG.error("Failed to grant data access for request {}", requestId, e);
            repository.updateProvisioningStatus(requestId, ProvisioningStatus.FAILED, e.getMessage());
            execution.setVariable("provisioningStatus", "FAILED");
            throw new WorkflowExecutionException("Failed to provision access", e);
        }
    }

    private Policy createAccessPolicy(UUID requestId) {
        // Create Policy entity representing the granted access
        // Include rules, expiration, etc.
    }
}
```

#### REST API Endpoints
**File**: `openmetadata-service/src/main/java/org/openmetadata/service/resources/governance/DataAccessRequestResource.java`

```java
@Path("/v1/dataAccess")
@Api(value = "Data Access Requests")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DataAccessRequestResource extends EntityResource<DataAccessRequest, DataAccessRequestRepository> {

    @POST
    @Path("/requests")
    @Operation(summary = "Create a data access request")
    public Response createRequest(
        @Context SecurityContext securityContext,
        @Valid CreateDataAccessRequest create
    ) {
        // Create DataAccessRequest entity
        // Trigger workflow
        // Return created request
    }

    @GET
    @Path("/requests")
    @Operation(summary = "List access requests")
    public ResultList<DataAccessRequest> listRequests(
        @Context SecurityContext securityContext,
        @QueryParam("requestor") String requestorId,
        @QueryParam("asset") String assetFqn,
        @QueryParam("status") String status,
        @DefaultValue("10") @QueryParam("limit") int limit,
        @DefaultValue("0") @QueryParam("offset") int offset
    ) {
        // List with filters
    }

    @GET
    @Path("/requests/{id}")
    @Operation(summary = "Get access request by ID")
    public DataAccessRequest getRequest(
        @PathParam("id") UUID id,
        @Context SecurityContext securityContext
    ) {
        return repository.get(null, id, repository.getFields("*"));
    }

    @PUT
    @Path("/requests/{id}/approve")
    @Operation(summary = "Approve an access request")
    public Response approveRequest(
        @PathParam("id") UUID id,
        @Context SecurityContext securityContext,
        @Valid ApprovalRequest approvalRequest
    ) {
        // Resolve workflow task with approval
        // Add approval action to history
    }

    @PUT
    @Path("/requests/{id}/reject")
    @Operation(summary = "Reject an access request")
    public Response rejectRequest(
        @PathParam("id") UUID id,
        @Context SecurityContext securityContext,
        @Valid RejectionRequest rejectionRequest
    ) {
        // Resolve workflow task with rejection
    }

    @PUT
    @Path("/requests/{id}/revoke")
    @Operation(summary = "Revoke granted access")
    public Response revokeAccess(
        @PathParam("id") UUID id,
        @Context SecurityContext securityContext,
        @Valid RevokeRequest revokeRequest
    ) {
        // Revoke access via reverse connector
        // Update request status
    }

    @GET
    @Path("/requests/asset/{assetFqn}")
    @Operation(summary = "Get requests for a specific asset")
    public ResultList<DataAccessRequest> getRequestsForAsset(
        @PathParam("assetFqn") String assetFqn,
        @Context SecurityContext securityContext
    ) {
        return repository.listByAsset(assetFqn, new ListFilter());
    }

    @GET
    @Path("/requests/user/{userId}")
    @Operation(summary = "Get user's access requests")
    public ResultList<DataAccessRequest> getUserRequests(
        @PathParam("userId") UUID userId,
        @Context SecurityContext securityContext
    ) {
        return repository.listByRequestor(userId, new ListFilter());
    }
}
```

### 3. Python Ingestion (Reverse Metadata Connectors)

#### Enhanced Reverse Metadata Framework
**File**: `ingestion/src/metadata/ingestion/ometa/mixins/access_policy_mixin.py`

```python
from typing import List, Optional
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.governance.dataAccessRequest import DataAccessRequest
from metadata.generated.schema.metadataIngestion.reverseingestionconfig.accessPolicyConfig import AccessPolicyConfig
from metadata.generated.schema.entity.services.ingestionPipelines.reverseIngestionResponse import (
    ReverseIngestionResponse,
    OperationResult,
)


class OMetaAccessPolicyMixin:
    """
    Mixin for granting data access via reverse metadata connectors
    """

    def grant_access(
        self,
        service: DatabaseService,
        access_request: DataAccessRequest,
        access_config: AccessPolicyConfig,
    ) -> ReverseIngestionResponse:
        """
        Grant data access on the source system

        Args:
            service: Database service to operate on
            access_request: The access request with target asset details
            access_config: Configuration for the access grant

        Returns:
            ReverseIngestionResponse with results
        """
        try:
            # Get the appropriate connector for the service type
            connector = self._get_access_connector(service.serviceType)

            if not connector:
                raise ValueError(f"No access connector found for {service.serviceType}")

            # Execute the access grant
            result = connector.grant_access(
                connection=service.connection,
                entity_link=access_request.targetAsset,
                user=access_config.user,
                access_level=access_config.accessLevel,
                config=access_config,
            )

            return ReverseIngestionResponse(
                serviceId=service.id,
                results=[result]
            )

        except Exception as exc:
            logger.error(f"Failed to grant access: {exc}")
            raise

    def revoke_access(
        self,
        service: DatabaseService,
        access_request: DataAccessRequest,
    ) -> ReverseIngestionResponse:
        """
        Revoke previously granted access
        """
        connector = self._get_access_connector(service.serviceType)

        result = connector.revoke_access(
            connection=service.connection,
            entity_link=access_request.targetAsset,
            user=access_request.requestor.name,
        )

        return ReverseIngestionResponse(
            serviceId=service.id,
            results=[result]
        )

    def _get_access_connector(self, service_type: str):
        """Get the appropriate access policy connector for service type"""
        from metadata.ingestion.source.database.access_policy_factory import (
            AccessPolicyConnectorFactory
        )
        return AccessPolicyConnectorFactory.create(service_type)
```

#### Connector-Specific Implementations

**Snowflake** (`ingestion/src/metadata/ingestion/source/database/snowflake/access_policy.py`):

```python
from metadata.ingestion.source.database.access_policy_base import AccessPolicyConnectorBase


class SnowflakeAccessPolicyConnector(AccessPolicyConnectorBase):
    """
    Snowflake-specific access policy implementation
    """

    def grant_access(
        self,
        connection,
        entity_link: str,
        user: str,
        access_level: str,
        config: AccessPolicyConfig,
    ) -> OperationResult:
        """
        Grant access on Snowflake

        Supports:
        - GRANT SELECT/INSERT/UPDATE/DELETE based on access level
        - Row-level security via secure views
        - Data masking policies
        - Time-limited grants
        """
        try:
            # Parse entity link to get database.schema.table
            db, schema, table = self._parse_entity_link(entity_link)

            # Build GRANT statement
            privilege = self._map_access_level_to_privilege(access_level)
            grant_sql = f"GRANT {privilege} ON TABLE {db}.{schema}.{table} TO USER {user}"

            # Execute grant
            with connection.cursor() as cursor:
                cursor.execute(grant_sql)

            # If row-level security is requested, create secure view
            if config.rowLevelFilter:
                self._create_secure_view(connection, db, schema, table, user, config.rowLevelFilter)

            # If masking is requested, create masking policy
            if config.maskingRules:
                self._create_masking_policy(connection, db, schema, table, config.maskingRules)

            # If time-limited, schedule revoke
            if config.duration:
                self._schedule_revoke(connection, db, schema, table, user, config.duration)

            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="GRANT_ACCESS",
                status="Success",
                message=f"Granted {access_level} access to {user} on {table}"
            )

        except Exception as exc:
            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="GRANT_ACCESS",
                status="Failed",
                message=f"Failed to grant access: {str(exc)}"
            )

    def _create_secure_view(self, connection, db, schema, table, user, row_filter):
        """Create a secure view with row-level filtering"""
        view_name = f"{table}_VIEW_{user.upper()}"
        create_view_sql = f"""
        CREATE OR REPLACE SECURE VIEW {db}.{schema}.{view_name} AS
        SELECT * FROM {db}.{schema}.{table}
        WHERE {row_filter}
        """

        with connection.cursor() as cursor:
            cursor.execute(create_view_sql)
            cursor.execute(f"GRANT SELECT ON VIEW {db}.{schema}.{view_name} TO USER {user}")

    def _create_masking_policy(self, connection, db, schema, table, masking_rules):
        """Create data masking policies"""
        for rule in masking_rules:
            policy_name = f"{table}_{rule.column}_MASK"
            create_policy_sql = f"""
            CREATE OR REPLACE MASKING POLICY {db}.{schema}.{policy_name} AS (val string) RETURNS string ->
              CASE
                WHEN CURRENT_ROLE() IN ('ADMIN') THEN val
                ELSE {rule.maskingFunction}
              END
            """

            with connection.cursor() as cursor:
                cursor.execute(create_policy_sql)
                cursor.execute(
                    f"ALTER TABLE {db}.{schema}.{table} "
                    f"MODIFY COLUMN {rule.column} SET MASKING POLICY {policy_name}"
                )

    def _schedule_revoke(self, connection, db, schema, table, user, duration_days):
        """Schedule automatic revoke after duration"""
        revoke_date = datetime.now() + timedelta(days=duration_days)
        task_name = f"REVOKE_{table}_{user}_{uuid.uuid4().hex[:8]}"

        create_task_sql = f"""
        CREATE TASK {db}.{schema}.{task_name}
          SCHEDULE = 'USING CRON 0 2 {revoke_date.day} {revoke_date.month} * UTC'
        AS
          REVOKE ALL ON TABLE {db}.{schema}.{table} FROM USER {user}
        """

        with connection.cursor() as cursor:
            cursor.execute(create_task_sql)
            cursor.execute(f"ALTER TASK {db}.{schema}.{task_name} RESUME")

    def revoke_access(self, connection, entity_link: str, user: str) -> OperationResult:
        """Revoke access from Snowflake"""
        try:
            db, schema, table = self._parse_entity_link(entity_link)

            revoke_sql = f"REVOKE ALL ON TABLE {db}.{schema}.{table} FROM USER {user}"

            with connection.cursor() as cursor:
                cursor.execute(revoke_sql)

            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="REVOKE_ACCESS",
                status="Success",
                message=f"Revoked access from {user} on {table}"
            )

        except Exception as exc:
            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="REVOKE_ACCESS",
                status="Failed",
                message=f"Failed to revoke access: {str(exc)}"
            )
```

**BigQuery** (`ingestion/src/metadata/ingestion/source/database/bigquery/access_policy.py`):

```python
from google.cloud import bigquery
from google.cloud.bigquery import AccessEntry


class BigQueryAccessPolicyConnector(AccessPolicyConnectorBase):
    """
    BigQuery-specific access policy implementation
    """

    def grant_access(
        self,
        connection,
        entity_link: str,
        user: str,
        access_level: str,
        config: AccessPolicyConfig,
    ) -> OperationResult:
        """
        Grant access on BigQuery

        Supports:
        - IAM policy updates
        - Authorized views for row-level security
        - Column-level security
        - Policy tags for data governance
        """
        try:
            client = bigquery.Client(credentials=connection.credentials)

            # Parse entity link
            project, dataset, table = self._parse_entity_link(entity_link)

            # Map access level to IAM role
            role = self._map_access_level_to_role(access_level)

            # Get dataset and update IAM policy
            dataset_ref = client.dataset(dataset, project=project)
            dataset_obj = client.get_dataset(dataset_ref)

            # Add access entry
            access_entries = list(dataset_obj.access_entries)
            access_entries.append(
                AccessEntry(
                    role=role,
                    entity_type="userByEmail",
                    entity_id=user
                )
            )
            dataset_obj.access_entries = access_entries

            # Update dataset
            client.update_dataset(dataset_obj, ["access_entries"])

            # If row-level security, create authorized view
            if config.rowLevelFilter:
                self._create_authorized_view(client, project, dataset, table, user, config.rowLevelFilter)

            # If column-level security, apply policy tags
            if config.columns:
                self._apply_column_security(client, project, dataset, table, config.columns, user)

            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="GRANT_ACCESS",
                status="Success",
                message=f"Granted {access_level} access to {user} on {table}"
            )

        except Exception as exc:
            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="GRANT_ACCESS",
                status="Failed",
                message=f"Failed to grant access: {str(exc)}"
            )

    def _create_authorized_view(self, client, project, dataset, table, user, row_filter):
        """Create an authorized view with row-level filtering"""
        view_dataset = f"{dataset}_views"
        view_name = f"{table}_view_{user.replace('@', '_').replace('.', '_')}"

        # Create view dataset if not exists
        try:
            client.get_dataset(f"{project}.{view_dataset}")
        except:
            client.create_dataset(f"{project}.{view_dataset}")

        # Create view with filter
        view_sql = f"""
        CREATE OR REPLACE VIEW `{project}.{view_dataset}.{view_name}` AS
        SELECT * FROM `{project}.{dataset}.{table}`
        WHERE {row_filter}
        """

        client.query(view_sql).result()

    def _apply_column_security(self, client, project, dataset, table, columns, user):
        """Apply column-level security using policy tags"""
        # Create policy tag taxonomy if needed
        # Apply tags to specific columns
        # Grant fine-grained reader role
        pass

    def revoke_access(self, connection, entity_link: str, user: str) -> OperationResult:
        """Revoke access from BigQuery"""
        try:
            client = bigquery.Client(credentials=connection.credentials)
            project, dataset, table = self._parse_entity_link(entity_link)

            dataset_ref = client.dataset(dataset, project=project)
            dataset_obj = client.get_dataset(dataset_ref)

            # Remove access entry for user
            access_entries = [
                entry for entry in dataset_obj.access_entries
                if entry.entity_id != user
            ]
            dataset_obj.access_entries = access_entries

            client.update_dataset(dataset_obj, ["access_entries"])

            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="REVOKE_ACCESS",
                status="Success",
                message=f"Revoked access from {user}"
            )

        except Exception as exc:
            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="REVOKE_ACCESS",
                status="Failed",
                message=f"Failed to revoke: {str(exc)}"
            )
```

**Redshift** (`ingestion/src/metadata/ingestion/source/database/redshift/access_policy.py`):

```python
class RedshiftAccessPolicyConnector(AccessPolicyConnectorBase):
    """
    Redshift-specific access policy implementation
    """

    def grant_access(
        self,
        connection,
        entity_link: str,
        user: str,
        access_level: str,
        config: AccessPolicyConfig,
    ) -> OperationResult:
        """
        Grant access on Redshift

        Supports:
        - GRANT statements
        - Row-level security policies
        - Dynamic data masking via views
        """
        try:
            # Parse entity link
            schema, table = self._parse_entity_link(entity_link)

            # Build GRANT statement
            privilege = self._map_access_level_to_privilege(access_level)
            grant_sql = f"GRANT {privilege} ON {schema}.{table} TO {user}"

            with connection.cursor() as cursor:
                cursor.execute(grant_sql)

            # Row-level security
            if config.rowLevelFilter:
                self._create_rls_policy(connection, schema, table, user, config.rowLevelFilter)

            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="GRANT_ACCESS",
                status="Success",
                message=f"Granted {access_level} to {user}"
            )

        except Exception as exc:
            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="GRANT_ACCESS",
                status="Failed",
                message=str(exc)
            )

    def _create_rls_policy(self, connection, schema, table, user, row_filter):
        """Create row-level security policy"""
        policy_name = f"rls_{table}_{user}"

        create_policy_sql = f"""
        CREATE RLS POLICY {policy_name}
        WITH (username = '{user}')
        USING ({row_filter})
        """

        attach_policy_sql = f"ALTER TABLE {schema}.{table} ROW LEVEL SECURITY ON"

        with connection.cursor() as cursor:
            cursor.execute(create_policy_sql)
            cursor.execute(attach_policy_sql)

    def revoke_access(self, connection, entity_link: str, user: str) -> OperationResult:
        """Revoke access from Redshift"""
        try:
            schema, table = self._parse_entity_link(entity_link)
            revoke_sql = f"REVOKE ALL ON {schema}.{table} FROM {user}"

            with connection.cursor() as cursor:
                cursor.execute(revoke_sql)

            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="REVOKE_ACCESS",
                status="Success"
            )
        except Exception as exc:
            return OperationResult(
                id=str(uuid.uuid4()),
                entityLink=entity_link,
                type="REVOKE_ACCESS",
                status="Failed",
                message=str(exc)
            )
```

### 4. Frontend (openmetadata-ui)

#### New Components

**DataAccessRequestButton.component.tsx**
**Location**: `openmetadata-ui/src/main/resources/ui/src/components/DataAccess/DataAccessRequestButton.component.tsx`

```typescript
import React, { useState } from 'react';
import { Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import DataAccessRequestModal from './DataAccessRequestModal.component';

interface DataAccessRequestButtonProps {
  entityType: string;
  entityFqn: string;
  entityRef: EntityReference;
  hasAccess: boolean;
}

const DataAccessRequestButton: React.FC<DataAccessRequestButtonProps> = ({
  entityType,
  entityFqn,
  entityRef,
  hasAccess,
}) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);

  if (hasAccess) {
    return null;
  }

  return (
    <>
      <Button
        type="primary"
        icon={<LockOutlined />}
        onClick={() => setShowModal(true)}>
        {t('label.request-access')}
      </Button>

      {showModal && (
        <DataAccessRequestModal
          entityType={entityType}
          entityFqn={entityFqn}
          entityRef={entityRef}
          visible={showModal}
          onCancel={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            // Show success notification
          }}
        />
      )}
    </>
  );
};

export default DataAccessRequestButton;
```

**DataAccessRequestForm.component.tsx**
**Location**: `openmetadata-ui/src/main/resources/ui/src/components/DataAccess/DataAccessRequestForm.component.tsx`

```typescript
import React, { useState, useCallback } from 'react';
import { Form, Select, Input, InputNumber, Button } from 'antd';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import Form as RJSFForm from '@rjsf/antd';
import { useTranslation } from 'react-i18next';
import RichTextEditor from '../common/RichTextEditor/RichTextEditor';
import { createDataAccessRequest } from '../../rest/dataAccessAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

interface DataAccessRequestFormProps {
  entityType: string;
  entityFqn: string;
  entityRef: EntityReference;
  workflowConfig?: WorkflowConfiguration;
  onSuccess: () => void;
  onCancel: () => void;
}

const DataAccessRequestForm: React.FC<DataAccessRequestFormProps> = ({
  entityType,
  entityFqn,
  entityRef,
  workflowConfig,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [customFormData, setCustomFormData] = useState<Record<string, unknown>>({});

  const handleSubmit = useCallback(async (values: Record<string, unknown>) => {
    setLoading(true);

    try {
      const request = {
        name: `Access Request - ${entityFqn}`,
        requestor: getCurrentUser(),
        targetAsset: `<#E::${entityType}::${entityFqn}>`,
        targetAssetRef: entityRef,
        targetAssetType: entityType,
        accessLevel: values.accessLevel,
        justification: values.justification,
        duration: values.duration,
        customFormData: customFormData,
      };

      await createDataAccessRequest(request);
      showSuccessToast(t('message.access-request-submitted'));
      onSuccess();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [customFormData, entityType, entityFqn, entityRef, onSuccess]);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}>
      <Form.Item
        label={t('label.access-level')}
        name="accessLevel"
        rules={[{ required: true }]}>
        <Select placeholder={t('label.select-access-level')}>
          <Select.Option value="Read">{t('label.read')}</Select.Option>
          <Select.Option value="Write">{t('label.write')}</Select.Option>
          <Select.Option value="Admin">{t('label.admin')}</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        label={t('label.duration-days')}
        name="duration"
        tooltip={t('message.access-duration-tooltip')}>
        <InputNumber
          min={1}
          max={365}
          placeholder={t('label.permanent-if-empty')}
        />
      </Form.Item>

      <Form.Item
        label={t('label.business-justification')}
        name="justification"
        rules={[{ required: true }]}>
        <RichTextEditor
          initialValue=""
          height="200px"
          placeHolder={t('message.justification-placeholder')}
        />
      </Form.Item>

      {workflowConfig?.customFormSchema && (
        <div className="custom-form-section">
          <h4>{t('label.additional-information')}</h4>
          <RJSFForm
            schema={workflowConfig.customFormSchema as RJSFSchema}
            validator={validator}
            formData={customFormData}
            onChange={(e) => setCustomFormData(e.formData)}
          />
        </div>
      )}

      <div className="form-actions">
        <Button onClick={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          {t('label.submit-request')}
        </Button>
      </div>
    </Form>
  );
};

export default DataAccessRequestForm;
```

**DataAccessRequestList.component.tsx**
**Location**: `openmetadata-ui/src/main/resources/ui/src/components/DataAccess/DataAccessRequestList.component.tsx`

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Space, Button, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { getDataAccessRequests } from '../../rest/dataAccessAPI';
import { DataAccessRequest } from '../../generated/entity/governance/dataAccessRequest';

interface DataAccessRequestListProps {
  userId?: string;
  assetFqn?: string;
}

const DataAccessRequestList: React.FC<DataAccessRequestListProps> = ({
  userId,
  assetFqn,
}) => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<DataAccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (userId) params.requestor = userId;
      if (assetFqn) params.asset = assetFqn;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await getDataAccessRequests(params);
      setRequests(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [userId, assetFqn, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const columns = [
    {
      title: t('label.asset'),
      dataIndex: 'targetAssetRef',
      render: (ref: EntityReference) => (
        <Link to={getEntityDetailsPath(ref.type, ref.fullyQualifiedName)}>
          {ref.displayName || ref.name}
        </Link>
      ),
    },
    {
      title: t('label.access-level'),
      dataIndex: 'accessLevel',
      render: (level: string) => <Tag>{level}</Tag>,
    },
    {
      title: t('label.status'),
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: t('label.requested-on'),
      dataIndex: 'createdAt',
      render: (timestamp: number) => formatDateTime(timestamp),
    },
    {
      title: t('label.expires-at'),
      dataIndex: 'expiresAt',
      render: (timestamp: number) =>
        timestamp ? formatDateTime(timestamp) : t('label.permanent'),
    },
    {
      title: t('label.actions'),
      render: (record: DataAccessRequest) => (
        <Space>
          <Button
            size="small"
            onClick={() => showRequestDetails(record)}>
            {t('label.view')}
          </Button>
          {record.status === 'Approved' && (
            <Button
              size="small"
              danger
              onClick={() => handleRevoke(record.id)}>
              {t('label.revoke')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="data-access-request-list">
      <div className="list-header">
        <h3>{t('label.access-requests')}</h3>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 200 }}>
          <Select.Option value="all">{t('label.all')}</Select.Option>
          <Select.Option value="Pending">{t('label.pending')}</Select.Option>
          <Select.Option value="Approved">{t('label.approved')}</Select.Option>
          <Select.Option value="Rejected">{t('label.rejected')}</Select.Option>
        </Select>
      </div>

      <Table
        columns={columns}
        dataSource={requests}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default DataAccessRequestList;
```

**DataAccessRequestTask.component.tsx**
**Location**: `openmetadata-ui/src/main/resources/ui/src/components/DataAccess/DataAccessRequestTask.component.tsx`

```typescript
import React, { useState } from 'react';
import { Card, Descriptions, Button, Input, Space, Alert } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { approveDataAccessRequest, rejectDataAccessRequest } from '../../rest/dataAccessAPI';
import EntitySummaryPanel from '../Explore/EntitySummaryPanel/EntitySummaryPanel.component';

interface DataAccessRequestTaskProps {
  task: Task;
  request: DataAccessRequest;
  onComplete: () => void;
}

const DataAccessRequestTask: React.FC<DataAccessRequestTaskProps> = ({
  task,
  request,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await approveDataAccessRequest(request.id, { comment });
      showSuccessToast(t('message.request-approved'));
      onComplete();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await rejectDataAccessRequest(request.id, { comment });
      showSuccessToast(t('message.request-rejected'));
      onComplete();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="data-access-request-task">
      <Card title={t('label.access-request-details')}>
        <Descriptions column={2}>
          <Descriptions.Item label={t('label.requestor')}>
            {request.requestor.displayName || request.requestor.name}
          </Descriptions.Item>
          <Descriptions.Item label={t('label.access-level')}>
            {request.accessLevel}
          </Descriptions.Item>
          <Descriptions.Item label={t('label.duration')}>
            {request.duration ? `${request.duration} ${t('label.days')}` : t('label.permanent')}
          </Descriptions.Item>
          <Descriptions.Item label={t('label.requested-on')}>
            {formatDateTime(request.createdAt)}
          </Descriptions.Item>
        </Descriptions>

        <div className="justification-section">
          <h4>{t('label.business-justification')}</h4>
          <div dangerouslySetInnerHTML={{ __html: request.justification }} />
        </div>

        {request.customFormData && (
          <div className="custom-data-section">
            <h4>{t('label.additional-information')}</h4>
            {Object.entries(request.customFormData).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {String(value)}
              </Descriptions.Item>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={t('label.asset-details')}
        className="asset-details-card">
        <EntitySummaryPanel
          entityDetails={request.targetAssetRef}
          showTags
          showDescription
          showOwner
        />
      </Card>

      <Card title={t('label.your-decision')}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea
            rows={4}
            placeholder={t('message.add-comment-optional')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <Space>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={loading}
              onClick={handleApprove}>
              {t('label.approve')}
            </Button>
            <Button
              danger
              icon={<CloseOutlined />}
              loading={loading}
              onClick={handleReject}>
              {t('label.reject')}
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default DataAccessRequestTask;
```

### 5. Database Schema Migrations

**MySQL Migration**: `bootstrap/sql/migrations/native/1.12.0/mysql/schemaChanges.sql`

```sql
-- Create data_access_request table
CREATE TABLE IF NOT EXISTS data_access_request (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  display_name VARCHAR(256),
  requestor_id VARCHAR(36) NOT NULL,
  target_asset VARCHAR(512) NOT NULL,
  target_asset_type VARCHAR(64) NOT NULL,
  target_asset_ref JSON,
  access_level VARCHAR(32) NOT NULL,
  justification TEXT,
  duration_days INTEGER,
  expires_at BIGINT,
  custom_form_data JSON,
  status VARCHAR(32) NOT NULL,
  workflow_instance_id VARCHAR(36),
  approval_history JSON,
  provisioning_status VARCHAR(32) DEFAULT 'NotStarted',
  provisioning_error TEXT,
  granted_policies JSON,
  access_details JSON,
  version DOUBLE NOT NULL DEFAULT 0.1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  created_by VARCHAR(256),
  updated_by VARCHAR(256),
  deleted BOOLEAN DEFAULT FALSE,

  INDEX idx_requestor (requestor_id),
  INDEX idx_asset (target_asset(255)),
  INDEX idx_status (status),
  INDEX idx_workflow (workflow_instance_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_created_at (created_at),

  CONSTRAINT fk_requestor FOREIGN KEY (requestor_id) REFERENCES user_entity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create access_approval_history table (for detailed audit)
CREATE TABLE IF NOT EXISTS access_approval_history (
  id VARCHAR(36) PRIMARY KEY,
  request_id VARCHAR(36) NOT NULL,
  approver_id VARCHAR(36) NOT NULL,
  action VARCHAR(32) NOT NULL,
  comment TEXT,
  timestamp BIGINT NOT NULL,

  INDEX idx_request (request_id),
  INDEX idx_approver (approver_id),
  INDEX idx_timestamp (timestamp),

  CONSTRAINT fk_access_request FOREIGN KEY (request_id) REFERENCES data_access_request(id) ON DELETE CASCADE,
  CONSTRAINT fk_approver FOREIGN KEY (approver_id) REFERENCES user_entity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**PostgreSQL Migration**: `bootstrap/sql/migrations/native/1.12.0/postgres/schemaChanges.sql`

```sql
-- Create data_access_request table
CREATE TABLE IF NOT EXISTS data_access_request (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  display_name VARCHAR(256),
  requestor_id VARCHAR(36) NOT NULL,
  target_asset VARCHAR(512) NOT NULL,
  target_asset_type VARCHAR(64) NOT NULL,
  target_asset_ref JSONB,
  access_level VARCHAR(32) NOT NULL,
  justification TEXT,
  duration_days INTEGER,
  expires_at BIGINT,
  custom_form_data JSONB,
  status VARCHAR(32) NOT NULL,
  workflow_instance_id VARCHAR(36),
  approval_history JSONB,
  provisioning_status VARCHAR(32) DEFAULT 'NotStarted',
  provisioning_error TEXT,
  granted_policies JSONB,
  access_details JSONB,
  version DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  created_by VARCHAR(256),
  updated_by VARCHAR(256),
  deleted BOOLEAN DEFAULT FALSE,

  CONSTRAINT fk_requestor FOREIGN KEY (requestor_id) REFERENCES user_entity(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dar_requestor ON data_access_request(requestor_id);
CREATE INDEX IF NOT EXISTS idx_dar_asset ON data_access_request(target_asset);
CREATE INDEX IF NOT EXISTS idx_dar_status ON data_access_request(status);
CREATE INDEX IF NOT EXISTS idx_dar_workflow ON data_access_request(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_dar_expires ON data_access_request(expires_at);
CREATE INDEX IF NOT EXISTS idx_dar_created ON data_access_request(created_at);

-- Create access_approval_history table
CREATE TABLE IF NOT EXISTS access_approval_history (
  id VARCHAR(36) PRIMARY KEY,
  request_id VARCHAR(36) NOT NULL,
  approver_id VARCHAR(36) NOT NULL,
  action VARCHAR(32) NOT NULL,
  comment TEXT,
  timestamp BIGINT NOT NULL,

  CONSTRAINT fk_access_request FOREIGN KEY (request_id) REFERENCES data_access_request(id) ON DELETE CASCADE,
  CONSTRAINT fk_approver FOREIGN KEY (approver_id) REFERENCES user_entity(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aah_request ON access_approval_history(request_id);
CREATE INDEX IF NOT EXISTS idx_aah_approver ON access_approval_history(approver_id);
CREATE INDEX IF NOT EXISTS idx_aah_timestamp ON access_approval_history(timestamp);
```

### 6. Sample Workflow Configuration

**DataAccessApprovalWorkflow.json**
**Location**: `openmetadata-service/src/main/resources/json/data/governance/workflows/DataAccessApprovalWorkflow.json`

```json
{
  "name": "DataAccessApprovalWorkflow",
  "fullyQualifiedName": "DataAccessApprovalWorkflow",
  "displayName": "Data Access Request Workflow",
  "description": "Workflow for requesting and granting data access with approval gates",
  "config": {
    "storeStageStatus": true
  },
  "trigger": {
    "type": "noOp",
    "config": {}
  },
  "nodes": [
    {
      "type": "startEvent",
      "subType": "startEvent",
      "name": "AccessRequestCreated",
      "displayName": "Access Request Created"
    },
    {
      "type": "automatedTask",
      "subType": "checkEntityAttributesTask",
      "name": "CheckAssetSensitivity",
      "displayName": "Check Asset Sensitivity Level",
      "config": {
        "rules": "{\"or\":[{\"some\":[{\"var\":\"tags\"},{\"in\":[{\"var\":\"tagFQN\"},[\"PII.Sensitive\",\"PII.NonSensitive\"]]}]}]}"
      },
      "inputNamespaceMap": {
        "relatedEntity": "global"
      }
    },
    {
      "type": "userTask",
      "subType": "dataAccessRequestTask",
      "name": "DataOwnerApproval",
      "displayName": "Data Owner Approval",
      "config": {
        "assignees": {
          "addReviewers": false,
          "addOwners": true
        },
        "approvalThreshold": 1,
        "rejectionThreshold": 1,
        "customFormSchema": {
          "type": "object",
          "properties": {
            "businessJustification": {
              "type": "string",
              "title": "Business Justification"
            },
            "projectName": {
              "type": "string",
              "title": "Project Name"
            }
          }
        },
        "showAssetDetails": true,
        "showRequestorDetails": true
      },
      "inputNamespaceMap": {
        "dataAccessRequest": "global",
        "relatedEntity": "global"
      },
      "output": ["approvalDecision", "updatedBy"]
    },
    {
      "type": "userTask",
      "subType": "userApprovalTask",
      "name": "DataStewardApproval",
      "displayName": "Data Steward Approval (Sensitive Data)",
      "config": {
        "assignees": {
          "addReviewers": false,
          "teams": ["DataStewards"]
        },
        "approvalThreshold": 1,
        "rejectionThreshold": 1
      },
      "inputNamespaceMap": {
        "dataAccessRequest": "global",
        "relatedEntity": "global"
      },
      "output": ["finalApprovalDecision", "updatedBy"]
    },
    {
      "type": "automatedTask",
      "subType": "grantDataAccessTask",
      "name": "ProvisionAccess",
      "displayName": "Provision Access on Source System",
      "config": {
        "createPolicy": true,
        "policyName": "Access-{requestor}-{asset}",
        "notifyRequestor": true,
        "notifyOwners": true,
        "rollbackOnFailure": true
      },
      "inputNamespaceMap": {
        "dataAccessRequest": "global",
        "approvalDecision": "DataOwnerApproval"
      },
      "output": ["provisioningStatus", "grantedPolicyId"]
    },
    {
      "type": "automatedTask",
      "subType": "setEntityAttributeTask",
      "name": "UpdateRequestStatusApproved",
      "displayName": "Update Request Status to Approved",
      "config": {
        "fieldName": "status",
        "fieldValue": "Approved"
      },
      "inputNamespaceMap": {
        "dataAccessRequest": "global"
      }
    },
    {
      "type": "automatedTask",
      "subType": "setEntityAttributeTask",
      "name": "UpdateRequestStatusRejected",
      "displayName": "Update Request Status to Rejected",
      "config": {
        "fieldName": "status",
        "fieldValue": "Rejected"
      },
      "inputNamespaceMap": {
        "dataAccessRequest": "global"
      }
    },
    {
      "type": "endEvent",
      "subType": "endEvent",
      "name": "AccessGranted",
      "displayName": "Access Granted"
    },
    {
      "type": "endEvent",
      "subType": "endEvent",
      "name": "AccessDenied",
      "displayName": "Access Denied"
    }
  ],
  "edges": [
    {
      "from": "AccessRequestCreated",
      "to": "CheckAssetSensitivity"
    },
    {
      "from": "CheckAssetSensitivity",
      "to": "DataOwnerApproval",
      "condition": "true"
    },
    {
      "from": "CheckAssetSensitivity",
      "to": "DataOwnerApproval",
      "condition": "false"
    },
    {
      "from": "DataOwnerApproval",
      "to": "DataStewardApproval",
      "condition": "approved"
    },
    {
      "from": "DataOwnerApproval",
      "to": "UpdateRequestStatusRejected",
      "condition": "rejected"
    },
    {
      "from": "DataStewardApproval",
      "to": "ProvisionAccess",
      "condition": "true"
    },
    {
      "from": "DataStewardApproval",
      "to": "UpdateRequestStatusRejected",
      "condition": "false"
    },
    {
      "from": "ProvisionAccess",
      "to": "UpdateRequestStatusApproved"
    },
    {
      "from": "UpdateRequestStatusApproved",
      "to": "AccessGranted"
    },
    {
      "from": "UpdateRequestStatusRejected",
      "to": "AccessDenied"
    }
  ]
}
```

## User Flow (Immuta-Inspired)

### 1. Discovery & Request
1. User browses data catalog, finds Table "customer_transactions"
2. User lacks read access → sees "Request Access" button with lock icon
3. Clicks button → Opens request form modal
4. Fills form:
   - **Access Level**: Read
   - **Duration**: 90 days
   - **Business Justification**: "Building Q4 revenue dashboard for executive team"
   - **Project Name**: "Executive Analytics"
5. Submits request → Workflow triggered automatically

### 2. Approval Workflow
1. Workflow evaluates asset sensitivity (checks for PII tags)
2. Task created for Data Owner (assigned from asset owner field)
3. Data Owner receives in-app notification and email
4. Data Owner reviews request with full context:
   - **Who**: User profile, team, role history
   - **What**: Asset details, schema preview, sample data, lineage
   - **Why**: Business justification provided
   - **Risk**: Sensitivity tags (PII.Sensitive), compliance labels, usage patterns
5. Data Owner approves with comment: "Approved for executive dashboard project"
6. Since asset is tagged "PII.Sensitive" → Routes to Data Steward for 2nd approval
7. Data Steward reviews all context + Data Owner's approval
8. Data Steward approves with comment: "Access granted with 90-day expiry"

### 3. Access Provisioning
1. Automated task triggers: `GrantDataAccessTask`
2. Calls Snowflake reverse metadata connector:
   ```sql
   GRANT SELECT ON TABLE prod.sales.customer_transactions TO USER john_doe;

   -- Creates scheduled task for auto-revoke after 90 days
   CREATE TASK revoke_john_doe_access_20250401
     SCHEDULE = 'USING CRON 0 2 1 7 * UTC'
   AS
     REVOKE SELECT ON TABLE prod.sales.customer_transactions FROM USER john_doe;
   ```
3. Creates Policy entity in OpenMetadata:
   - **Policy Name**: "Access Grant - john_doe - customer_transactions"
   - **Rules**: `[{operation: SELECT, resources: [prod.sales.customer_transactions], principals: [john_doe]}]`
   - **Valid Until**: 2025-07-01 (90 days from approval)
   - **Enabled**: true
4. Updates DataAccessRequest entity:
   - **Status**: Approved
   - **ProvisioningStatus**: Completed
   - **GrantedPolicies**: [policy_uuid]
   - **ExpiresAt**: 1751414400000 (90 days timestamp)

### 4. Access Verification & Usage
1. User receives notifications:
   - In-app notification: "Your access request has been approved"
   - Email with access details and expiry date
2. User can now query the table in Snowflake directly
3. OpenMetadata tracks and displays:
   - **Active Grants** widget on asset page
   - Who has access (user list)
   - When granted (timestamp + approvers)
   - Why granted (justification link)
   - When expires (countdown)
4. Activity Feed shows: "john_doe was granted Read access to customer_transactions (expires in 90 days)"

### 5. Access Monitoring & Audit
1. Data Owners can view all active access grants on their assets
2. Governance dashboard shows:
   - Total active access requests
   - Pending approvals (by owner)
   - Expiring soon (next 7/30 days)
   - Access grant velocity trends
3. Audit log captures:
   - Request creation
   - Each approval action
   - Provisioning execution
   - SQL commands executed on source system

### 6. Access Revocation (Automatic)
1. Daily scheduled job checks `data_access_request` table for expired entries
2. After 90 days (expiry date reached):
   - Triggers revoke workflow automatically
   - Calls Snowflake connector:
     ```sql
     REVOKE SELECT ON TABLE prod.sales.customer_transactions FROM USER john_doe;
     ```
   - Updates Policy entity: `enabled = false`, `status = Expired`
   - Updates DataAccessRequest: `status = Expired`, `provisioningStatus = Revoked`
3. User receives notification: "Your access to customer_transactions has expired"
4. Activity Feed: "Access revoked for john_doe on customer_transactions (expired)"

### 7. Access Revocation (Manual)
- Data Owner can manually revoke access anytime:
  1. Navigate to asset page → "Access Grants" tab
  2. Find active grant → Click "Revoke"
  3. Provide reason: "Project completed early"
  4. Confirm → Same revoke workflow triggers immediately

## Implementation Phases

### Phase 1: Core Infrastructure (2-3 weeks)
**Sprint 1-2**
- [ ] Create DataAccessRequest JSON schema definition
- [ ] Generate Java/TypeScript models from schema
- [ ] Create database migration scripts (MySQL + PostgreSQL)
- [ ] Implement DataAccessRequestRepository with CRUD operations
- [ ] Build REST API endpoints (create, list, get, approve, reject)
- [ ] Add DataAccessRequest to Entity registry
- [ ] Write unit tests for repository and API

**Deliverable**: Backend API for managing access requests (no workflow yet)

### Phase 2: Workflow Integration (2-3 weeks)
**Sprint 3-4**
- [ ] Create dataAccessRequestTask workflow node schema
- [ ] Create grantDataAccessTask workflow node schema
- [ ] Implement GrantDataAccessTask.java (automated task handler)
- [ ] Enhance WorkflowHandler with `triggerDataAccessWorkflow()`
- [ ] Update nodeSubType.json enum with new node types
- [ ] Create sample DataAccessApprovalWorkflow.json
- [ ] Build workflow trigger mechanism from API
- [ ] Link workflow tasks to access requests
- [ ] Write integration tests for workflow execution

**Deliverable**: End-to-end workflow from request creation to approval (no provisioning yet)

### Phase 3: Frontend Components (2-3 weeks)
**Sprint 5-6**
- [ ] Create DataAccessRequestButton component
- [ ] Create DataAccessRequestForm with RJSF integration
- [ ] Build DataAccessRequestModal wrapper
- [ ] Implement DataAccessRequestList component
- [ ] Create DataAccessRequestTask component for approvers
- [ ] Add "Request Access" button to asset detail pages (Table, Dashboard, etc.)
- [ ] Build Access Grants tab for asset pages
- [ ] Create My Access Requests page
- [ ] Add access request notifications to Activity Feed
- [ ] Implement access request filters and search
- [ ] Write Playwright E2E tests for request flow

**Deliverable**: Full UI for requesting and approving access

### Phase 4: Reverse Connector Framework (3-4 weeks)
**Sprint 7-8**
- [ ] Design AccessPolicyConfig schema for reverse ingestion
- [ ] Create OMetaAccessPolicyMixin base class
- [ ] Implement AccessPolicyConnectorBase abstract class
- [ ] Build AccessPolicyConnectorFactory
- [ ] Create Snowflake access policy connector:
  - [ ] GRANT/REVOKE statements
  - [ ] Row-level security via secure views
  - [ ] Data masking policies
  - [ ] Time-limited grants with scheduled revoke
- [ ] Create BigQuery access policy connector:
  - [ ] IAM policy updates
  - [ ] Authorized views for RLS
  - [ ] Column-level security
  - [ ] Policy tags integration
- [ ] Implement access grant/revoke operations
- [ ] Add rollback/error handling
- [ ] Write connector unit and integration tests

**Deliverable**: Working access provisioning for Snowflake and BigQuery

### Phase 5: Policy Management (2 weeks)
**Sprint 9**
- [ ] Implement automatic Policy entity creation on approval
- [ ] Link granted policies to DataAccessRequest
- [ ] Build policy expiration tracking
- [ ] Create scheduled job for checking expired access
- [ ] Implement automatic revocation on expiry
- [ ] Add manual revoke capability
- [ ] Build policy audit trail
- [ ] Display active policies on asset pages

**Deliverable**: Complete policy lifecycle management

### Phase 6: Advanced Workflow Features (2-3 weeks)
**Sprint 10-11**
- [ ] Implement multi-level approval workflows
- [ ] Add conditional routing based on asset sensitivity
- [ ] Support custom form schemas per workflow
- [ ] Build approval threshold configuration
- [ ] Add rejection threshold support
- [ ] Implement approval comments and history
- [ ] Create workflow template library
- [ ] Add workflow analytics and metrics

**Deliverable**: Flexible, configurable approval workflows

### Phase 7: Additional Connectors (2-3 weeks)
**Sprint 12-13**
- [ ] Implement Redshift access policy connector
- [ ] Implement Databricks access policy connector
- [ ] Add support for Dashboard access (PowerBI, Tableau)
- [ ] Add support for Topic access (Kafka)
- [ ] Create connector documentation
- [ ] Build connector testing framework

**Deliverable**: Support for additional data platforms

### Phase 8: Governance & Analytics (2 weeks)
**Sprint 14**
- [ ] Build Access Governance Dashboard
  - Active requests by status
  - Pending approvals by owner
  - Access grant velocity
  - Time-to-approval metrics
  - Top requested assets
- [ ] Create access audit reports
- [ ] Implement access request analytics
- [ ] Add compliance reporting views
- [ ] Build access pattern insights
- [ ] Create access request trends visualization

**Deliverable**: Governance visibility and insights

### Phase 9: Advanced Security Features (2-3 weeks)
**Sprint 15-16**
- [ ] Implement row-level security policy creation
- [ ] Add column-level access control
- [ ] Build data masking policy support
- [ ] Create dynamic access rules (attribute-based)
- [ ] Implement break-glass emergency access
- [ ] Add access request rate limiting
- [ ] Build risk scoring for requests
- [ ] Create compliance validation rules

**Deliverable**: Fine-grained access control capabilities

### Phase 10: Documentation & Polish (1-2 weeks)
**Sprint 17**
- [ ] Write user documentation
  - Requesting access guide
  - Approval workflow guide
  - Admin configuration guide
- [ ] Create developer documentation
  - Custom connector development
  - Workflow customization
  - API reference
- [ ] Build video tutorials
- [ ] Add in-app help and tooltips
- [ ] Performance optimization
- [ ] Bug fixes and refinements
- [ ] Accessibility improvements

**Deliverable**: Production-ready feature with complete documentation

## Key Differentiators (vs Immuta)

### 1. **Open Source & Extensible**
- Fully open source under Collate Community License
- Customizable workflows via drag-and-drop builder
- Extensible connector framework
- Community-driven feature development

### 2. **Native Catalog Integration**
- Deep integration with OpenMetadata's unified catalog
- Leverages existing metadata (ownership, tags, lineage)
- Single source of truth for data assets and access
- No separate access management silo

### 3. **Multi-Platform Support**
- Not locked to specific data platforms
- Works with any system that has a connector
- Unified experience across databases, dashboards, topics, ML models
- Platform-agnostic policy enforcement

### 4. **Policy as Code**
- All policies version-controlled
- Git-friendly JSON definitions
- Audit trail for all policy changes
- Reproducible governance configuration

### 5. **Lineage-Aware Access Control**
- Access decisions informed by data lineage
- Understand downstream impact of access grants
- Propagate access through data pipelines
- Column-level lineage for fine-grained control

### 6. **Self-Service at Scale**
- Users request directly from catalog
- Owners approve with full context
- No centralized bottleneck
- Scales with organization growth

### 7. **Workflow Flexibility**
- Conditional approval routing
- Multi-level approval chains
- Custom form fields per asset type
- Dynamic assignee resolution (owners, stewards, teams)

### 8. **Comprehensive Audit**
- Every action logged and traceable
- Full approval chain visibility
- Provisioning execution history
- Compliance-ready audit reports

## Security Considerations

### Authentication & Authorization
- [ ] Validate approver permissions before task assignment
- [ ] Ensure requestor has catalog access to view asset
- [ ] Prevent privilege escalation (can't request Admin if user is Viewer)
- [ ] Role-based access to view/approve requests

### Data Protection
- [ ] Encrypt sensitive form data (justifications with PII)
- [ ] Mask sensitive asset metadata in notifications
- [ ] Secure API endpoints with proper authentication
- [ ] Rate-limit access request submissions

### Audit & Compliance
- [ ] Log all access grants and revocations
- [ ] Track approver identity and timestamp
- [ ] Store SQL statements executed on source systems
- [ ] Maintain immutable audit trail
- [ ] Generate compliance reports (SOX, GDPR, HIPAA)

### Access Control Best Practices
- [ ] Implement principle of least privilege by default
- [ ] Require business justification for all requests
- [ ] Enforce time-limited access (default max duration)
- [ ] Support break-glass access for emergencies with enhanced logging
- [ ] Prevent self-approval (owner can't approve own request)

### Source System Security
- [ ] Store credentials securely (encrypted, vault integration)
- [ ] Use service accounts with minimal privileges
- [ ] Validate SQL injection in filters
- [ ] Test rollback mechanisms
- [ ] Handle provisioning failures gracefully

### Privacy Considerations
- [ ] Don't expose sensitive data in workflow variables
- [ ] Sanitize justifications before storage
- [ ] Limit access to approval history
- [ ] Support data retention policies
- [ ] Allow users to withdraw requests

## Success Metrics

### User Experience
- Time to access (request → approval → provisioned): < 4 hours (target)
- Request approval rate: > 80%
- User satisfaction score: > 4.5/5

### Operational Efficiency
- Reduction in IT support tickets for access: > 60%
- Automated revocations: > 95% of expired access
- Provisioning success rate: > 98%

### Governance & Compliance
- Audit trail completeness: 100%
- Policy compliance rate: > 99%
- Access certification completion: > 90%

### Adoption
- % of access requests via self-service: > 75% (vs manual)
- Active workflows deployed: > 20 per organization
- Assets with access workflows: > 50%

## Future Enhancements (Post-MVP)

### Advanced Features
- [ ] AI-powered access recommendations
- [ ] Anomaly detection for unusual access patterns
- [ ] Automated access reviews and certifications
- [ ] Context-aware access (location, device, time)
- [ ] Access marketplace (pre-approved access packages)

### Integrations
- [ ] ServiceNow integration for ticketing
- [ ] Slack/Teams integration for approvals
- [ ] JIRA integration for project linking
- [ ] Identity provider integration (Okta, Azure AD)

### Analytics
- [ ] ML-based approval prediction
- [ ] Access pattern analysis
- [ ] Risk scoring models
- [ ] Usage-based access optimization

### Ecosystem
- [ ] Access policy templates marketplace
- [ ] Community-contributed connectors
- [ ] Industry-specific compliance presets
- [ ] Third-party integration plugins

# OpenMetadata Governance Workflows - Architecture & Implementation Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Implementation Details](#implementation-details)
4. [Workflow Triggers](#workflow-triggers)
5. [Workflow Nodes Catalog](#workflow-nodes-catalog)
6. [Custom Workflow Examples](#custom-workflow-examples)
7. [Best Practices](#best-practices)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenMetadata Platform                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │  REST API Layer  │────▶│ Workflow Service │                 │
│  └──────────────────┘     └──────────────────┘                 │
│           │                        │                            │
│           ▼                        ▼                            │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │ Entity Repository│     │ Workflow Handler │                 │
│  └──────────────────┘     └──────────────────┘                 │
│           │                        │                            │
│           ▼                        ▼                            │
│  ┌──────────────────────────────────────────┐                  │
│  │      WorkflowTransactionManager           │                  │
│  │  (Atomic Operations & Deployment)         │                  │
│  └──────────────────────────────────────────┘                  │
│                      │                                          │
│                      ▼                                          │
│  ┌──────────────────────────────────────────┐                  │
│  │         Flowable BPMN Engine              │                  │
│  │  ┌────────────┐  ┌──────────────┐        │                  │
│  │  │Process Def │  │Runtime Engine│        │                  │
│  │  └────────────┘  └──────────────┘        │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Components

1. **WorkflowTransactionManager**: Ensures atomic operations between OpenMetadata DB and Flowable engine
2. **WorkflowHandler**: Manages workflow lifecycle and validation
3. **WorkflowIdEncoder**: Base64 encoding for safe Flowable IDs (replacing dangerous truncation)
4. **Trigger System**: Event-based and Periodic batch processing
5. **Node System**: Modular, reusable workflow components

---

## Core Components

### 1. Transaction Management

```java
// WorkflowTransactionManager ensures atomicity
public class WorkflowTransactionManager {
    // Atomic store and deploy
    public WorkflowDefinition storeAndDeployWorkflowDefinition(
        WorkflowDefinition entity, boolean update) {
        // 1. Validate with Flowable
        // 2. Store in OpenMetadata DB
        // 3. Deploy to Flowable
        // 4. Rollback on failure
    }
    
    // Atomic update and redeploy
    public WorkflowDefinition updateAndRedeployWorkflowDefinition(
        WorkflowDefinition original, WorkflowDefinition updated) {
        // 1. Delete old deployment
        // 2. Update in DB
        // 3. Deploy new version
        // 4. Restore original on failure
    }
}
```

### 2. ID Encoding System

```java
// WorkflowIdEncoder - Safe ID generation
public class WorkflowIdEncoder {
    private static final int MAX_FLOWABLE_ID_LENGTH = 255;
    
    public static String generateSafeFlowableId(String... parts) {
        String combined = String.join("-", parts);
        String encoded = Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(combined.getBytes(StandardCharsets.UTF_8));
        
        if (encoded.length() > MAX_FLOWABLE_ID_LENGTH) {
            // Use hash for extremely long IDs
            String hash = generateHash(combined);
            return "id_" + hash;
        }
        return encoded;
    }
}
```

---

## Implementation Details

### New Implementations

#### 1. RollbackEntityImpl
Rolls back entities to their previous approved state without full rejection.

```java
@Slf4j
public class RollbackEntityImpl implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        // 1. Get entity reference
        // 2. Find previous approved version
        // 3. Create JSON patch to rollback
        // 4. Apply patch with proper attribution
        // 5. Log rollback action
    }
    
    private Double getPreviousApprovedVersion(
        EntityInterface entity, 
        EntityRepository<?> repository, 
        String rollbackToStatus) {
        // Iterate through entity history
        // Find last version with approved status
        // Return version number for rollback
    }
}
```

#### 2. DeprecateStaleEntityImpl
Marks entities as deprecated based on staleness criteria.

```java
@Slf4j
public class DeprecateStaleEntityImpl implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        // Handle both individual entities and batch processing
        Object relatedEntity = execution.getVariable(RELATED_ENTITY_VARIABLE);
        
        if (relatedEntity instanceof String) {
            // Entity link from periodic batch trigger
            MessageParser.EntityLink entityLink = 
                MessageParser.EntityLink.parse((String) relatedEntity);
        } else if (relatedEntity instanceof Map) {
            // Entity reference from event trigger
            EntityReference ref = JsonUtils.convertValue(
                relatedEntity, EntityReference.class);
        }
        
        // Check staleness and deprecate if needed
        if (isEntityStale(entity, thresholdTimestamp)) {
            deprecateEntity(repository, entity, message, user);
        }
    }
}
```

---

## Workflow Triggers

### 1. EventBasedEntityTrigger

Triggers workflows based on entity lifecycle events.

```yaml
Configuration:
  entityType: "Table"
  events: ["entityCreated", "entityUpdated", "entityDeleted"]
  filters: "database.name:production"
```

**Architecture:**
```
Entity Event → Event Listener → Filter Check → Workflow Execution
```

**Use Cases:**
- Auto-approval workflows for new entities
- Data quality checks on entity updates
- Cascade operations on entity deletion

### 2. PeriodicBatchEntityTrigger

Processes entities in batches on a schedule.

```yaml
Configuration:
  entityTypes: ["Table", "Dashboard", "Pipeline"]
  schedule:
    scheduleType: "Daily"
    hour: 2
  batchSize: 100
  filters: "owner.name:null"
```

**Architecture:**
```
Timer → Fetch Entities → Batch Processing → Multi-Instance Workflow
```

**Key Features:**
- Efficient batch processing with configurable size
- Multi-instance parallel execution
- Automatic pagination for large datasets

---

## Workflow Nodes Catalog

### Automated Task Nodes

#### 1. **SetEntityAttributeTask**
Sets attributes on entities programmatically.

**Configuration:**
```json
{
  "attribute": "tier",
  "value": "Tier.Gold"
}
```
**Outputs:** `result` (success/failure)
**Use Cases:** Standardize metadata, set owners, apply tags

#### 2. **ConditionalSetEntityAttributeTask**
Sets attributes based on conditions.

**Configuration:**
```json
{
  "conditions": [
    {
      "condition": "${dataQualityScore > 0.9}",
      "attribute": "tier",
      "value": "Tier.Gold"
    }
  ]
}
```
**Outputs:** `result` (success/failure)
**Use Cases:** Dynamic tier assignment, conditional tagging

#### 3. **CheckEntityAttributesTask**
Validates entity attributes against JsonLogic rules.

**Configuration:**
```json
{
  "rules": "{\"and\": [{\"!=\": [{\"var\": \"owner\"}, null]}, {\">=\": [{\"length\": {\"var\": \"description\"}}, 10]}]}"
}
```
**Outputs:** `result` (success/failure based on rule evaluation)
**Use Cases:** Enforce governance policies, validate metadata completeness

#### 4. **DataCompletenessTask** (NEW)
Evaluates entity data completeness with flexible quality bands.

**Configuration:**
```json
{
  "fieldsToCheck": ["name", "description", "owner", "tags", "columns[].description"],
  "qualityBands": [
    {"name": "gold", "minimumScore": 85},
    {"name": "silver", "minimumScore": 60},
    {"name": "bronze", "minimumScore": 30},
    {"name": "unacceptable", "minimumScore": 0}
  ],
  "treatEmptyStringAsNull": true,
  "treatEmptyArrayAsNull": true
}
```
**Outputs:** 
- `completenessScore` (numeric percentage)
- `qualityBand` (band name like "gold")
- `filledFieldsCount` (number)
- `totalFieldsCount` (number)
- `missingFields` (array of field names)
- `filledFields` (array of field names)
- `result` (quality band name for routing)

**Use Cases:** 
- Data quality gates before production
- Automated certification based on completeness
- Multi-tier approval workflows based on data quality

**Example Workflow Usage:**
```json
{
  "nodes": [
    {
      "name": "checkDataQuality",
      "type": "automatedTask",
      "subType": "dataCompletenessTask",
      "config": {
        "fieldsToCheck": ["description", "owner", "tags"],
        "qualityBands": [
          {"name": "auto-approve", "minimumScore": 90},
          {"name": "review", "minimumScore": 70},
          {"name": "enrich", "minimumScore": 50},
          {"name": "reject", "minimumScore": 0}
        ]
      }
    }
  ],
  "edges": [
    {
      "from": "checkDataQuality",
      "to": "autoApprove",
      "condition": "auto-approve"
    },
    {
      "from": "checkDataQuality",
      "to": "manualReview",
      "condition": "review"
    },
    {
      "from": "checkDataQuality",
      "to": "requestEnrichment",
      "condition": "enrich"
    },
    {
      "from": "checkDataQuality",
      "to": "reject",
      "condition": "reject"
    }
  ]
}
```

#### 5. **SetGlossaryTermStatusTask**
Manages glossary term lifecycle.

**Configuration:**
```json
{
  "status": "Approved"
}
```
**States:** Draft → Approved → Deprecated
**Outputs:** `result` (success/failure)

#### 6. **SetEntityCertificationTask**
Manages entity certification status.

**Configuration:**
```json
{
  "certification": "Gold",
  "message": "Certified after quality checks"
}
```
**Levels:** Bronze → Silver → Gold
**Outputs:** `result` (success/failure)

#### 7. **RollbackEntityTask**
Rollback entity to previous version.

**Configuration:**
```json
{
  "versionToRestore": "previousVersion"
}
```
**Outputs:** `result` (success/failure)
**Use Cases:** Undo changes without rejection, revert to last approved state

#### 8. **CreateAndRunIngestionPipelineTask**
Creates and executes ingestion pipelines.

**Configuration:**
```json
{
  "pipelineType": "profiler",
  "config": {
    "generateSampleData": true
  }
}
```
**Outputs:** `pipelineId`, `result`
**Use Cases:** Auto-profile new tables, schedule data quality scans

#### 9. **RunAppTask**
Executes OpenMetadata applications.

**Configuration:**
```json
{
  "appName": "DataQualityApp",
  "parameters": {
    "testSuite": "critical-tests"
  }
}
```
**Outputs:** `appExecutionId`, `result`

### User Task Nodes

#### 1. **UserApprovalTask**
Human approval step in workflow.

**Purpose:** Manual review and approval
**Features:**
- Assignee management
- Approval/rejection with comments
- Delegation support

### Control Flow Nodes

#### 1. **StartEvent**
Entry point of workflow.

#### 2. **EndEvent**
Termination point of workflow.

#### 3. **ParallelGateway**
Fork/join parallel execution paths.

---

## Custom Workflow Examples

### Example 1: Data Asset Lifecycle Management
**Trigger:** EventBasedEntityTrigger (Table creation)

```json
{
  "name": "tableLifecycleManagement",
  "displayName": "Table Lifecycle Management",
  "description": "Automated workflow for managing table lifecycle from creation to production",
  "type": "AUTOMATED",
  "trigger": {
    "triggerType": "eventBasedEntityTrigger",
    "config": {
      "entityType": "table",
      "events": ["entityCreated"],
      "filters": "database.name:production"
    }
  }
    
  "nodes": [
    {
      "name": "startEvent",
      "displayName": "Start",
      "nodeType": "startEvent",
      "config": {}
    },
    {
      "name": "validateMetadata",
      "displayName": "Validate Metadata",
      "nodeType": "checkEntityAttributesTask",
      "config": {
        "checks": [
          {
            "attribute": "description",
            "required": true,
            "minLength": 10
          },
          {
            "attribute": "owner",
            "required": true
          },
          {
            "attribute": "tags",
            "required": false
          }
        ]
      }
    },
    {
      "name": "setInitialTier",
      "displayName": "Set Initial Tier",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tier",
        "value": "Tier.Bronze"
      }
    },
    {
      "name": "approveProduction",
      "displayName": "Approve for Production",
      "nodeType": "userApprovalTask",
      "config": {
        "assignees": ["data-steward-team"],
        "description": "Review and approve table for production use"
      }
    },
    {
      "name": "promoteToSilver",
      "displayName": "Promote to Silver Tier",
      "nodeType": "conditionalSetEntityAttributeTask",
      "config": {
        "conditions": [
          {
            "condition": "${approved == true}",
            "attribute": "tier",
            "value": "Tier.Silver"
          }
        ]
      }
    },
    {
      "name": "endEvent",
      "displayName": "End",
      "nodeType": "endEvent",
      "config": {}
    }
  ],
  "edges": [
    {"from": "startEvent", "to": "validateMetadata"},
    {"from": "validateMetadata", "to": "setInitialTier"},
    {"from": "setInitialTier", "to": "approveProduction"},
    {"from": "approveProduction", "to": "promoteToSilver"},
    {"from": "promoteToSilver", "to": "endEvent"}
  ]
}
```

**Flow Explanation:**
1. New table triggers workflow
2. Validates required metadata
3. Parallel: Sets initial tier + Runs profiling
4. Waits for human approval
5. Promotes to Silver tier if approved

### Example 2: Stale Entity Deprecation
**Trigger:** PeriodicBatchEntityTrigger (Daily)

```json
{
  "name": "deprecateStaleAssets",
  "displayName": "Deprecate Stale Assets",
  "description": "Automatically deprecate entities that haven't been updated in 90 days",
  "type": "AUTOMATED",
  "trigger": {
    "triggerType": "periodicBatchEntityTrigger",
    "config": {
      "entityTypes": ["table", "dashboard"],
      "schedule": {
        "scheduleType": "Daily",
        "hour": 2,
        "minute": 0
      },
      "batchSize": 50,
      "filters": "tier.tagFQN:Tier.Bronze"
    }
  }
    
  "nodes": [
    {
      "name": "startEvent",
      "displayName": "Start",
      "nodeType": "startEvent",
      "config": {}
    },
    {
      "name": "checkAndDeprecate",
      "displayName": "Check and Deprecate Stale Entities",
      "nodeType": "deprecateStaleEntityTask",
      "config": {
        "staleDays": 90,
        "deprecationMessage": "Auto-deprecated due to 90 days of inactivity"
      }
    },
    {
      "name": "endEvent",
      "displayName": "End",
      "nodeType": "endEvent",
      "config": {}
    }
  ],
  "edges": [
    {"from": "startEvent", "to": "checkAndDeprecate"},
    {"from": "checkAndDeprecate", "to": "endEvent"}
  ]
}
```

**Flow Explanation:**
1. Runs daily at 2 AM
2. Fetches Bronze tier entities in batches
3. Checks last update > 90 days
4. Marks as deprecated
5. Notifies owners via email

### Example 3: Glossary Term Approval Workflow
**Trigger:** EventBasedEntityTrigger (GlossaryTerm creation)

```json
{
  "name": "glossaryTermGovernance",
  "displayName": "Glossary Term Governance",
  "description": "Approval workflow for business glossary terms",
  "type": "APPROVAL",
  "trigger": {
    "triggerType": "eventBasedEntityTrigger",
    "config": {
      "entityType": "glossaryTerm",
      "events": ["entityCreated", "entityUpdated"]
    }
  }
    
  "nodes": [
    {
      "name": "startEvent",
      "displayName": "Start",
      "nodeType": "startEvent",
      "config": {}
    },
    {
      "name": "setDraftStatus",
      "displayName": "Set Draft Status",
      "nodeType": "setGlossaryTermStatusTask",
      "config": {
        "status": "Draft"
      }
    },
    {
      "name": "validateTerm",
      "displayName": "Validate Term Definition",
      "nodeType": "checkEntityAttributesTask",
      "config": {
        "checks": [
          {
            "attribute": "definition",
            "required": true,
            "minLength": 50
          },
          {
            "attribute": "relatedTerms",
            "required": false
          },
          {
            "attribute": "synonyms",
            "required": false
          }
        ]
      }
    },
    {
      "name": "businessApproval",
      "displayName": "Business Team Approval",
      "nodeType": "userApprovalTask",
      "config": {
        "assignees": ["business-glossary-team"],
        "description": "Review and approve glossary term definition"
      }
    },
    {
      "name": "setApprovedStatus",
      "displayName": "Set Approved Status",
      "nodeType": "setGlossaryTermStatusTask",
      "config": {
        "status": "Approved"
      }
    },
    {
      "name": "rollbackToDraft",
      "displayName": "Rollback to Draft",
      "nodeType": "rollbackEntityTask",
      "config": {
        "rollbackToStatus": "Draft"
      }
    },
    {
      "name": "endEvent",
      "displayName": "End",
      "nodeType": "endEvent",
      "config": {}
    }
  ],
  "edges": [
    {"from": "startEvent", "to": "setDraftStatus"},
    {"from": "setDraftStatus", "to": "validateTerm"},
    {"from": "validateTerm", "to": "businessApproval"},
    {
      "from": "businessApproval",
      "to": "setApprovedStatus",
      "condition": "${approved == true}"
    },
    {
      "from": "businessApproval",
      "to": "rollbackToDraft",
      "condition": "${approved == false}"
    },
    {"from": "setApprovedStatus", "to": "endEvent"},
    {"from": "rollbackToDraft", "to": "endEvent"}
  ]
}
```

**Flow Explanation:**
1. New/updated glossary term triggers workflow
2. Sets status to Draft
3. Validates definition quality
4. Routes to business team for approval
5. Approves or rolls back based on decision

### Example 4: Data Quality Certification Pipeline
**Trigger:** PeriodicBatchEntityTrigger (Weekly)

```json
{
  "name": "dataQualityCertification",
  "displayName": "Data Quality Certification",
  "description": "Weekly data quality checks and certification for analytics tables",
  "type": "AUTOMATED",
  "trigger": {
    "triggerType": "periodicBatchEntityTrigger",
    "config": {
      "entityType": "table",
      "schedule": {
        "scheduleType": "Weekly",
        "dayOfWeek": 1,
        "hour": 3,
        "minute": 0
      },
      "filters": "database.name:analytics AND tier.tagFQN:Tier.Silver",
      "batchSize": 25
    }
  }
    
  "nodes": [
    {
      "name": "startEvent",
      "displayName": "Start",
      "nodeType": "startEvent",
      "config": {}
    },
    {
      "name": "checkQualityMetrics",
      "displayName": "Check Quality Metrics",
      "nodeType": "checkEntityAttributesTask",
      "config": {
        "checks": [
          {
            "attribute": "dataQualityScore",
            "required": true,
            "customCheck": "${dataQualityScore > 0.95}"
          }
        ]
      }
    },
    {
      "name": "certifyGold",
      "displayName": "Certify as Gold",
      "nodeType": "setEntityCertificationTask",
      "config": {
        "certification": "Gold",
        "message": "Certified Gold tier based on quality checks"
      }
    },
    {
      "name": "addQualityTags",
      "displayName": "Add Quality Tags",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tags",
        "value": ["high-quality", "certified", "gold-tier"]
      }
    },
    {
      "name": "endEvent",
      "displayName": "End",
      "nodeType": "endEvent",
      "config": {}
    }
  ],
  "edges": [
    {"from": "startEvent", "to": "checkQualityMetrics"},
    {"from": "checkQualityMetrics", "to": "certifyGold"},
    {"from": "certifyGold", "to": "addQualityTags"},
    {"from": "addQualityTags", "to": "endEvent"}
  ]
}
```

**Flow Explanation:**
1. Weekly scan of Silver tier analytics tables
2. Runs comprehensive quality checks
3. Evaluates quality score
4. Parallel: Certifies as Gold + Adds quality tags
5. Updates metrics dashboard

### Example 5: Incident Response Workflow
**Trigger:** EventBasedEntityTrigger (Incident creation)

```json
{
  "name": "dataIncidentResponse",
  "displayName": "Data Incident Response",
  "description": "Automated incident response workflow for data quality issues",
  "type": "AUTOMATED",
  "trigger": {
    "triggerType": "eventBasedEntityTrigger",
    "config": {
      "entityType": "table",
      "events": ["entityUpdated"],
      "filters": "tags.tagFQN:incident-reported"
    }
  }
    
  "nodes": [
    {
      "name": "startEvent",
      "displayName": "Start",
      "nodeType": "startEvent",
      "config": {}
    },
    {
      "name": "markIncident",
      "displayName": "Mark Incident Active",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tags",
        "value": ["incident-active", "under-investigation"]
      }
    },
    {
      "name": "triageIncident",
      "displayName": "Triage Incident",
      "nodeType": "userApprovalTask",
      "config": {
        "assignees": ["data-ops-team"],
        "description": "Triage data incident and determine action"
      }
    },
    {
      "name": "rollbackIfNeeded",
      "displayName": "Rollback if Needed",
      "nodeType": "rollbackEntityTask",
      "config": {
        "rollbackToStatus": "Approved"
      }
    },
    {
      "name": "deprecateIfCorrupted",
      "displayName": "Deprecate if Corrupted",
      "nodeType": "deprecateStaleEntityTask",
      "config": {
        "staleDays": 0,
        "deprecationMessage": "Deprecated due to data corruption incident"
      }
    },
    {
      "name": "resolveIncident",
      "displayName": "Resolve Incident",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tags",
        "value": ["incident-resolved"]
      }
    },
    {
      "name": "endEvent",
      "displayName": "End",
      "nodeType": "endEvent",
      "config": {}
    }
  ],
  "edges": [
    {"from": "startEvent", "to": "markIncident"},
    {"from": "markIncident", "to": "triageIncident"},
    {
      "from": "triageIncident",
      "to": "rollbackIfNeeded",
      "condition": "${requiresRollback == true}"
    },
    {
      "from": "triageIncident",
      "to": "deprecateIfCorrupted",
      "condition": "${dataCorrupted == true}"
    },
    {
      "from": "triageIncident",
      "to": "resolveIncident",
      "condition": "${resolved == true}"
    },
    {"from": "rollbackIfNeeded", "to": "resolveIncident"},
    {"from": "deprecateIfCorrupted", "to": "resolveIncident"},
    {"from": "resolveIncident", "to": "endEvent"}
  ]
}
```

**Flow Explanation:**
1. Incident reported on table
2. Tags entity with incident markers
3. Routes to ops team for triage
4. Notifies based on priority
5. Rolls back if needed
6. Deprecates if data corrupted
7. Marks incident as resolved

### Example 6: Complete Data Governance Pipeline
**Trigger:** EventBasedEntityTrigger for new tables

```json
{
  "name": "enterpriseDataGovernance",
  "displayName": "Enterprise Data Governance Pipeline",
  "description": "Comprehensive governance workflow combining multiple checks and certifications",
  "type": "AUTOMATED",
  "trigger": {
    "triggerType": "eventBasedEntityTrigger",
    "config": {
      "entityType": "table",
      "events": ["entityCreated", "entityUpdated"],
      "filters": "database.name:enterprise"
    }
  }
      
  "nodes": [
    {
      "name": "startEvent",
      "displayName": "Start",
      "nodeType": "startEvent",
      "config": {}
    },
    {
      "name": "validateMetadata",
      "displayName": "Validate Required Metadata",
      "nodeType": "checkEntityAttributesTask",
      "config": {
        "checks": [
          {
            "attribute": "description",
            "required": true,
            "minLength": 20
          },
          {
            "attribute": "owner",
            "required": true
          },
          {
            "attribute": "tier",
            "required": true
          }
        ]
      }
    },
    {
      "name": "classifyData",
      "displayName": "Classify Data Sensitivity",
      "nodeType": "conditionalSetEntityAttributeTask",
      "config": {
        "conditions": [
          {
            "condition": "${contains(tags, 'PII')}",
            "attribute": "tags",
            "value": ["data-classification:restricted"]
          },
          {
            "condition": "${contains(tags, 'financial')}",
            "attribute": "tags",
            "value": ["data-classification:confidential"]
          },
          {
            "condition": "${true}",
            "attribute": "tags",
            "value": ["data-classification:internal"]
          }
        ]
      }
    },
    {
      "name": "applyRetentionPolicy",
      "displayName": "Apply Retention Policy",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "extension",
        "value": {
          "retentionPeriod": "7years",
          "deletionDate": "2031-12-31"
        }
      }
    },
    {
      "name": "dataQualityCheck",
      "displayName": "Data Quality Assessment",
      "nodeType": "checkEntityAttributesTask",
      "config": {
        "checks": [
          {
            "attribute": "columns",
            "required": true,
            "customCheck": "${columns.length > 0}"
          }
        ]
      }
    },
    {
      "name": "technicalApproval",
      "displayName": "Technical Team Approval",
      "nodeType": "userApprovalTask",
      "config": {
        "assignees": ["data-engineering-team"],
        "description": "Review technical specifications and data quality"
      }
    },
    {
      "name": "businessApproval",
      "displayName": "Business Team Approval",
      "nodeType": "userApprovalTask",
      "config": {
        "assignees": ["business-team"],
        "description": "Validate business logic and data definitions"
      }
    },
    {
      "name": "certifyForProduction",
      "displayName": "Certify for Production",
      "nodeType": "setEntityCertificationTask",
      "config": {
        "certification": "Production-Ready",
        "message": "Certified for production use after comprehensive review"
      }
    },
    {
      "name": "promoteToGold",
      "displayName": "Promote to Gold Tier",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tier",
        "value": "Tier.Gold"
      }
    },
    {
      "name": "addGovernanceTags",
      "displayName": "Add Governance Tags",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tags",
        "value": [
          "governance:approved",
          "quality:verified",
          "compliance:checked"
        ]
      }
    },
    {
      "name": "endEvent",
      "displayName": "End",
      "nodeType": "endEvent",
      "config": {}
    }
  ],
  "edges": [
    {"from": "startEvent", "to": "validateMetadata"},
    {"from": "validateMetadata", "to": "classifyData"},
    {"from": "classifyData", "to": "applyRetentionPolicy"},
    {"from": "applyRetentionPolicy", "to": "dataQualityCheck"},
    {"from": "dataQualityCheck", "to": "technicalApproval"},
    {"from": "technicalApproval", "to": "businessApproval"},
    {
      "from": "businessApproval",
      "to": "certifyForProduction",
      "condition": "${approved == true}"
    },
    {"from": "certifyForProduction", "to": "promoteToGold"},
    {"from": "promoteToGold", "to": "addGovernanceTags"},
    {"from": "addGovernanceTags", "to": "endEvent"},
    {
      "from": "businessApproval",
      "to": "endEvent",
      "condition": "${approved == false}"
    }
  ]
}
```

**Flow Explanation:**
1. Triggered by new or updated enterprise tables
2. Validates required metadata (description, owner, tier)
3. Classifies data sensitivity based on tags
4. Applies retention policy based on classification
5. Performs data quality assessment
6. Routes through technical and business approvals
7. Certifies for production and promotes to Gold tier
8. Adds governance tags to indicate completion

### Example 7: Periodic Batch Cleanup
**Trigger:** PeriodicBatchEntityTrigger (Monthly)

```json
{
  "name": "monthlyDataCleanup",
  "displayName": "Monthly Data Cleanup",
  "description": "Monthly cleanup of test and temporary tables",
  "type": "AUTOMATED",
  "trigger": {
    "triggerType": "periodicBatchEntityTrigger",
    "config": {
      "entityTypes": ["table", "dashboard", "pipeline"],
      "schedule": {
        "scheduleType": "Monthly",
        "dayOfMonth": 1,
        "hour": 1,
        "minute": 0
      },
      "batchSize": 100,
      "filters": "tags.tagFQN:temporary OR tags.tagFQN:test"
    }
  },
  "nodes": [
    {
      "name": "startEvent",
      "displayName": "Start",
      "nodeType": "startEvent",
      "config": {}
    },
    {
      "name": "checkAge",
      "displayName": "Check Entity Age",
      "nodeType": "checkEntityAttributesTask",
      "config": {
        "checks": [
          {
            "attribute": "updatedAt",
            "customCheck": "${(currentTime - updatedAt) > 2592000000}"
          }
        ]
      }
    },
    {
      "name": "deprecateOldEntities",
      "displayName": "Deprecate Old Test Entities",
      "nodeType": "deprecateStaleEntityTask",
      "config": {
        "staleDays": 30,
        "deprecationMessage": "Deprecated: Test/temporary entity older than 30 days"
      }
    },
    {
      "name": "tagForDeletion",
      "displayName": "Tag for Future Deletion",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tags",
        "value": ["pending-deletion", "cleanup-scheduled"]
      }
    },
    {
      "name": "endEvent",
      "displayName": "End",
      "nodeType": "endEvent",
      "config": {}
    }
  ],
  "edges": [
    {"from": "startEvent", "to": "checkAge"},
    {"from": "checkAge", "to": "deprecateOldEntities"},
    {"from": "deprecateOldEntities", "to": "tagForDeletion"},
    {"from": "tagForDeletion", "to": "endEvent"}
  ]
}
```

**Flow Explanation:**
1. Runs monthly on the 1st at 1 AM
2. Fetches all entities tagged as temporary or test
3. Checks if they're older than 30 days
4. Deprecates old test entities
5. Tags them for future deletion

### Example 8: Multi-Stage Approval with Rollback
**Trigger:** EventBasedEntityTrigger (Pipeline changes)

```json
{
  "name": "pipelineChangeApproval",
  "displayName": "Pipeline Change Approval",
  "description": "Multi-stage approval for critical pipeline changes with rollback capability",
  "type": "APPROVAL",
  "trigger": {
    "triggerType": "eventBasedEntityTrigger",
    "config": {
      "entityType": "pipeline",
      "events": ["entityUpdated"],
      "filters": "tags.tagFQN:critical"
    }
  },
  "nodes": [
    {
      "name": "startEvent",
      "displayName": "Start",
      "nodeType": "startEvent",
      "config": {}
    },
    {
      "name": "freezePipeline",
      "displayName": "Freeze Pipeline Execution",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tags",
        "value": ["execution:frozen", "approval:pending"]
      }
    },
    {
      "name": "technicalReview",
      "displayName": "Technical Review",
      "nodeType": "userApprovalTask",
      "config": {
        "assignees": ["pipeline-engineering-team"],
        "description": "Review technical changes to critical pipeline"
      }
    },
    {
      "name": "securityReview",
      "displayName": "Security Review",
      "nodeType": "userApprovalTask",
      "config": {
        "assignees": ["security-team"],
        "description": "Review security implications of pipeline changes"
      }
    },
    {
      "name": "finalApproval",
      "displayName": "Management Approval",
      "nodeType": "userApprovalTask",
      "config": {
        "assignees": ["data-management"],
        "description": "Final approval for critical pipeline changes"
      }
    },
    {
      "name": "applyChanges",
      "displayName": "Apply Approved Changes",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tags",
        "value": ["execution:active", "approval:completed", "changes:applied"]
      }
    },
    {
      "name": "rollbackChanges",
      "displayName": "Rollback Changes",
      "nodeType": "rollbackEntityTask",
      "config": {
        "rollbackToStatus": "Approved"
      }
    },
    {
      "name": "notifyRollback",
      "displayName": "Tag as Rolled Back",
      "nodeType": "setEntityAttributeTask",
      "config": {
        "attribute": "tags",
        "value": ["execution:active", "changes:rolled-back"]
      }
    },
    {
      "name": "endEvent",
      "displayName": "End",
      "nodeType": "endEvent",
      "config": {}
    }
  ],
  "edges": [
    {"from": "startEvent", "to": "freezePipeline"},
    {"from": "freezePipeline", "to": "technicalReview"},
    {
      "from": "technicalReview",
      "to": "securityReview",
      "condition": "${approved == true}"
    },
    {
      "from": "securityReview",
      "to": "finalApproval",
      "condition": "${approved == true}"
    },
    {
      "from": "finalApproval",
      "to": "applyChanges",
      "condition": "${approved == true}"
    },
    {"from": "applyChanges", "to": "endEvent"},
    {
      "from": "technicalReview",
      "to": "rollbackChanges",
      "condition": "${approved == false}"
    },
    {
      "from": "securityReview",
      "to": "rollbackChanges",
      "condition": "${approved == false}"
    },
    {
      "from": "finalApproval",
      "to": "rollbackChanges",
      "condition": "${approved == false}"
    },
    {"from": "rollbackChanges", "to": "notifyRollback"},
    {"from": "notifyRollback", "to": "endEvent"}
  ]
}
```

**Flow Explanation:**
1. Triggered when critical pipelines are updated
2. Immediately freezes pipeline execution
3. Goes through 3-stage approval (technical, security, management)
4. If any stage rejects, rolls back to previous approved version
5. If all approve, applies changes and reactivates pipeline
6. Tags entity with appropriate status throughout

---

## Best Practices

### 1. Workflow Design Principles

- **Idempotency**: Ensure workflows can be safely re-run
- **Error Handling**: Use boundary events for exception handling
- **Atomicity**: Leverage WorkflowTransactionManager for critical operations
- **Modularity**: Create reusable node configurations
- **Observability**: Log key decision points and state changes

### 2. Performance Optimization

```java
// Batch Processing Best Practices
PeriodicBatchEntityTrigger:
  - Keep batchSize between 25-100 for optimal performance
  - Use filters to reduce initial dataset
  - Implement pagination for large result sets
  - Consider parallel processing for independent operations
```

### 3. Security Considerations

- **Authentication**: All workflows run with service account privileges
- **Authorization**: Validate user permissions in approval tasks
- **Audit Trail**: All workflow actions are logged with attribution
- **Data Privacy**: Mask sensitive data in logs and notifications

### 4. Testing Strategy

```java
// Unit Testing
- Test individual node implementations
- Mock Flowable execution context
- Verify JSON patch generation

// Integration Testing
- Test complete workflow execution
- Verify transaction rollback scenarios
- Test trigger conditions

// Load Testing
- Test batch processing with large datasets
- Verify concurrent workflow execution
- Monitor resource utilization
```

### 5. Monitoring & Alerting

```yaml
Key Metrics:
  - Workflow execution time
  - Success/failure rates
  - Queue depth for batch processing
  - User task response times
  
Alerts:
  - Workflow failures > threshold
  - Stuck workflows (no progress > 24h)
  - Transaction rollback events
  - Deprecation of critical assets
```

---

## Migration Guide

### From Legacy Workflows

1. **ID Migration**: Replace truncated IDs with base64 encoded IDs
2. **Transaction Safety**: Wrap deployments in WorkflowTransactionManager
3. **Batch Processing**: Migrate from single entity to batch triggers
4. **Status Management**: Use proper status enums (Draft/Approved/Deprecated)

### Version Compatibility

- **Flowable**: 6.7.2+ required
- **OpenMetadata**: 1.4.0+ required
- **Java**: 17+ required
- **Database**: MySQL 8.0+ or PostgreSQL 12+

---

## Advanced Patterns

### 1. Workflow Composition

```yaml
# Parent workflow that orchestrates child workflows
name: "Master Data Governance"
nodes:
  - callActivity:
      id: "qualityWorkflow"
      calledElement: "Data Quality Certification"
      
  - callActivity:
      id: "complianceWorkflow"
      calledElement: "Enterprise Data Governance"
      
  - callActivity:
      id: "lifecycleWorkflow"
      calledElement: "Table Lifecycle Management"
```

### 2. Dynamic Workflow Generation

```java
// Generate workflows based on metadata
public WorkflowDefinition generateWorkflow(EntityType type) {
    WorkflowDefinitionBuilder builder = new WorkflowDefinitionBuilder();
    
    // Add nodes based on entity type
    if (type.requiresApproval()) {
        builder.addNode(new UserApprovalTask());
    }
    
    if (type.hasQualityChecks()) {
        builder.addNode(new RunAppTask("quality-checker"));
    }
    
    return builder.build();
}
```

### 3. Event-Driven Orchestration

```yaml
# Chain workflows through events
workflow1:
  endEvent:
    type: "signal"
    signal: "workflow1Complete"
    
workflow2:
  startEvent:
    type: "signal"
    signal: "workflow1Complete"
```

---

## Troubleshooting Guide

### Common Issues

1. **Workflow Not Triggering**
   - Check trigger configuration matches entity type
   - Verify filters are not too restrictive
   - Ensure Flowable engine is running

2. **Transaction Rollback**
   - Check logs for validation errors
   - Verify entity permissions
   - Ensure database connectivity

3. **Performance Issues**
   - Reduce batch size for large datasets
   - Optimize filters to reduce initial query
   - Consider async processing for heavy operations

---

## UI Implementation Guide

### Overview
The UI for Governance Workflows should provide an intuitive drag-and-drop interface for creating workflows without code. This section provides detailed guidelines for UI developers.

### Workflow Builder Components

#### 1. Node Palette
Display available nodes categorized by type:

```javascript
const nodePalette = {
  "Automated Tasks": [
    {
      id: "setEntityAttribute",
      icon: "SettingsIcon",
      label: "Set Attribute",
      description: "Set entity attributes"
    },
    {
      id: "dataCompleteness",
      icon: "CheckCircleIcon",
      label: "Data Completeness",
      description: "Check data quality score"
    },
    {
      id: "checkEntityAttributes",
      icon: "VerifiedIcon",
      label: "Check Attributes",
      description: "Validate with rules"
    }
  ],
  "User Tasks": [
    {
      id: "userApproval",
      icon: "PersonIcon",
      label: "User Approval",
      description: "Manual approval step"
    }
  ],
  "Control Flow": [
    {
      id: "parallelGateway",
      icon: "ForkIcon",
      label: "Parallel Gateway",
      description: "Split/join paths"
    }
  ]
};
```

#### 2. Node Configuration Forms

##### DataCompletenessTask Form
```javascript
const DataCompletenessForm = {
  fieldsToCheck: {
    type: "multiselect",
    label: "Fields to Check",
    placeholder: "Select entity fields...",
    dataSource: "entityFields", // Dynamic based on entity type
    required: true,
    helpText: "Select fields to evaluate for completeness"
  },
  qualityBands: {
    type: "dynamic-list",
    label: "Quality Bands",
    minItems: 1,
    fields: {
      name: {
        type: "text",
        placeholder: "Band name (e.g., gold)",
        required: true
      },
      minimumScore: {
        type: "number",
        min: 0,
        max: 100,
        placeholder: "Minimum %",
        required: true
      }
    },
    default: [
      {name: "excellent", minimumScore: 90},
      {name: "good", minimumScore: 70},
      {name: "acceptable", minimumScore: 50},
      {name: "poor", minimumScore: 0}
    ],
    helpText: "Define quality levels from highest to lowest score"
  },
  treatEmptyStringAsNull: {
    type: "checkbox",
    label: "Treat empty strings as missing",
    default: true
  },
  treatEmptyArrayAsNull: {
    type: "checkbox",
    label: "Treat empty arrays as missing",
    default: true
  }
};
```

##### CheckEntityAttributesTask Form
```javascript
const CheckEntityAttributesForm = {
  rules: {
    type: "queryBuilder",
    label: "Validation Rules",
    format: "jsonlogic",
    entityType: "dynamic", // From workflow context
    operators: [
      "equals", "notEquals", "contains", "startsWith",
      "greaterThan", "lessThan", "isNull", "isNotNull",
      "length", "isOwner", "isReviewer",
      "isUpdatedBefore", "isUpdatedAfter",
      "fieldCompleteness" // Custom operator
    ],
    helpText: "Define rules using JsonLogic format"
  }
};
```

#### 3. Edge Configuration

```javascript
const EdgeConfiguration = {
  condition: {
    type: "select",
    label: "Routing Condition",
    dataSource: "previousNodeOutputs", // Dynamic based on source node
    placeholder: "Select condition...",
    examples: {
      dataCompleteness: ["gold", "silver", "bronze", "unacceptable"],
      checkEntityAttributes: ["success", "failure"],
      userApproval: ["approved", "rejected"]
    }
  }
};
```

### Variable Mapping UI

#### Input Namespace Map
Show how nodes can use outputs from previous nodes:

```javascript
const VariableMappingUI = {
  inputNamespaceMap: {
    type: "mapping",
    label: "Input Variables",
    columns: [
      {
        name: "variable",
        label: "Variable Name",
        type: "select",
        options: ["relatedEntity", "completenessScore", "missingFields"]
      },
      {
        name: "source",
        label: "Source Node",
        type: "select",
        options: ["global", ...previousNodeNames]
      }
    ],
    helpText: "Map variables from previous nodes or global context"
  }
};
```

### Visual Workflow Designer

#### Canvas Features
1. **Drag & Drop**: Nodes from palette to canvas
2. **Connection Mode**: Click source node, then target node to create edge
3. **Auto-Layout**: Automatic arrangement of nodes
4. **Zoom & Pan**: Navigate large workflows
5. **Validation Indicators**: Show errors/warnings on nodes

#### Node Visualization
```javascript
const NodeVisualization = {
  base: {
    width: 180,
    height: 60,
    borderRadius: 8,
    padding: 12
  },
  states: {
    default: { border: "1px solid #d9d9d9" },
    selected: { border: "2px solid #1890ff" },
    error: { border: "2px solid #ff4d4f" },
    warning: { border: "2px solid #faad14" }
  },
  content: {
    icon: { size: 24, position: "left" },
    label: { fontSize: 14, fontWeight: 500 },
    subtitle: { fontSize: 12, color: "#8c8c8c" },
    outputs: { position: "bottom", fontSize: 10 }
  }
};
```

### Workflow Templates

Provide pre-built templates users can customize:

```javascript
const workflowTemplates = [
  {
    name: "Data Quality Gate",
    description: "Check completeness before production",
    template: {
      nodes: [
        {
          name: "qualityCheck",
          type: "dataCompleteness",
          config: {
            fieldsToCheck: ["name", "description", "owner"],
            qualityBands: [
              {name: "production-ready", minimumScore: 90},
              {name: "needs-review", minimumScore: 70},
              {name: "draft", minimumScore: 0}
            ]
          }
        },
        {
          name: "approve",
          type: "userApproval",
          config: {
            assignees: ["data-steward"]
          }
        }
      ],
      edges: [
        {
          from: "qualityCheck",
          to: "approve",
          condition: "needs-review"
        }
      ]
    }
  }
];
```

### Validation & Error Handling

#### Real-time Validation
```javascript
const ValidationRules = {
  workflow: {
    hasStartNode: "Workflow must have exactly one start node",
    hasEndNode: "Workflow must have at least one end node",
    allNodesConnected: "All nodes must be connected",
    noCycles: "Workflow cannot have cycles (except with gateways)"
  },
  node: {
    uniqueName: "Node names must be unique",
    requiredConfig: "All required configuration must be provided",
    validOutputReferences: "Output references must exist"
  },
  edge: {
    validCondition: "Condition must match source node outputs",
    noSelfLoop: "Nodes cannot connect to themselves"
  }
};
```

### Testing & Preview

#### Workflow Simulator
```javascript
const WorkflowSimulator = {
  testData: {
    entity: "Select or create test entity",
    initialVariables: "Set initial variable values"
  },
  execution: {
    stepThrough: "Execute node by node",
    breakpoints: "Set breakpoints on nodes",
    variableInspector: "View variables at each step"
  },
  results: {
    path: "Show execution path",
    outputs: "Display final outputs",
    errors: "List any errors encountered"
  }
};
```

### Best Practices for UI Implementation

1. **Progressive Disclosure**: Show basic options first, advanced in expandable sections
2. **Contextual Help**: Tooltips and inline documentation
3. **Smart Defaults**: Pre-fill common configurations
4. **Undo/Redo**: Support workflow editing history
5. **Auto-Save**: Periodically save drafts
6. **Keyboard Shortcuts**: 
   - `Ctrl+Z` - Undo
   - `Ctrl+Y` - Redo
   - `Delete` - Remove selected node
   - `Ctrl+D` - Duplicate node
7. **Export/Import**: Support JSON export/import of workflows

### Integration with Backend

#### API Calls
```javascript
// Validate workflow
POST /api/v1/governance/workflows/validate
{
  "workflow": workflowDefinition
}

// Get available fields for entity type
GET /api/v1/metadata/types/{entityType}/fields

// Get custom operators
GET /api/v1/system/config/customLogicOps

// Test workflow execution
POST /api/v1/governance/workflows/test
{
  "workflow": workflowDefinition,
  "testEntity": entityId
}
```

### Performance Considerations

1. **Lazy Loading**: Load node configurations only when needed
2. **Virtualization**: For workflows with many nodes
3. **Debouncing**: Validation and auto-save
4. **Caching**: Entity fields and operator definitions
5. **Web Workers**: Complex workflow validation

---

## Conclusion

The OpenMetadata Governance Workflow system provides a robust, extensible framework for implementing complex data governance policies. The architecture ensures:

1. **Reliability** through atomic transactions and proper error handling
2. **Scalability** through batch processing and parallel execution
3. **Flexibility** through modular, reusable components
4. **Governance** through comprehensive audit trails and approval workflows

The combination of EventBasedEntityTrigger and PeriodicBatchEntityTrigger enables both reactive and proactive governance, while the rich set of task nodes supports virtually any governance scenario.

---

## Appendix

### A. JSON Schema Definitions

All workflow nodes have corresponding JSON schemas in:
```
/openmetadata-spec/src/main/resources/json/schema/governance/workflows/elements/nodes/
```

### B. BPMN XML Generation

Workflows are compiled to BPMN 2.0 XML for Flowable execution:
```java
BpmnXMLConverter converter = new BpmnXMLConverter();
String bpmnXml = new String(converter.convertToXML(workflow.getMainModel()));
```

### C. Database Schema

Workflow definitions stored in:
- `workflow_definition` table (OpenMetadata DB)
- `ACT_RE_DEPLOYMENT` table (Flowable DB)
- `ACT_RE_PROCDEF` table (Flowable process definitions)

### D. REST API Endpoints

```
POST   /api/v1/governance/workflows          - Create workflow
GET    /api/v1/governance/workflows/{id}     - Get workflow
PUT    /api/v1/governance/workflows/{id}     - Update workflow
DELETE /api/v1/governance/workflows/{id}     - Delete workflow
POST   /api/v1/governance/workflows/{id}/run - Trigger workflow
```

---

*Document Version: 1.0*  
*Last Updated: 2024*  
*Author: Senior Architect - Governance Workflows Team*
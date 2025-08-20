# OpenMetadata Governance Workflows - Architecture & Implementation Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Implementation Details](#implementation-details)
4. [Workflow Triggers](#workflow-triggers)
5. [Workflow Nodes Catalog](#workflow-nodes-catalog)
6. [Custom Workflow Examples](#custom-workflow-examples)
7. [Best Practices](#best-practices)

1. **Non-blocking**: Workflows must NOT block entity operations (glossary term creation, etc.)
2. **BPMN-driven flow**: Flowable's BPMN engine controls the flow based on conditions - we don't override this
3. **Complete audit trail**: Every execution attempt must be recorded, even failures
4. **No ID generation**: Use Flowable's execution IDs, not random UUIDs

## Solution Implementation

### 1. WorkflowInstanceListener
- **On Exception in execute()**: Still record the workflow state with FAILURE status
- **Use Flowable's execution ID**: Convert `execution.getId()` to UUID for tracking
- **Always persist state**: Even on failure, write to `workflow_instance_time_series`

### 2. WorkflowInstanceStageListener  
- **On Exception**: Create a failed stage record so there's an audit trail
- **Use deterministic IDs**: `UUID.nameUUIDFromBytes(execution.getId().getBytes())`
- **Don't block flow**: Log and record but let Flowable continue per BPMN

### 3. BaseDelegate (Task Implementations)
- **Throw BpmnError**: This is CORRECT - allows boundary events to handle failures
- **Set exception variable**: For downstream stages to check
- **Let BPMN decide**: The workflow definition controls whether to continue or fail

### 4. WorkflowFailureListener
- **Keep as-is**: `isFailOnException() = false` is correct - don't block entity operations
- **Purpose**: Global monitoring, not flow control

## How It Works

1. **Task fails** → BaseDelegate throws BpmnError
2. **BPMN handles** → Boundary events catch error, workflow continues/fails per definition  
3. **Listeners record** → Even on exception, state is persisted to database
4. **No silent failures** → Database always has the true state

## Key Changes Made

```java
// WorkflowInstanceListener - Always record state
catch (Exception exc) {
  LOG.error(...);
  // Still write to DB even on failure
  if ("end".equals(execution.getEventName())) {
    workflowInstanceRepository.updateWorkflowInstance(
      workflowInstanceId, 
      System.currentTimeMillis(), 
      Map.of("status", "FAILURE", "error", exc.getMessage())
    );
  }
}

// WorkflowInstanceStageListener - Create failure records
catch (Exception exc) {
  LOG.error(...);
  // Create a failed stage record for audit
  if ("end".equals(execution.getEventName())) {
    UUID stageId = workflowInstanceStateRepository.addNewStageToInstance(
      stage + "_failed", ...
    );
    workflowInstanceStateRepository.updateStage(
      stageId, 
      System.currentTimeMillis(), 
      Map.of("status", "FAILED", "error", exc.getMessage())
    );
  }
}
```

## What We DON'T Do

1. **Don't generate random UUIDs** - Use Flowable's execution IDs
2. **Don't skip stages** - Let BPMN control flow
3. **Don't throw from listeners** - Would block entity operations
4. **Don't override BPMN decisions** - Respect workflow definitions

## Testing

1. Remove `relatedEntity` from glossary workflow trigger
2. Check database - should show FAILURE status, not FINISHED
3. Check stages - should have failed stage records
4. Entity (glossary term) should still be created

## Result

- Workflows fail gracefully per BPMN definition
- Database always reflects true state
- No silent failures
- Entity operations never blocked
- Complete audit trail maintained
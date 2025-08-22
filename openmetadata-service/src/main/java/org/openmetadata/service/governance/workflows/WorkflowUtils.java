package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.elements.TriggerFactory.getMainWorkflowDefinitionNameFromTrigger;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.runtime.ProcessInstance;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class WorkflowUtils {

  /**
   * Terminates conflicting workflow instances of a specific type for an entity.
   * Orchestrates both Flowable termination and OpenMetadata database updates.
   */
  public static void terminateConflictingInstances(
      String triggerWorkflowDefinitionKey, String entityLink, String currentProcessInstanceId) {
    try {
      // Convert trigger name to main workflow name (e.g., "GlossaryTermApprovalWorkflowTrigger" →
      // "GlossaryTermApprovalWorkflow")
      String mainWorkflowDefinitionName =
          getMainWorkflowDefinitionNameFromTrigger(triggerWorkflowDefinitionKey);
      WorkflowInstanceRepository workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
      WorkflowInstanceStateRepository workflowInstanceStateRepository =
          (WorkflowInstanceStateRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

      // Query for running instances of this workflow type for this entity
      ListFilter filter = new ListFilter(null);
      filter.addQueryParam("entityLink", entityLink);

      long endTs = System.currentTimeMillis();
      long startTs = endTs - (7L * 24 * 60 * 60 * 1000);

      ResultList<WorkflowInstance> allInstances =
          workflowInstanceRepository.list(null, startTs, endTs, 100, filter, false);

      // Filter to running instances of this specific workflow type
      List<WorkflowInstance> candidateInstances =
          allInstances.getData().stream()
              .filter(
                  instance -> WorkflowInstance.WorkflowStatus.RUNNING.equals(instance.getStatus()))
              .filter(
                  instance -> {
                    try {
                      WorkflowDefinitionRepository repo =
                          (WorkflowDefinitionRepository)
                              Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
                      var def =
                          repo.get(
                              null,
                              instance.getWorkflowDefinitionId(),
                              EntityUtil.Fields.EMPTY_FIELDS);
                      return mainWorkflowDefinitionName.equals(def.getName());
                    } catch (Exception e) {
                      return false;
                    }
                  })
              .toList();

      // Check if there are multiple instances using Flowable's API
      RuntimeService runtimeService = WorkflowHandler.getInstance().getRuntimeService();
      List<ProcessInstance> runningProcessInstances =
          runtimeService
              .createProcessInstanceQuery()
              .processDefinitionKey(mainWorkflowDefinitionName)
              .list();
      // Find instances to terminate (exclude the current one by process instance ID)
      List<WorkflowInstance> conflictingInstances =
          candidateInstances.stream()
              .filter(
                  instance -> {
                    // Check if this WorkflowInstance corresponds to a different process instance
                    return runningProcessInstances.stream()
                        .filter(pi -> !pi.getId().equals(currentProcessInstanceId))
                        .anyMatch(pi -> pi.getBusinessKey().equals(instance.getId().toString()));
                  })
              .toList();

      if (conflictingInstances.isEmpty()) {
        LOG.debug("No conflicting instances found to terminate for {}", mainWorkflowDefinitionName);
        return;
      }
      // Execute everything in a single transaction for atomicity
      Entity.getJdbi()
          .inTransaction(
              TransactionIsolationLevel.READ_COMMITTED,
              handle -> {
                try {
                  // 1. Terminate Flowable processes using existing handler method
                  WorkflowHandler.getInstance().terminateWorkflow(mainWorkflowDefinitionName);

                  // 2. Mark OpenMetadata instances and states as FAILURE
                  for (WorkflowInstance instance : conflictingInstances) {
                    workflowInstanceStateRepository.markInstanceStatesAsFailed(
                        instance.getId(), "Terminated due to conflicting workflow instance");
                    workflowInstanceRepository.markInstanceAsFailed(
                        instance.getId(), "Terminated due to conflicting workflow instance");
                  }

                  return null;
                } catch (Exception e) {
                  LOG.error(
                      "Failed to terminate conflicting instances in transaction: {}",
                      e.getMessage());
                  throw e;
                }
              });

      LOG.info(
          "Terminated {} conflicting instances of {} for entity {}",
          conflictingInstances.size(),
          mainWorkflowDefinitionName,
          entityLink);

    } catch (Exception e) {
      LOG.warn("Failed to terminate conflicting instances: {}", e.getMessage());
    }
  }
}

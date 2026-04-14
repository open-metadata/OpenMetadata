package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.PROCESSED_FQNS_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowInstanceResource;

public class WorkflowInstanceRepository extends EntityTimeSeriesRepository<WorkflowInstance> {
  public WorkflowInstanceRepository() {
    super(
        WorkflowInstanceResource.COLLECTION_PATH,
        Entity.getCollectionDAO().workflowInstanceTimeSeriesDAO(),
        WorkflowInstance.class,
        Entity.WORKFLOW_INSTANCE);
  }

  public WorkflowInstance createNewRecord(WorkflowInstance recordEntity, String recordFQN) {
    storeInternal(recordEntity, recordFQN);
    storeRelationshipInternal(recordEntity);
    return recordEntity;
  }

  public void addNewWorkflowInstance(
      String workflowDefinitionName,
      UUID workflowInstanceId,
      Long startedAt,
      Map<String, Object> variables,
      UUID scheduleRunId) {
    WorkflowDefinitionRepository workflowDefinitionRepository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    UUID workflowDefinitionId = workflowDefinitionRepository.getIdFromName(workflowDefinitionName);

    List<String> entityList = extractEntityList(variables);

    createNewRecord(
        new WorkflowInstance()
            .withId(workflowInstanceId)
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withScheduleRunId(scheduleRunId)
            .withStartedAt(startedAt)
            .withStatus(WorkflowInstance.WorkflowStatus.RUNNING)
            .withVariables(variables)
            .withEntityList(entityList)
            .withTimestamp(System.currentTimeMillis()),
        workflowDefinitionName);
  }

  public void updateWorkflowInstance(
      UUID workflowInstanceId, Long endedAt, Map<String, Object> variables) {
    WorkflowInstance workflowInstance =
        JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceId), WorkflowInstance.class);

    workflowInstance.setEndedAt(endedAt);
    workflowInstance.setEntityList(extractFinalEntityList(variables));

    WorkflowInstanceStateRepository workflowInstanceStateRepository =
        (WorkflowInstanceStateRepository)
            Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

    List<WorkflowInstanceState> states =
        workflowInstanceStateRepository.listAllStatesForInstance(workflowInstanceId);

    WorkflowInstance.WorkflowStatus workflowStatus = WorkflowInstance.WorkflowStatus.FINISHED;
    if (states.stream()
        .anyMatch(s -> s.getStatus().equals(WorkflowInstance.WorkflowStatus.FAILURE))) {
      workflowStatus = WorkflowInstance.WorkflowStatus.FAILURE;
    }

    workflowInstance.setStatus(workflowStatus);
    workflowInstance.setUpdatedBy(WorkflowInstanceRepository.extractUpdatedByFromStates(states));

    Optional<String> oException =
        Optional.ofNullable(
            (String)
                variables.getOrDefault(
                    getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE), null));
    if (oException.isPresent()) {
      workflowInstance.setException(oException.get());
      workflowInstance.setStatus(WorkflowInstance.WorkflowStatus.EXCEPTION);
    }

    getTimeSeriesDao().update(JsonUtils.pojoToJson(workflowInstance), workflowInstanceId);
  }

  private List<String> extractFinalEntityList(Map<String, Object> variables) {
    List<String> fromProcessedFqns = extractEntityListFromProcessedFqns(variables);
    if (fromProcessedFqns != null && !fromProcessedFqns.isEmpty()) {
      return fromProcessedFqns;
    }
    return extractEntityList(variables);
  }

  @SuppressWarnings("unchecked")
  private List<String> extractEntityListFromProcessedFqns(Map<String, Object> variables) {
    Object obj = variables.get(PROCESSED_FQNS_VARIABLE);
    if (obj instanceof Map<?, ?> map && !map.isEmpty()) {
      return new ArrayList<>(((Map<String, ?>) map).keySet());
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  private List<String> extractEntityList(Map<String, Object> variables) {
    Object obj = variables.get(getNamespacedVariableName(GLOBAL_NAMESPACE, ENTITY_LIST_VARIABLE));
    return obj instanceof List ? (List<String>) obj : null;
  }

  static String extractUpdatedByFromStates(List<WorkflowInstanceState> states) {
    return states.stream()
        .filter(s -> s.getStage() != null && s.getStage().getUpdatedBy() != null)
        .max(
            Comparator.comparingLong(
                s -> Optional.ofNullable(s.getStage().getEndedAt()).orElse(0L)))
        .map(s -> s.getStage().getUpdatedBy())
        .orElse(null);
  }

  /**
   * Marks a workflow instance as FAILED with the given reason.
   * Preserves audit trail instead of deleting the instance.
   */
  public void markInstanceAsFailed(UUID workflowInstanceId, String reason) {
    WorkflowInstance workflowInstance =
        JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceId), WorkflowInstance.class);

    WorkflowInstance updatedInstance =
        workflowInstance
            .withStatus(WorkflowInstance.WorkflowStatus.FAILURE)
            .withException(reason)
            .withEndedAt(System.currentTimeMillis());

    getTimeSeriesDao().update(JsonUtils.pojoToJson(updatedInstance), workflowInstanceId);
  }
}

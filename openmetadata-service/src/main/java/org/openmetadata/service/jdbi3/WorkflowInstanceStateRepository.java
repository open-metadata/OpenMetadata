package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.FAILURE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.Stage;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowInstanceStateResource;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class WorkflowInstanceStateRepository
    extends EntityTimeSeriesRepository<WorkflowInstanceState> {
  public WorkflowInstanceStateRepository() {
    super(
        WorkflowInstanceStateResource.COLLECTION_PATH,
        Entity.getCollectionDAO().workflowInstanceStateTimeSeriesDAO(),
        WorkflowInstanceState.class,
        Entity.WORKFLOW_INSTANCE_STATE);
  }

  public WorkflowInstanceState createNewRecord(
      WorkflowInstanceState recordEntity, String recordFQN) {
    recordEntity.setId(UUID.randomUUID());
    storeInternal(recordEntity, recordFQN);
    storeRelationshipInternal(recordEntity);
    return recordEntity;
  }

  public WorkflowInstanceState createOrUpdateRecord(
      WorkflowInstanceState recordEntity, String recordFQN) {
    if (recordEntity.getId() == null) {
      createNewRecord(recordEntity, recordFQN);
    } else {
      timeSeriesDao.update(JsonUtils.pojoToJson(recordEntity), recordEntity.getId());
    }
    return recordEntity;
  }

  public ResultList<WorkflowInstanceState> listWorkflowInstanceStateForInstance(
      String workflowDefinitionName,
      UUID workflowInstanceId,
      String offset,
      long startTs,
      long endTs,
      int limitParam,
      boolean latest) {
    ListFilter filter = new ListFilter(null);
    filter.addQueryParam(
        "entityFQNHash",
        FullyQualifiedName.buildHash(workflowDefinitionName, workflowInstanceId.toString()));
    return this.list(offset, startTs, endTs, limitParam, filter, latest);
  }

  public ResultList<WorkflowInstanceState> listWorkflowInstanceStateForStage(
      UUID workflowInstanceId, String stage) {
    List<WorkflowInstanceState> workflowInstanceStates = new ArrayList<>();
    List<String> jsons =
        ((CollectionDAO.WorkflowInstanceStateTimeSeriesDAO) timeSeriesDao)
            .listWorkflowInstanceStateForStage(workflowInstanceId.toString(), stage);

    for (String json : jsons) {
      WorkflowInstanceState workflowInstanceState =
          JsonUtils.readValue(json, WorkflowInstanceState.class);
      setInheritedFields(workflowInstanceState);
      workflowInstanceStates.add(workflowInstanceState);
    }

    return getResultList(workflowInstanceStates, null, null, workflowInstanceStates.size());
  }

  private UUID getStateId(UUID workflowInstanceId, String workflowInstanceStage) {
    UUID id = null;
    ResultList<WorkflowInstanceState> resultList =
        listWorkflowInstanceStateForStage(workflowInstanceId, workflowInstanceStage);

    if (!resultList.getData().isEmpty()) {
      id = resultList.getData().get(0).getId();
    }

    return id;
  }

  public UUID addNewStageToInstance(
      String workflowInstanceStage,
      UUID workflowInstanceExecutionId,
      UUID workflowInstanceId,
      String workflowDefinitionName,
      Long startedAt) {

    WorkflowDefinitionRepository workflowDefinitionRepository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    // Efficiently get the workflow definition in a single DB call and extract both ID and
    // displayName
    WorkflowDefinition workflowDefinition =
        workflowDefinitionRepository.getByNameForStageProcessing(workflowDefinitionName);
    String displayName = getStageDisplayName(workflowDefinition, workflowInstanceStage);

    Stage stage =
        new Stage()
            .withName(workflowInstanceStage)
            .withDisplayName(displayName)
            .withStartedAt(startedAt);

    WorkflowInstanceState entityRecord =
        new WorkflowInstanceState()
            .withStage(stage)
            .withWorkflowInstanceExecutionId(workflowInstanceExecutionId)
            .withWorkflowInstanceId(workflowInstanceId)
            .withTimestamp(System.currentTimeMillis())
            .withStatus(WorkflowInstance.WorkflowStatus.RUNNING)
            .withWorkflowDefinitionId(workflowDefinition.getId());

    UUID stateId = getStateId(workflowInstanceId, workflowInstanceStage);

    if (stateId != null) {
      entityRecord.withId(stateId);
    }

    entityRecord =
        createOrUpdateRecord(
            entityRecord,
            buildWorkflowInstanceFqn(workflowDefinitionName, workflowInstanceId.toString()));

    return entityRecord.getId();
  }

  public void updateStage(
      UUID workflowInstanceStateId, Long endedAt, Map<String, Object> variables) {
    WorkflowInstanceState workflowInstanceState =
        JsonUtils.readValue(
            timeSeriesDao.getById(workflowInstanceStateId), WorkflowInstanceState.class);

    Stage stage = workflowInstanceState.getStage();
    stage.setEndedAt(endedAt);
    stage.setVariables(variables);

    workflowInstanceState.setStage(stage);
    workflowInstanceState.setStatus(WorkflowInstance.WorkflowStatus.FINISHED);

    if (variables.containsKey(FAILURE_VARIABLE)) {
      workflowInstanceState.setStatus(WorkflowInstance.WorkflowStatus.FAILURE);
    }

    if (variables.containsKey(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE))) {
      workflowInstanceState.setException(
          (String) variables.get(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE)));
      workflowInstanceState.setStatus(WorkflowInstance.WorkflowStatus.EXCEPTION);
    }

    getTimeSeriesDao().update(JsonUtils.pojoToJson(workflowInstanceState), workflowInstanceStateId);
  }

  public void updateStageWithTask(UUID taskId, UUID workflowInstanceStateId) {
    WorkflowInstanceState workflowInstanceState =
        JsonUtils.readValue(
            timeSeriesDao.getById(workflowInstanceStateId), WorkflowInstanceState.class);

    Stage stage = workflowInstanceState.getStage();
    stage.getTasks().add(taskId);

    workflowInstanceState.setStage(stage);

    getTimeSeriesDao().update(JsonUtils.pojoToJson(workflowInstanceState), workflowInstanceStateId);
  }

  private String buildWorkflowInstanceFqn(
      String workflowDefinitionName, String workflowInstanceId) {
    return FullyQualifiedName.build(workflowDefinitionName, workflowInstanceId);
  }

  /**
   * Extracts the displayName for a given stage from the workflow definition nodes.
   * Returns the displayName if available, otherwise falls back to the stage name.
   */
  private String getStageDisplayName(WorkflowDefinition workflowDefinition, String stageName) {
    if (workflowDefinition.getNodes() != null) {
      return workflowDefinition.getNodes().stream()
          .filter(node -> stageName.equals(node.getName()))
          .findFirst()
          .map(
              node -> {
                String nodeDisplayName = node.getDisplayName();
                return (nodeDisplayName != null && !nodeDisplayName.trim().isEmpty())
                    ? nodeDisplayName
                    : stageName;
              })
          .orElse(stageName);
    }
    return stageName;
  }
}

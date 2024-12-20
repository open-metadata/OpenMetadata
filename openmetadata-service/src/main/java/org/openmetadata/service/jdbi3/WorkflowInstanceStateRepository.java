package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;

import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.governance.workflows.Stage;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowInstanceStateResource;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

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

  public UUID addNewStageToInstance(
      String workflowInstanceStage,
      UUID workflowInstanceExecutionId,
      UUID workflowInstanceId,
      String workflowDefinitionName,
      Long startedAt) {
    WorkflowDefinitionRepository workflowDefinitionRepository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    UUID workflowDefinitionId = workflowDefinitionRepository.getIdFromName(workflowDefinitionName);
    Stage stage = new Stage().withName(workflowInstanceStage).withStartedAt(startedAt);

    WorkflowInstanceState createdRecord =
        createNewRecord(
            new WorkflowInstanceState()
                .withStage(stage)
                .withWorkflowInstanceExecutionId(workflowInstanceExecutionId)
                .withWorkflowInstanceId(workflowInstanceId)
                .withTimestamp(System.currentTimeMillis())
                .withWorkflowDefinitionId(workflowDefinitionId),
            buildWorkflowInstanceFqn(workflowDefinitionName, workflowInstanceId.toString()));

    return createdRecord.getId();
  }

  public void updateStage(
      UUID workflowInstanceStateId, Long endedAt, Map<String, Object> variables) {
    WorkflowInstanceState workflowInstanceState =
        JsonUtils.readValue(
            timeSeriesDao.getById(workflowInstanceStateId), WorkflowInstanceState.class);

    Stage stage = workflowInstanceState.getStage();
    stage.setEndedAt(endedAt);
    stage.setVariables(variables);

    if (variables.containsKey(EXCEPTION_VARIABLE)) {
      workflowInstanceState.setException(true);
    }

    workflowInstanceState.setStage(stage);

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
}

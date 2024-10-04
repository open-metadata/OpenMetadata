package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.openmetadata.schema.governance.workflows.Stage;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowInstanceStateResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

public class WorkflowInstanceStateRepository
    extends EntityTimeSeriesRepository<WorkflowInstanceState> {
  public WorkflowInstanceStateRepository() {
    super(
        WorkflowInstanceStateResource.COLLECTION_PATH,
        Entity.getCollectionDAO().workflowInstanceStateTimeSeriesDAO(),
        WorkflowInstanceState.class,
        Entity.WORKFLOW_INSTANCE_STATE);
  }

  public ResultList<WorkflowInstanceState> listWorkflowInstanceStatesForWorkflowInstanceId(
      UUID workflowInstanceId) {
    List<WorkflowInstanceState> workflowInstanceStates = new ArrayList<>();
    List<String> jsons =
            ((CollectionDAO.WorkflowInstanceStateTimeSeriesDAO) timeSeriesDao)
                    .listWorkflowInstanceStatesForWorkflowInstanceId(workflowInstanceId);

    for (String json : jsons) {
      WorkflowInstanceState workflowInstanceState =
              JsonUtils.readValue(json, WorkflowInstanceState.class);
      setInheritedFields(workflowInstanceState);
      workflowInstanceStates.add(workflowInstanceState);
    }
    return getResultList(workflowInstanceStates, null, null, workflowInstanceStates.size());
  }

  public WorkflowInstanceState createNewRecord(WorkflowInstanceState recordEntity, String recordFQN) {
    recordEntity.setId(UUID.randomUUID());
    storeInternal(recordEntity, recordFQN);
    storeRelationshipInternal(recordEntity);
    return recordEntity;
  }

  public UUID addNewStageToInstance(String workflowInstanceStage, String workflowInstanceId, String workflowDefinitionName, Long startedAt) {
     WorkflowDefinitionRepository workflowDefinitionRepository = (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    EntityReference workflowDefinitionReference = workflowDefinitionRepository.getByName(null, workflowDefinitionName, new EntityUtil.Fields(Set.of("*"))).getEntityReference();

    Stage stage = new Stage()
            .withName(workflowInstanceStage)
            .withStartedAt(startedAt);

    WorkflowInstanceState createdRecord = createNewRecord(
            new WorkflowInstanceState()
                    .withStage(stage)
                    .withWorkflowInstanceId(workflowInstanceId)
                    .withTimestamp(System.currentTimeMillis())
                    .withWorkflowDefinitionReference(workflowDefinitionReference), buildWorkflowInstanceFqn(workflowDefinitionName, workflowInstanceId));

    return createdRecord.getId();
  }

  public void updateStage(UUID workflowInstanceStateId, Long endedAt, Map<String, Object> variables) {
    WorkflowInstanceState workflowInstanceState =
            JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceStateId), WorkflowInstanceState.class);

    Stage stage = workflowInstanceState.getStage();
    stage.setEndedAt(endedAt);
    stage.setVariables(variables);

    workflowInstanceState.setStage(stage);

    getTimeSeriesDao().update(JsonUtils.pojoToJson(workflowInstanceState), workflowInstanceStateId);
  }

  public void updateStageWithTask(UUID taskId, UUID workflowInstanceStateId) {
    WorkflowInstanceState workflowInstanceState =
          JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceStateId), WorkflowInstanceState.class);

    Stage stage = workflowInstanceState.getStage();
    stage.getTasks().add(taskId);

    workflowInstanceState.setStage(stage);

    getTimeSeriesDao().update(JsonUtils.pojoToJson(workflowInstanceState), workflowInstanceStateId);
  }

  private String buildWorkflowInstanceFqn(String workflowDefinitionName, String workflowInstanceId) {
    return String.format("%s.%s", workflowDefinitionName, workflowInstanceId);
  }
}

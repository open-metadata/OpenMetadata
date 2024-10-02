package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
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
      String workflowInstanceId) {
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

  public WorkflowInstanceState getLastWorkflowInstanceStateForWorkflowInstanceId(String workflowInstanceId) {
    // NOTE: They are ordered using timestamp DESC.
    return listWorkflowInstanceStatesForWorkflowInstanceId(workflowInstanceId).getData().get(0);
  }

  public String getFlowableTaskIdFromTaskId(UUID taskId) {
    return ((CollectionDAO.WorkflowInstanceStateTimeSeriesDAO) timeSeriesDao)
            .getFlowableTaskIdFromTaskId(taskId);
  }

  public WorkflowInstanceState createNewRecord(WorkflowInstanceState recordEntity, String recordFQN) {
    recordEntity.setId(UUID.randomUUID());
    storeInternal(recordEntity, recordFQN);
    storeRelationshipInternal(recordEntity);
    return recordEntity;
  }

  public void addNewStateToInstance(WorkflowInstanceState.State state, String workflowInstanceId, String workflowDefinitionName) {
    addNewStateToInstance(state, workflowInstanceId, workflowDefinitionName, null, null);
  }
  public void addNewStateToInstance(WorkflowInstanceState.State state, String workflowInstanceId, String workflowDefinitionName, UUID taskId, String flowableTaskId) {
    WorkflowDefinitionRepository workflowDefinitionRepository = (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    EntityReference workflowDefinitionReference = workflowDefinitionRepository.getByName(null, workflowDefinitionName, new EntityUtil.Fields(Set.of("*"))).getEntityReference();

    createNewRecord(
        new WorkflowInstanceState()
                .withState(state)
                .withWorkflowInstanceId(workflowInstanceId)
                .withTimestamp(System.currentTimeMillis())
                .withTaskId(taskId)
                .withFlowableTaskId(flowableTaskId)
                .withWorkflowDefinitionReference(workflowDefinitionReference), buildWorkflowInstanceFqn(workflowDefinitionName, workflowInstanceId));

  }

  private String buildWorkflowInstanceFqn(String workflowDefinitionName, String workflowInstanceId) {
    return String.format("%s.%s", workflowDefinitionName, workflowInstanceId);
  }
}

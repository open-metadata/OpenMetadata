package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.governanceWorkflows.WorkflowInstanceState;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowInstanceStateResource;
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
}

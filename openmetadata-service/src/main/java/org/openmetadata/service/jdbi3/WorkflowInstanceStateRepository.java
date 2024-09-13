package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.governanceWorkflows.WorkflowInstanceState;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowInstanceStateResource;
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
    // TODO: Actually return the WorkflowInstanceStates
    List<WorkflowInstanceState> workflowInstanceStates = new ArrayList<>();
    return getResultList(workflowInstanceStates, null, null, workflowInstanceStates.size());
  }
}

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowInstanceResource;
import org.openmetadata.service.util.JsonUtils;

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
      Map<String, Object> variables) {
    WorkflowDefinitionRepository workflowDefinitionRepository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    UUID workflowDefinitionId = workflowDefinitionRepository.getIdFromName(workflowDefinitionName);

    createNewRecord(
        new WorkflowInstance()
            .withId(workflowInstanceId)
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withStartedAt(startedAt)
            .withStatus(WorkflowInstance.WorkflowStatus.RUNNING)
            .withVariables(variables)
            .withTimestamp(System.currentTimeMillis()),
        workflowDefinitionName);
  }

  public void updateWorkflowInstance(
      UUID workflowInstanceId, Long endedAt, Map<String, Object> variables) {
    WorkflowInstance workflowInstance =
        JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceId), WorkflowInstance.class);

    workflowInstance.setEndedAt(endedAt);
    workflowInstance.setStatus(WorkflowInstance.WorkflowStatus.FINISHED);

    if (Optional.ofNullable(variables.getOrDefault(EXCEPTION_VARIABLE, null)).isPresent()) {
      workflowInstance.setException(true);
      workflowInstance.setStatus(WorkflowInstance.WorkflowStatus.EXCEPTION);
    }

    getTimeSeriesDao().update(JsonUtils.pojoToJson(workflowInstance), workflowInstanceId);
  }
}

package org.openmetadata.service.governance.workflows;

import java.util.UUID;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;

/**
 * Tells a running process whether an administrator asked its WorkflowInstance to stop.
 *
 * <p>A process's business key is the id of the WorkflowInstance it runs for; call-activity children
 * inherit it. The request is read from the OpenMetadata database, so one recorded on any server is
 * seen by the server executing the process.
 */
public final class WorkflowStopRequests {

  private WorkflowStopRequests() {}

  /**
   * {@code true} when the WorkflowInstance whose id is {@code businessKey} carries a stop request.
   * A process started outside the trigger path has no WorkflowInstance id as its business key and
   * is never stopped this way.
   */
  public static boolean isStopRequested(String businessKey) {
    return WorkflowInstanceListener.isUuid(businessKey)
        && workflowInstanceRepository().findStopRequest(UUID.fromString(businessKey)).isPresent();
  }

  private static WorkflowInstanceRepository workflowInstanceRepository() {
    return (WorkflowInstanceRepository)
        Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
  }
}

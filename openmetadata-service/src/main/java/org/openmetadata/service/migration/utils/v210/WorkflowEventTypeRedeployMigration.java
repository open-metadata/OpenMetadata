package org.openmetadata.service.migration.utils.v210;

import org.openmetadata.service.migration.utils.v208.WorkflowRedeployMigration;

/**
 * Redeploys every governance workflow so its trigger passes the triggering event type to the main
 * workflow. A deployed workflow keeps its BPMN until it is redeployed, and without the event type
 * its change check treats an update whose edit was undone as a create.
 */
public final class WorkflowEventTypeRedeployMigration {
  public static final String STEP_NAME = "redeployGovernanceWorkflowsForTriggeringEventType";

  private WorkflowEventTypeRedeployMigration() {}

  public static void redeploy() {
    WorkflowRedeployMigration.redeploy();
  }
}

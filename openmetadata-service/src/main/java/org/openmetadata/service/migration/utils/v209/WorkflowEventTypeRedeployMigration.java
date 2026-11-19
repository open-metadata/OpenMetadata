package org.openmetadata.service.migration.utils.v209;

import org.openmetadata.service.migration.utils.v208.WorkflowRedeployMigration;

/**
 * Redeploys every governance workflow so its trigger passes the triggering event type to the main
 * workflow. A deployed workflow keeps its BPMN until it is redeployed, and without the event type
 * its change check treats an update whose edit was undone as a create. The step runs in 2.0.9 so
 * main and the 2.0 line share it, and a 2.0.8 install gets it on either upgrade.
 */
public final class WorkflowEventTypeRedeployMigration {
  public static final String STEP_NAME = "redeployGovernanceWorkflowsForTriggeringEventType";

  private WorkflowEventTypeRedeployMigration() {}

  public static void redeploy() {
    WorkflowRedeployMigration.redeploy("v209");
  }
}

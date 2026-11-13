/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.migration.utils.v208;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Event-triggered workflows pass the entity version their event produced to the main workflow, so
 * a change check judges that edit's change rather than a later one. The trigger BPMN carries the
 * pass-through, and a deployed workflow keeps its old BPMN until it is redeployed, so the 2.0.8
 * migration redeploys every governance workflow once. A workflow that fails to redeploy is logged
 * and the rest still run, so one undeployable workflow does not block the upgrade; saving it again
 * redeploys it.
 */
@Slf4j
public final class WorkflowRedeployMigration {
  public static final String STEP_NAME = "redeployGovernanceWorkflowsForTriggeringVersion";

  private WorkflowRedeployMigration() {}

  public static void redeploy() {
    redeployAll("v208");
  }

  /**
   * Redeploys every governance workflow so each picks up the BPMN the current code builds; a later
   * migration that changes that BPMN calls this under its own step. Logs under {@code version}.
   */
  public static void redeployAll(String version) {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    List<WorkflowDefinition> workflows =
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());
    int redeployed = redeployEach(WorkflowHandler.getInstance(), workflows);
    LOG.info(
        "[{}] Redeployed {} of {} governance workflow definition(s)",
        version,
        redeployed,
        workflows.size());
  }

  static int redeployEach(WorkflowHandler workflowHandler, List<WorkflowDefinition> workflows) {
    int redeployed = 0;
    for (WorkflowDefinition workflow : workflows) {
      try {
        workflowHandler.deploy(new Workflow(workflow));
        redeployed++;
      } catch (RuntimeException e) {
        // Flowable reports a failed deploy with its own unchecked exceptions.
        LOG.error(
            "Failed to redeploy workflow '{}'; save it again to redeploy it",
            workflow.getFullyQualifiedName(),
            e);
      }
    }
    return redeployed;
  }
}

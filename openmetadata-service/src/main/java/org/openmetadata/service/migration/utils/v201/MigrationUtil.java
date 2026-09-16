package org.openmetadata.service.migration.utils.v201;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public final class MigrationUtil {
  private static final String AUTOPILOT_WORKFLOW_NAME = "AutoPilotWorkflow";

  private MigrationUtil() {}

  /**
   * Re-deploy AutoPilotWorkflow so its Flowable process definition is regenerated from the current
   * node/delegate code. When {@code CreateIngestionPipelineDelegate}'s {@code
   * pipelineServiceClientExpr} field was removed in #28741, the BPMN deployed by the previous
   * release still declared that field and Flowable field injection threw {@code "Field definition
   * uses non-existent field ..."} at runtime. Scoped to AutoPilotWorkflow because it is the only
   * definition whose delegate contract drifted across the 2.0.0 → 2.0.1 boundary. Best-effort: a
   * failure only warns.
   */
  public static void redeployAutoPilotWorkflow() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowDefinition autoPilotWorkflow = loadAutoPilotWorkflow(repository);
    if (autoPilotWorkflow == null) {
      return;
    }
    try {
      WorkflowHandler.getInstance().deploy(new Workflow(autoPilotWorkflow));
      LOG.info("[v201] Re-deployed AutoPilotWorkflow to realign BPMN with current delegates");
    } catch (Exception e) {
      LOG.warn("[v201] Failed to re-deploy AutoPilotWorkflow: {}", e.getMessage());
    }
  }

  private static WorkflowDefinition loadAutoPilotWorkflow(WorkflowDefinitionRepository repository) {
    WorkflowDefinition result = null;
    try {
      result = repository.getByName(null, AUTOPILOT_WORKFLOW_NAME, EntityUtil.Fields.EMPTY_FIELDS);
    } catch (EntityNotFoundException e) {
      LOG.info("[v201] AutoPilotWorkflow not present; skipping re-deploy");
    } catch (Exception e) {
      LOG.warn("[v201] Failed to load AutoPilotWorkflow: {}", e.getMessage());
    }
    return result;
  }
}

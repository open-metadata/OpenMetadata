package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_SCHEDULE_RUN_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;

@Slf4j
public final class WorkflowScheduleRunIdReader {
  private WorkflowScheduleRunIdReader() {}

  public static UUID readFrom(DelegateExecution execution) {
    Object plain = execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE);
    if (plain != null) {
      return toUuid(plain);
    }
    Object namespaced =
        execution.getVariable(
            getNamespacedVariableName(GLOBAL_NAMESPACE, WORKFLOW_SCHEDULE_RUN_ID_VARIABLE));
    return namespaced != null ? toUuid(namespaced) : null;
  }

  static UUID toUuid(Object value) {
    if (value instanceof UUID uuid) {
      return uuid;
    }
    try {
      return UUID.fromString(value.toString());
    } catch (IllegalArgumentException e) {
      LOG.warn(
          "[WorkflowScheduleRunIdReader] Invalid scheduleRunId value '{}': {}",
          value,
          e.getMessage());
      return null;
    }
  }
}

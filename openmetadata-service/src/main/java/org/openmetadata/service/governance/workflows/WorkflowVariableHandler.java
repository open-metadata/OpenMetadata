package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.FAILURE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;

import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.task.service.delegate.DelegateTask;
import org.flowable.variable.api.delegate.VariableScope;

@Slf4j
public class WorkflowVariableHandler {
  private final VariableScope varScope;

  public WorkflowVariableHandler(VariableScope varScope) {
    this.varScope = varScope;
  }

  public static String getNamespacedVariableName(String namespace, String varName) {
    if (namespace != null) {
      return String.format("%s_%s", namespace, varName);
    } else {
      return null;
    }
  }

  public Object getNamespacedVariable(String namespace, String varName) {
    String namespacedVarName = getNamespacedVariableName(namespace, varName);
    if (namespacedVarName != null) {
      Object value = varScope.getVariable(namespacedVarName);
      LOG.debug(
          "[WorkflowVariable] GET: namespace='{}' varName='{}' namespacedVar='{}' value='{}' type='{}'",
          namespace,
          varName,
          namespacedVarName,
          value,
          value != null ? value.getClass().getSimpleName() : "null");
      return value;
    } else {
      LOG.debug(
          "[WorkflowVariable] GET: namespace='{}' varName='{}' returned null (no namespace)",
          namespace,
          varName);
      return null;
    }
  }

  public Object getNodeVariable(String varName) {
    String namespace = getNodeNamespace();
    return getNamespacedVariable(namespace, varName);
  }

  public void setNamespacedVariable(String namespace, String varName, Object varValue) {
    String namespacedVarName = getNamespacedVariableName(namespace, varName);
    if (namespacedVarName != null) {
      varScope.setVariable(namespacedVarName, varValue);
      LOG.debug(
          "[WorkflowVariable] SET: namespace='{}' varName='{}' namespacedVar='{}' value='{}' type='{}'",
          namespace,
          varName,
          namespacedVarName,
          varValue,
          varValue != null ? varValue.getClass().getSimpleName() : "null");
    } else {
      LOG.error("[WorkflowVariable] ERROR: Namespace is null when setting variable '{}'", varName);
      throw new RuntimeException("Namespace can't be null when setting a namespaced variable.");
    }
  }

  public void setGlobalVariable(String varName, Object varValue) {
    setNamespacedVariable(GLOBAL_NAMESPACE, varName, varValue);
  }

  private String getNodeNamespace() {
    String namespace;
    if (varScope instanceof DelegateExecution) {
      DelegateExecution execution = (DelegateExecution) varScope;
      namespace =
          Optional.ofNullable(
                  execution.getParent() != null
                      ? execution.getParent().getCurrentActivityId()
                      : null)
              .orElseGet(() -> execution.getCurrentActivityId().split("\\.")[0]);
      LOG.debug(
          "[WorkflowVariable] getNodeNamespace: DelegateExecution activityId='{}' namespace='{}'",
          execution.getCurrentActivityId(),
          namespace);
    } else if (varScope instanceof DelegateTask) {
      DelegateTask task = (DelegateTask) varScope;
      namespace = WorkflowHandler.getInstance().getParentActivityId(task.getExecutionId());
      LOG.debug(
          "[WorkflowVariable] getNodeNamespace: DelegateTask executionId='{}' namespace='{}'",
          task.getExecutionId(),
          namespace);
    } else {
      LOG.error(
          "[WorkflowVariable] ERROR: Invalid varScope type: {}",
          varScope != null ? varScope.getClass().getName() : "null");
      throw new RuntimeException(
          "varScope must be either an instance of 'DelegateExecution' or 'DelegateTask'.");
    }
    return namespace;
  }

  public void setNodeVariable(String varName, Object varValue) {
    String namespace = getNodeNamespace();
    LOG.debug(
        "[WorkflowVariable] setNodeVariable: varName='{}' value='{}' using namespace='{}'",
        varName,
        varValue,
        namespace);
    setNamespacedVariable(namespace, varName, varValue);
  }

  public void setFailure(boolean failure) {
    if (failure) {
      varScope.setTransientVariable(FAILURE_VARIABLE, true);
    }
  }
}

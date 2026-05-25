package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.FAILURE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;

import java.util.List;
import java.util.Map;
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
    if (varScope instanceof DelegateExecution execution) {
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
    } else if (varScope instanceof DelegateTask task) {
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

  @SuppressWarnings("unchecked")
  public static List<String> getEntityList(
      Map<String, ?> inputNamespaceMap, WorkflowVariableHandler varHandler) {
    // Each inputNamespaceMap has exactly one entity list key — either the plain "entityList" or
    // one conditional variant (e.g. "true_entityList", "false_entityList", "gold_entityList")
    // produced by a preceding check/completeness node. Multiple *_entityList keys in the same map
    // are not valid; only the first match found will be used.
    for (Map.Entry<String, ?> entry : inputNamespaceMap.entrySet()) {
      String key = entry.getKey();
      String namespace = (String) entry.getValue();
      if (key.endsWith("_" + ENTITY_LIST_VARIABLE) && namespace != null) {
        Object obj = varHandler.getNamespacedVariable(namespace, key);
        if (obj instanceof List) {
          return (List<String>) obj;
        }
      }
    }
    String entityListNamespace = (String) inputNamespaceMap.get(ENTITY_LIST_VARIABLE);
    if (entityListNamespace != null) {
      Object obj = varHandler.getNamespacedVariable(entityListNamespace, ENTITY_LIST_VARIABLE);
      if (obj instanceof List) {
        return (List<String>) obj;
      }
    }
    // Fallback for pre-migration instances that still carry relatedEntity (a plain String)
    String relatedEntityNamespace = (String) inputNamespaceMap.get(RELATED_ENTITY_VARIABLE);
    if (relatedEntityNamespace != null) {
      Object obj =
          varHandler.getNamespacedVariable(relatedEntityNamespace, RELATED_ENTITY_VARIABLE);
      if (obj instanceof String entityLink) {
        return List.of(entityLink);
      }
    }
    LOG.debug(
        "[WorkflowVariable] getEntityList: no entityList found in inputNamespaceMap keys={}",
        inputNamespaceMap.keySet());
    return List.of();
  }

  @SuppressWarnings("unchecked")
  public static List<String> getEntityListFromVariables(
      Map<String, ?> inputNamespaceMap, Map<String, Object> variables) {
    for (Map.Entry<String, ?> entry : inputNamespaceMap.entrySet()) {
      String key = entry.getKey();
      String namespace = (String) entry.getValue();
      if (key.endsWith("_" + ENTITY_LIST_VARIABLE) && namespace != null) {
        Object obj = variables.get(getNamespacedVariableName(namespace, key));
        if (obj instanceof List) {
          return (List<String>) obj;
        }
      }
    }
    String entityListNamespace = (String) inputNamespaceMap.get(ENTITY_LIST_VARIABLE);
    if (entityListNamespace != null) {
      Object obj =
          variables.get(getNamespacedVariableName(entityListNamespace, ENTITY_LIST_VARIABLE));
      if (obj instanceof List) {
        return (List<String>) obj;
      }
    }
    String relatedEntityNamespace = (String) inputNamespaceMap.get(RELATED_ENTITY_VARIABLE);
    if (relatedEntityNamespace != null) {
      Object obj =
          variables.get(getNamespacedVariableName(relatedEntityNamespace, RELATED_ENTITY_VARIABLE));
      if (obj instanceof String entityLink) {
        return List.of(entityLink);
      }
    }
    return List.of();
  }

  public static String getUpdatedByFromVariables(
      Map<String, ?> inputNamespaceMap, Map<String, Object> variables) {
    String namespace = (String) inputNamespaceMap.get(UPDATED_BY_VARIABLE);
    if (namespace == null) {
      return null;
    }
    Object value = variables.get(getNamespacedVariableName(namespace, UPDATED_BY_VARIABLE));
    return value instanceof String s ? s : null;
  }

  public void setFailure(boolean failure) {
    if (failure) {
      varScope.setTransientVariable(FAILURE_VARIABLE, true);
    }
  }
}

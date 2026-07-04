package org.openmetadata.service.governance.workflows;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.governance.workflows.Workflow.FAILURE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_ID_VARIABLE;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.task.service.delegate.DelegateTask;
import org.flowable.variable.api.delegate.VariableScope;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class WorkflowVariableHandler {
  private final VariableScope varScope;
  private static final TypeReference<Map<String, String>> INPUT_NAMESPACE_TYPE =
      new TypeReference<>() {};

  public WorkflowVariableHandler(VariableScope varScope) {
    this.varScope = varScope;
  }

  /**
   * Per-input variable namespace map for a workflow node. A node can read several inputs from
   * different node/global namespaces, so the wrapper is plural: InputNamespaces.
   */
  public static record InputNamespaces(Map<String, String> namespaces) {
    public InputNamespaces {
      namespaces =
          namespaces != null
              ? Collections.unmodifiableMap(new LinkedHashMap<>(namespaces))
              : Map.of();
    }

    public String namespaceFor(String variable) {
      return namespaces.get(variable);
    }

    public String namespaceForOrDefault(String variable, String defaultNamespace) {
      return namespaces.getOrDefault(variable, defaultNamespace);
    }

    public static InputNamespaces from(Expression expr, DelegateExecution execution) {
      return read(expr.getValue(execution));
    }

    public static InputNamespaces read(Object rawValue) {
      Map<String, String> map =
          rawValue instanceof String str
              ? JsonUtils.readValue(str, INPUT_NAMESPACE_TYPE)
              : JsonUtils.convertValue(rawValue, INPUT_NAMESPACE_TYPE);
      return new InputNamespaces(map);
    }
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

  /**
   * Resolves the workflow's related entity by its immutable id when available, falling back to the
   * FQN-based {@link MessageParser.EntityLink}. Resolving by id keeps approval (and any other
   * entity-attribute node) correct after the entity is moved or renamed: its id never changes, only
   * its FQN does, so a stale FQN no longer breaks resolution. The FQN fallback covers in-flight
   * workflows started before {@code relatedEntityId} was recorded at the trigger.
   */
  public EntityInterface getRelatedEntity(
      MessageParser.EntityLink entityLink, String fields, Include include) {
    Object idValue = getNamespacedVariable(GLOBAL_NAMESPACE, RELATED_ENTITY_ID_VARIABLE);
    String relatedEntityId = idValue != null ? idValue.toString() : null;
    EntityInterface entity;
    if (nullOrEmpty(relatedEntityId)) {
      entity = Entity.getEntity(entityLink, fields, include);
    } else {
      entity =
          Entity.getEntity(
              entityLink.getEntityType(), UUID.fromString(relatedEntityId), fields, include);
    }
    return entity;
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

  public void setFailure(boolean failure) {
    if (failure) {
      varScope.setTransientVariable(FAILURE_VARIABLE, true);
    }
  }
}

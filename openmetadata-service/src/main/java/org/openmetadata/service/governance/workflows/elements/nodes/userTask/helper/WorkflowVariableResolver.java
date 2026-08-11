/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.userTask.helper;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.task.service.delegate.DelegateTask;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Type-safe extraction and coercion of workflow variables and expressions from a Flowable
 * DelegateTask. Extracted from {@link
 * org.openmetadata.service.governance.workflows.elements.nodes.userTask.CreateTask} so variable
 * parsing concerns can be tested and reused independently of task creation.
 */
public final class WorkflowVariableResolver {

  private static final TypeReference<List<EntityReference>> ENTITY_REFERENCE_LIST_TYPE =
      new TypeReference<>() {};

  private WorkflowVariableResolver() {}

  public static Object variable(DelegateTask delegateTask, String variableName) {
    return delegateTask.getVariable(variableName);
  }

  public static String stringVariable(DelegateTask delegateTask, String variableName) {
    Object value = variable(delegateTask, variableName);
    return value == null ? null : String.valueOf(value);
  }

  public static String stringExpression(Expression expression, DelegateTask delegateTask) {
    if (expression == null) {
      return null;
    }
    Object value = expression.getValue(delegateTask);
    return value == null ? null : String.valueOf(value);
  }

  public static boolean booleanVariable(DelegateTask delegateTask, String variableName) {
    Object value = variable(delegateTask, variableName);
    if (value instanceof Boolean booleanValue) {
      return booleanValue;
    }
    if (value instanceof String stringValue && !stringValue.isBlank()) {
      return Boolean.parseBoolean(stringValue);
    }
    return false;
  }

  public static Long longVariable(DelegateTask delegateTask, String variableName) {
    Object value = variable(delegateTask, variableName);
    if (value instanceof Number numberValue) {
      return numberValue.longValue();
    }
    if (value instanceof String stringValue && !stringValue.isBlank()) {
      return Long.valueOf(stringValue);
    }
    return null;
  }

  public static Double doubleVariable(DelegateTask delegateTask, String variableName) {
    Object value = variable(delegateTask, variableName);
    if (value instanceof Number numberValue) {
      return numberValue.doubleValue();
    }
    if (value instanceof String stringValue && !stringValue.isBlank()) {
      return Double.valueOf(stringValue);
    }
    return null;
  }

  public static List<EntityReference> entityReferencesVariable(
      DelegateTask delegateTask, String variableName) {
    Object value = variable(delegateTask, variableName);
    if (value == null) {
      return null;
    }
    return value instanceof String stringValue
        ? JsonUtils.readValue(stringValue, ENTITY_REFERENCE_LIST_TYPE)
        : JsonUtils.convertValue(value, ENTITY_REFERENCE_LIST_TYPE);
  }

  public static EntityReference entityReferenceVariable(
      DelegateTask delegateTask, String variableName) {
    Object value = variable(delegateTask, variableName);
    if (value == null) {
      return null;
    }
    return value instanceof String stringValue
        ? JsonUtils.readValue(stringValue, EntityReference.class)
        : JsonUtils.convertValue(value, EntityReference.class);
  }

  /**
   * Read a workflow object variable. If the value is a JSON string ({@code {...}} or
   * {@code [...]}), parse it; otherwise return the raw value.
   */
  public static Object workflowObjectVariable(DelegateTask delegateTask, String variableName) {
    Object value = variable(delegateTask, variableName);
    if (!(value instanceof String stringValue)) {
      return value;
    }
    if (stringValue.isBlank()) {
      return null;
    }

    String trimmedValue = stringValue.trim();
    if (!trimmedValue.startsWith("{") && !trimmedValue.startsWith("[")) {
      return value;
    }

    return JsonUtils.readOrConvertValue(trimmedValue, Object.class);
  }

  /**
   * Resolve an integer threshold from a Flowable expression. Returns the provided default if the
   * expression is null or evaluates to an empty string. Throws {@link NumberFormatException} if the
   * expression evaluates to a non-numeric string (preserved from the original implementation).
   */
  public static Integer getThresholdValue(
      Expression expression, DelegateTask delegateTask, int defaultValue) {
    if (expression != null) {
      String thresholdStr = (String) expression.getValue(delegateTask);
      if (thresholdStr != null && !thresholdStr.isEmpty()) {
        return Integer.parseInt(thresholdStr);
      }
    }
    return defaultValue;
  }
}

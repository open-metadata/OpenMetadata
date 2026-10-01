/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.secrets.masker;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.GitSinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.WebhookSinkConfig;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

/**
 * Masks the credentials of governance workflow sink tasks in API responses and restores them when
 * a client sends the mask back.
 *
 * <p>A sink task's {@code sinkConfig} is typed as a free-form object whose shape depends on {@code
 * sinkType}, so the reflection walk in {@link PasswordEntityMasker} never reaches its secrets. The
 * secret locations are derived from the {@link PasswordField} getters of the typed sink config
 * classes and applied to the raw JSON tree, which leaves every other key (and every omitted
 * default) untouched.
 */
public final class WorkflowDefinitionMasker {
  static final List<JsonPointer> GIT_SECRET_POINTERS = passwordPointers(GitSinkConfig.class);
  static final List<JsonPointer> WEBHOOK_SECRET_POINTERS =
      passwordPointers(WebhookSinkConfig.class);

  private static final String NODES_FIELD = "nodes";
  private static final String SUB_TYPE_FIELD = "subType";
  private static final String OPENMETADATA_PACKAGE = "org.openmetadata";
  private static final JsonPointer SINK_CONFIG_POINTER = JsonPointer.compile("/config/sinkConfig");
  private static final String MASKED_SECRET_MESSAGE =
      "Workflow node '%s' still has a masked secret ('%s'); provide the actual value";

  private WorkflowDefinitionMasker() {}

  /** Returns a copy of {@code definition} with sink secrets masked, including change descriptions. */
  public static WorkflowDefinition mask(WorkflowDefinition definition) {
    WorkflowDefinition masked = JsonUtils.deepCopy(definition, WorkflowDefinition.class);
    listOrEmpty(masked.getNodes()).forEach(WorkflowDefinitionMasker::maskNode);
    maskChangeDescription(masked.getChangeDescription());
    maskChangeDescription(masked.getIncrementalChangeDescription());
    return masked;
  }

  public static EntityHistory mask(EntityHistory history) {
    List<Object> versions =
        listOrEmpty(history.getVersions()).stream()
            .map(WorkflowDefinitionMasker::maskVersion)
            .toList();
    return new EntityHistory().withEntityType(history.getEntityType()).withVersions(versions);
  }

  /**
   * Replaces every masked sink secret in {@code updated} with the stored value of the sink node of
   * the same name in {@code original}. A value other than the mask is kept as sent.
   */
  public static void restoreMaskedSecrets(WorkflowDefinition original, WorkflowDefinition updated) {
    Map<String, SinkTaskDefinition> originalSinkTasks = sinkTasksByName(original);
    sinkTasks(updated)
        .filter(sinkTask -> originalSinkTasks.containsKey(sinkTask.getName()))
        .forEach(sinkTask -> restoreSinkTask(sinkTask, originalSinkTasks.get(sinkTask.getName())));
  }

  /**
   * Rejects a definition whose sink secret is still the mask, which is what remains when no stored
   * secret could be restored for it: a new definition, a new or renamed node, or a node that had no
   * secret.
   */
  public static void requireNoMaskedSecrets(WorkflowDefinition definition) {
    sinkTasks(definition)
        .filter(WorkflowDefinitionMasker::hasSinkConfig)
        .forEach(WorkflowDefinitionMasker::requireNoMaskedSecret);
  }

  private static void requireNoMaskedSecret(SinkTaskDefinition sinkTask) {
    JsonNode sinkConfig = JsonUtils.valueToTree(sinkTask.getConfig().getSinkConfig());
    secretPointers(sinkTask).stream()
        .filter(pointer -> PASSWORD_MASK.equals(sinkConfig.at(pointer).textValue()))
        .findFirst()
        .ifPresent(
            pointer -> {
              throw new BadRequestException(
                  MASKED_SECRET_MESSAGE.formatted(sinkTask.getName(), pointer));
            });
  }

  static List<JsonPointer> passwordPointers(Class<?> type) {
    return passwordPointers(type, JsonPointer.empty());
  }

  private static List<JsonPointer> passwordPointers(Class<?> type, JsonPointer prefix) {
    List<JsonPointer> pointers = new ArrayList<>();
    for (Method method : type.getMethods()) {
      JsonProperty property = method.getAnnotation(JsonProperty.class);
      if (property != null && method.getParameterCount() == 0) {
        pointers.addAll(propertyPointers(method, prefix.appendProperty(property.value())));
      }
    }
    return List.copyOf(pointers);
  }

  private static List<JsonPointer> propertyPointers(Method getter, JsonPointer pointer) {
    Class<?> returnType = getter.getReturnType();
    List<JsonPointer> pointers = List.of();
    if (getter.isAnnotationPresent(PasswordField.class)) {
      pointers = List.of(pointer);
    } else if (!returnType.isEnum()
        && returnType.getPackageName().startsWith(OPENMETADATA_PACKAGE)) {
      pointers = passwordPointers(returnType, pointer);
    }
    return pointers;
  }

  private static List<JsonPointer> secretPointers(SinkTaskDefinition sinkTask) {
    var config = sinkTask.getConfig();
    List<JsonPointer> pointers = List.of();
    if (config != null && config.getSinkType() != null) {
      pointers =
          switch (config.getSinkType()) {
            case GIT -> GIT_SECRET_POINTERS;
            case WEBHOOK -> WEBHOOK_SECRET_POINTERS;
            case HTTP_ENDPOINT -> List.of();
          };
    }
    return pointers;
  }

  private static void maskNode(WorkflowNodeDefinitionInterface node) {
    // Workflow nodes are polymorphic by subType; only sink tasks carry credentials.
    if (node instanceof SinkTaskDefinition sinkTask && hasSinkConfig(sinkTask)) {
      JsonNode sinkConfig = JsonUtils.valueToTree(sinkTask.getConfig().getSinkConfig());
      maskSecrets(sinkConfig, secretPointers(sinkTask));
      sinkTask.getConfig().setSinkConfig(JsonUtils.treeToValue(sinkConfig, SinkConfig.class));
    }
  }

  private static void maskChangeDescription(ChangeDescription change) {
    if (change == null) {
      return;
    }
    Stream.of(change.getFieldsAdded(), change.getFieldsUpdated(), change.getFieldsDeleted())
        .flatMap(fieldChanges -> listOrEmpty(fieldChanges).stream())
        .filter(fieldChange -> NODES_FIELD.equals(fieldChange.getName()))
        .forEach(WorkflowDefinitionMasker::maskFieldChange);
  }

  private static void maskFieldChange(FieldChange fieldChange) {
    fieldChange.setOldValue(maskNodesJson(fieldChange.getOldValue()));
    fieldChange.setNewValue(maskNodesJson(fieldChange.getNewValue()));
  }

  private static Object maskNodesJson(Object value) {
    // FieldChange values are untyped; the updater records the nodes list as a JSON array string.
    Object masked = value;
    if (value instanceof String json && JsonUtils.readTree(json) instanceof ArrayNode nodes) {
      nodes.forEach(WorkflowDefinitionMasker::maskSinkTaskJson);
      masked = JsonUtils.pojoToJson(nodes);
    }
    return masked;
  }

  private static void maskSinkTaskJson(JsonNode node) {
    // The "nodes" field change also carries edge objects, so only sink task elements are parsed.
    if (NodeSubType.SINK_TASK.value().equals(node.path(SUB_TYPE_FIELD).asText())) {
      SinkTaskDefinition sinkTask = JsonUtils.treeToValue(node, SinkTaskDefinition.class);
      maskSecrets(node.at(SINK_CONFIG_POINTER), secretPointers(sinkTask));
    }
  }

  private static Object maskVersion(Object version) {
    // EntityHistory.versions is an untyped List<Object> holding each version's entity JSON.
    return version instanceof String json
        ? JsonUtils.pojoToJson(mask(JsonUtils.readValue(json, WorkflowDefinition.class)))
        : version;
  }

  private static void restoreSinkTask(SinkTaskDefinition updated, SinkTaskDefinition original) {
    if (!hasSinkConfig(updated) || !hasSinkConfig(original)) {
      return;
    }
    JsonNode updatedConfig = JsonUtils.valueToTree(updated.getConfig().getSinkConfig());
    JsonNode originalConfig = JsonUtils.valueToTree(original.getConfig().getSinkConfig());
    List<JsonPointer> maskedPointers =
        secretPointers(updated).stream()
            .filter(pointer -> PASSWORD_MASK.equals(updatedConfig.at(pointer).textValue()))
            .filter(pointer -> originalConfig.at(pointer).isTextual())
            .toList();
    maskedPointers.forEach(
        pointer -> replaceText(updatedConfig, pointer, originalConfig.at(pointer).textValue()));
    if (!maskedPointers.isEmpty()) {
      updated.getConfig().setSinkConfig(JsonUtils.treeToValue(updatedConfig, SinkConfig.class));
    }
  }

  private static void maskSecrets(JsonNode sinkConfig, List<JsonPointer> pointers) {
    pointers.stream()
        .filter(pointer -> sinkConfig.at(pointer).isTextual())
        .forEach(pointer -> replaceText(sinkConfig, pointer, PASSWORD_MASK));
  }

  private static void replaceText(JsonNode root, JsonPointer pointer, String value) {
    // JsonNode.at returns the generic JsonNode type; a secret's parent is always a JSON object.
    if (root.at(pointer.head()) instanceof ObjectNode parent) {
      parent.put(pointer.last().getMatchingProperty(), value);
    }
  }

  private static boolean hasSinkConfig(SinkTaskDefinition sinkTask) {
    return sinkTask.getConfig() != null && sinkTask.getConfig().getSinkConfig() != null;
  }

  private static Map<String, SinkTaskDefinition> sinkTasksByName(WorkflowDefinition definition) {
    return sinkTasks(definition)
        .collect(
            Collectors.toMap(
                SinkTaskDefinition::getName, Function.identity(), (first, second) -> first));
  }

  private static Stream<SinkTaskDefinition> sinkTasks(WorkflowDefinition definition) {
    // Workflow nodes are polymorphic by subType; only sink tasks carry credentials.
    return listOrEmpty(definition.getNodes()).stream()
        .filter(SinkTaskDefinition.class::isInstance)
        .map(SinkTaskDefinition.class::cast);
  }
}

/*
 *  Copyright 2026 Collate
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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
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
import java.util.Objects;
import java.util.Optional;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.GitSinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.WebhookSinkConfig;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.SecretsManager;

/**
 * Masks the credentials of governance workflow sink tasks in API responses and restores them when
 * a client sends the mask back.
 *
 * <p>A sink task's {@code sinkConfig} is typed as a free-form object whose shape depends on {@code
 * sinkType}, so the reflection walk in {@link PasswordEntityMasker} never reaches its secrets. The
 * secret locations are derived from the {@link PasswordField} getters of the typed sink config
 * classes and applied to the raw JSON tree, which leaves every other key (and every omitted
 * default) untouched.
 *
 * <p>The same traversal rewrites the secrets for at-rest encryption, so the set of secret fields is
 * defined once, here.
 */
public final class WorkflowDefinitionMasker {
  static final List<JsonPointer> GIT_SECRET_POINTERS = passwordPointers(GitSinkConfig.class);
  static final List<JsonPointer> WEBHOOK_SECRET_POINTERS =
      passwordPointers(WebhookSinkConfig.class);
  static final List<JsonPointer> ALL_SECRET_POINTERS =
      Stream.of(GIT_SECRET_POINTERS, WEBHOOK_SECRET_POINTERS)
          .flatMap(List::stream)
          .distinct()
          .toList();

  /**
   * The secret fields of each sink type's config, keyed by the sink type value the provider
   * registry also uses. A sink type missing here has every known secret field masked.
   */
  private static final Map<String, List<JsonPointer>> SECRET_POINTERS_BY_SINK_TYPE =
      Map.of(
          "git",
          GIT_SECRET_POINTERS,
          "webhook",
          WEBHOOK_SECRET_POINTERS,
          "httpEndpoint",
          List.of());

  private static final UnaryOperator<String> MASK_SECRET = secret -> PASSWORD_MASK;
  private static final String NODES_FIELD = "nodes";
  private static final String SUB_TYPE_FIELD = "subType";
  private static final String OLD_VALUE_FIELD = "oldValue";
  private static final String NEW_VALUE_FIELD = "newValue";
  private static final String FIELD_CHANGE_NAME = "name";
  static final List<String> CHANGE_DESCRIPTION_FIELDS =
      List.of("changeDescription", "incrementalChangeDescription");
  private static final List<String> FIELD_CHANGE_LISTS =
      List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted");
  private static final String OPENMETADATA_PACKAGE = "org.openmetadata";
  private static final JsonPointer SINK_CONFIG_POINTER = JsonPointer.compile("/config/sinkConfig");

  private WorkflowDefinitionMasker() {}

  /** Returns a copy of {@code definition} with sink secrets masked, including change descriptions. */
  public static WorkflowDefinition mask(WorkflowDefinition definition) {
    JsonNode masked = JsonUtils.valueToTree(definition);
    transformSecrets(masked, MASK_SECRET);
    return JsonUtils.treeToValue(masked, WorkflowDefinition.class);
  }

  public static EntityHistory mask(EntityHistory history) {
    List<Object> versions =
        listOrEmpty(history.getVersions()).stream()
            .map(WorkflowDefinitionMasker::maskVersion)
            .toList();
    return new EntityHistory().withEntityType(history.getEntityType()).withVersions(versions);
  }

  /** Rewrites, in place, every textual sink secret of the nodes of {@code definition}. */
  public static void transformSecrets(
      WorkflowDefinition definition, UnaryOperator<String> transform) {
    sinkTasks(definition)
        .filter(WorkflowDefinitionMasker::hasSinkConfig)
        .forEach(sinkTask -> transformSinkTask(sinkTask, transform));
  }

  /**
   * Whether a sink task of {@code definition} holds a non-empty secret value. Used by the Collate
   * 2.1.0 sink workflow migration; OpenMetadata itself has no caller.
   */
  public static boolean hasSinkSecrets(WorkflowDefinition definition) {
    return sinkTasks(definition)
        .filter(WorkflowDefinitionMasker::hasSinkConfig)
        .anyMatch(WorkflowDefinitionMasker::hasSecret);
  }

  private static boolean hasSecret(SinkTaskDefinition sinkTask) {
    JsonNode sinkConfig = JsonUtils.valueToTree(sinkTask.getConfig().getSinkConfig());
    return secretPointers(sinkTask).stream()
        .anyMatch(pointer -> !nullOrEmpty(sinkConfig.at(pointer).textValue()));
  }

  /**
   * Rewrites, in place, every textual sink secret of a workflow definition JSON tree, including the
   * nodes recorded in its change descriptions. Returns whether any value changed.
   */
  public static boolean transformSecrets(JsonNode definition, UnaryOperator<String> transform) {
    boolean changed = transformSinkTaskArray(definition.path(NODES_FIELD), transform);
    for (String changeDescriptionField : CHANGE_DESCRIPTION_FIELDS) {
      changed |= transformChangeDescription(definition.path(changeDescriptionField), transform);
    }
    return changed;
  }

  /**
   * Returns a copy of a sink config with every textual secret, of any sink type, rewritten. A sink
   * task's runtime config carries no sink type, so the secret locations of every type are applied.
   */
  public static Object transformSinkConfigSecrets(
      Object sinkConfig, UnaryOperator<String> transform) {
    Object transformed = null;
    if (sinkConfig != null) {
      JsonNode tree = JsonUtils.valueToTree(sinkConfig);
      transformText(tree, ALL_SECRET_POINTERS, transform);
      transformed = JsonUtils.treeToValue(tree, Object.class);
    }
    return transformed;
  }

  /**
   * Replaces every masked sink secret in {@code updated} with the stored value of the sink node of
   * the same name in {@code original}. A value other than the mask is kept as sent.
   */
  public static void restoreMaskedSecrets(WorkflowDefinition original, WorkflowDefinition updated) {
    restoreStoredSecrets(original, updated, (incoming, stored) -> PASSWORD_MASK.equals(incoming));
  }

  /**
   * Replaces each sink secret in {@code updated} with the stored value at the same field of the
   * sink node of the same name in {@code original}, where {@code keepStored} accepts the incoming
   * and the stored value. Every other value is kept as sent.
   */
  public static void restoreStoredSecrets(
      WorkflowDefinition original,
      WorkflowDefinition updated,
      BiPredicate<String, String> keepStored) {
    Map<String, SinkTaskDefinition> originalSinkTasks = sinkTasksByName(original);
    sinkTasks(updated)
        .filter(sinkTask -> originalSinkTasks.containsKey(sinkTask.getName()))
        .forEach(
            sinkTask ->
                restoreSinkTask(sinkTask, originalSinkTasks.get(sinkTask.getName()), keepStored));
  }

  /**
   * Whether the sink config deployed for a sink task of {@code definition}, which {@code
   * deployedSinkConfig} returns as JSON for the task's name, holds a plaintext secret: a non-empty
   * value that is neither Fernet ciphertext nor a secret reference. Used by the Collate 2.1.0 sink
   * workflow migration; OpenMetadata itself has no caller.
   */
  public static boolean hasPlaintextDeployedSecret(
      WorkflowDefinition definition, Function<String, Optional<String>> deployedSinkConfig) {
    return sinkTasks(definition)
        .anyMatch(
            sinkTask ->
                deployedSinkConfig
                    .apply(sinkTask.getName())
                    .filter(json -> !json.isBlank())
                    .map(JsonUtils::readTree)
                    .filter(config -> hasPlaintextSecret(config, secretPointers(sinkTask)))
                    .isPresent());
  }

  private static boolean hasPlaintextSecret(JsonNode sinkConfig, List<JsonPointer> pointers) {
    return pointers.stream()
        .map(pointer -> sinkConfig.at(pointer).textValue())
        .anyMatch(WorkflowDefinitionMasker::isPlaintextSecret);
  }

  private static boolean isPlaintextSecret(String value) {
    return !nullOrEmpty(value)
        && !Fernet.isTokenized(value)
        && !value.startsWith(SecretsManager.SECRET_FIELD_PREFIX);
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

  static List<JsonPointer> secretPointers(SinkTaskDefinition sinkTask) {
    var config = sinkTask.getConfig();
    List<JsonPointer> pointers = List.of();
    if (config != null && config.getSinkType() != null) {
      pointers =
          SECRET_POINTERS_BY_SINK_TYPE.getOrDefault(
              config.getSinkType().value(), ALL_SECRET_POINTERS);
    }
    return pointers;
  }

  private static void transformSinkTask(
      SinkTaskDefinition sinkTask, UnaryOperator<String> transform) {
    JsonNode sinkConfig = JsonUtils.valueToTree(sinkTask.getConfig().getSinkConfig());
    if (transformText(sinkConfig, secretPointers(sinkTask), transform)) {
      sinkTask.getConfig().setSinkConfig(JsonUtils.treeToValue(sinkConfig, SinkConfig.class));
    }
  }

  private static boolean transformChangeDescription(
      JsonNode changeDescription, UnaryOperator<String> transform) {
    boolean changed = false;
    for (String fieldChangeList : FIELD_CHANGE_LISTS) {
      for (JsonNode fieldChange : changeDescription.path(fieldChangeList)) {
        changed |= transformNodesFieldChange(fieldChange, transform);
      }
    }
    return changed;
  }

  private static boolean transformNodesFieldChange(
      JsonNode fieldChange, UnaryOperator<String> transform) {
    boolean changed = false;
    if (NODES_FIELD.equals(fieldChange.path(FIELD_CHANGE_NAME).asText())) {
      changed = transformNodesJson(fieldChange, OLD_VALUE_FIELD, transform);
      changed |= transformNodesJson(fieldChange, NEW_VALUE_FIELD, transform);
    }
    return changed;
  }

  private static boolean transformNodesJson(
      JsonNode fieldChange, String valueField, UnaryOperator<String> transform) {
    JsonNode value = fieldChange.path(valueField);
    boolean changed = false;
    // FieldChange values are untyped; the updater records the nodes list as a JSON array string,
    // and a FieldChange is always a JSON object.
    if (value.isTextual()
        && JsonUtils.readTree(value.textValue()) instanceof ArrayNode nodes
        && transformSinkTaskArray(nodes, transform)
        && fieldChange instanceof ObjectNode holder) {
      holder.put(valueField, JsonUtils.pojoToJson(nodes));
      changed = true;
    }
    return changed;
  }

  private static boolean transformSinkTaskArray(JsonNode nodes, UnaryOperator<String> transform) {
    boolean changed = false;
    for (JsonNode node : nodes) {
      changed |= transformSinkTaskJson(node, transform);
    }
    return changed;
  }

  private static boolean transformSinkTaskJson(JsonNode node, UnaryOperator<String> transform) {
    boolean changed = false;
    // The "nodes" field change also carries edge objects, so only sink task elements are parsed.
    if (NodeSubType.SINK_TASK.value().equals(node.path(SUB_TYPE_FIELD).asText())) {
      SinkTaskDefinition sinkTask = JsonUtils.treeToValue(node, SinkTaskDefinition.class);
      changed = transformText(node.at(SINK_CONFIG_POINTER), secretPointers(sinkTask), transform);
    }
    return changed;
  }

  private static Object maskVersion(Object version) {
    // EntityHistory.versions is an untyped List<Object> holding each version's entity JSON.
    Object masked = version;
    if (version instanceof String json) {
      JsonNode tree = JsonUtils.readTree(json);
      transformSecrets(tree, MASK_SECRET);
      masked = JsonUtils.pojoToJson(tree);
    }
    return masked;
  }

  private static void restoreSinkTask(
      SinkTaskDefinition updated,
      SinkTaskDefinition original,
      BiPredicate<String, String> keepStored) {
    if (!hasSinkConfig(updated) || !hasSinkConfig(original)) {
      return;
    }
    JsonNode updatedConfig = JsonUtils.valueToTree(updated.getConfig().getSinkConfig());
    JsonNode originalConfig = JsonUtils.valueToTree(original.getConfig().getSinkConfig());
    List<JsonPointer> restoredPointers =
        secretPointers(updated).stream()
            .filter(pointer -> updatedConfig.at(pointer).isTextual())
            .filter(pointer -> originalConfig.at(pointer).isTextual())
            .filter(
                pointer ->
                    keepStored.test(
                        updatedConfig.at(pointer).textValue(),
                        originalConfig.at(pointer).textValue()))
            .toList();
    restoredPointers.forEach(
        pointer -> replaceText(updatedConfig, pointer, originalConfig.at(pointer).textValue()));
    if (!restoredPointers.isEmpty()) {
      updated.getConfig().setSinkConfig(JsonUtils.treeToValue(updatedConfig, SinkConfig.class));
    }
  }

  private static boolean transformText(
      JsonNode sinkConfig, List<JsonPointer> pointers, UnaryOperator<String> transform) {
    boolean changed = false;
    for (JsonPointer pointer : pointers) {
      String value = sinkConfig.at(pointer).textValue();
      String transformed = value == null ? null : transform.apply(value);
      if (!Objects.equals(value, transformed)) {
        replaceText(sinkConfig, pointer, transformed);
        changed = true;
      }
    }
    return changed;
  }

  private static void replaceText(JsonNode root, JsonPointer pointer, String value) {
    // JsonNode.at returns the generic JsonNode type; a secret's parent is always a JSON object.
    if (root.at(pointer.head()) instanceof ObjectNode parent) {
      parent.put(pointer.last().getMatchingProperty(), value);
    }
  }

  static boolean hasSinkConfig(SinkTaskDefinition sinkTask) {
    return sinkTask.getConfig() != null && sinkTask.getConfig().getSinkConfig() != null;
  }

  static Map<String, SinkTaskDefinition> sinkTasksByName(WorkflowDefinition definition) {
    return sinkTasks(definition)
        .collect(
            Collectors.toMap(
                SinkTaskDefinition::getName, Function.identity(), (first, second) -> first));
  }

  static Stream<SinkTaskDefinition> sinkTasks(WorkflowDefinition definition) {
    // Workflow nodes are polymorphic by subType; only sink tasks carry credentials.
    return listOrEmpty(definition.getNodes()).stream()
        .filter(SinkTaskDefinition.class::isInstance)
        .map(SinkTaskDefinition.class::cast);
  }
}

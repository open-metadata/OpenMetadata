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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
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
import org.openmetadata.service.exception.BadRequestException;
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

  private static final UnaryOperator<String> MASK_SECRET = secret -> PASSWORD_MASK;
  private static final String NODES_FIELD = "nodes";
  private static final String SUB_TYPE_FIELD = "subType";
  private static final String OLD_VALUE_FIELD = "oldValue";
  private static final String NEW_VALUE_FIELD = "newValue";
  private static final String FIELD_CHANGE_NAME = "name";
  private static final List<String> CHANGE_DESCRIPTION_FIELDS =
      List.of("changeDescription", "incrementalChangeDescription");
  private static final List<String> FIELD_CHANGE_LISTS =
      List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted");
  private static final String OPENMETADATA_PACKAGE = "org.openmetadata";
  private static final JsonPointer SINK_CONFIG_POINTER = JsonPointer.compile("/config/sinkConfig");
  private static final String MASKED_SECRET_MESSAGE =
      "Workflow node '%s' still has a masked secret ('%s'); provide the actual value";
  private static final String ENCRYPTED_SECRET_MESSAGE =
      """
      Workflow node '%s' has an encrypted secret ('%s'); encrypted values cannot be supplied, \
      provide the actual value\
      """;

  private static final String COPIED_SECRET_MESSAGE =
      "A sink secret cannot be copied or moved out of its field; it was found at '%s'";

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

  /** Whether a sink task of {@code definition} holds a non-empty secret value. */
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

  /**
   * Rejects an encrypted sink secret in a new definition: only the server encrypts secrets, and a
   * new definition has no stored value one could match.
   */
  public static void requireNoEncryptedSecrets(WorkflowDefinition definition) {
    requireStoredEncryptedSecrets(Map.of(), definition);
  }

  /**
   * Rejects an encrypted sink secret in {@code updated} that is not the value stored for the same
   * field of the sink node of the same name in {@code original}. Every secret location of every
   * sink type is checked, as the runtime decrypts all of them whatever the sink type.
   */
  public static void requireStoredEncryptedSecrets(
      WorkflowDefinition original, WorkflowDefinition updated) {
    requireStoredEncryptedSecrets(sinkTasksByName(original), updated);
  }

  private static void requireStoredEncryptedSecrets(
      Map<String, SinkTaskDefinition> storedSinkTasks, WorkflowDefinition updated) {
    sinkTasks(updated)
        .filter(WorkflowDefinitionMasker::hasSinkConfig)
        .forEach(
            sinkTask ->
                requireStoredEncryptedSecret(
                    sinkTask, storedSinkConfig(storedSinkTasks.get(sinkTask.getName()))));
  }

  private static void requireStoredEncryptedSecret(
      SinkTaskDefinition sinkTask, JsonNode storedConfig) {
    JsonNode sinkConfig = JsonUtils.valueToTree(sinkTask.getConfig().getSinkConfig());
    ALL_SECRET_POINTERS.stream()
        .filter(pointer -> Fernet.isTokenized(sinkConfig.at(pointer).textValue()))
        .filter(
            pointer ->
                !sinkConfig.at(pointer).textValue().equals(storedConfig.at(pointer).textValue()))
        .findFirst()
        .ifPresent(
            pointer -> {
              throw new BadRequestException(
                  ENCRYPTED_SECRET_MESSAGE.formatted(sinkTask.getName(), pointer));
            });
  }

  /**
   * Rejects {@code updated} when a sink secret stored in {@code original} appears anywhere but a
   * sink secret field, as a JSON Patch {@code copy} or {@code move} from a secret location leaves
   * it. Masking covers only the secret fields, so a secret anywhere else would be served as stored.
   */
  public static void requireSecretsOnlyInSecretFields(
      WorkflowDefinition original, WorkflowDefinition updated) {
    Set<String> storedSecrets = storedSecrets(original);
    if (!storedSecrets.isEmpty()) {
      JsonNode withoutSecretFields = callerSetFields(updated);
      transformSecrets(withoutSecretFields, secret -> "");
      findText(withoutSecretFields, JsonPointer.empty(), storedSecrets)
          .ifPresent(
              pointer -> {
                throw new BadRequestException(COPIED_SECRET_MESSAGE.formatted(pointer));
              });
    }
  }

  /**
   * The JSON of {@code definition} without its change descriptions: the server writes those and
   * replaces them on every update, and an earlier one may still record a secret.
   */
  private static JsonNode callerSetFields(WorkflowDefinition definition) {
    JsonNode json = JsonUtils.valueToTree(definition);
    // A WorkflowDefinition always serializes to a JSON object.
    if (json instanceof ObjectNode definitionJson) {
      definitionJson.remove(CHANGE_DESCRIPTION_FIELDS);
    }
    return json;
  }

  private static Set<String> storedSecrets(WorkflowDefinition original) {
    Set<String> secrets = new HashSet<>();
    transformSecrets(
        JsonUtils.valueToTree(original),
        secret -> {
          secrets.add(secret);
          return secret;
        });
    secrets.removeIf(secret -> secret.isBlank() || PASSWORD_MASK.equals(secret));
    return secrets;
  }

  /** The location of the first text value under {@code node} that contains one of {@code values}. */
  private static Optional<JsonPointer> findText(
      JsonNode node, JsonPointer pointer, Set<String> values) {
    Optional<JsonPointer> found = Optional.empty();
    if (node.isTextual()) {
      String text = node.textValue();
      found = values.stream().anyMatch(text::contains) ? Optional.of(pointer) : found;
    } else if (node.isArray()) {
      for (int i = 0; i < node.size() && found.isEmpty(); i++) {
        found = findText(node.get(i), pointer.appendIndex(i), values);
      }
    } else {
      for (var fields = node.properties().iterator(); fields.hasNext() && found.isEmpty(); ) {
        var field = fields.next();
        found = findText(field.getValue(), pointer.appendProperty(field.getKey()), values);
      }
    }
    return found;
  }

  /** The stored sink config of {@code stored}, or a missing node when there is none. */
  private static JsonNode storedSinkConfig(SinkTaskDefinition stored) {
    JsonNode storedConfig = MissingNode.getInstance();
    if (stored != null && hasSinkConfig(stored)) {
      storedConfig = JsonUtils.valueToTree(stored.getConfig().getSinkConfig());
    }
    return storedConfig;
  }

  /**
   * Whether the sink config deployed for a sink task of {@code definition}, which {@code
   * deployedSinkConfig} returns as JSON for the task's name, holds a plaintext secret: a non-empty
   * value that is neither Fernet ciphertext nor a secret reference.
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

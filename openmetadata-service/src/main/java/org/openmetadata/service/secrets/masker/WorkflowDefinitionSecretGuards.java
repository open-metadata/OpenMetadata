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

import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonPatch;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.util.JsonPatchUtils;

/**
 * Write-time checks on the sink secrets of a governance workflow definition: no mask left where no
 * stored value could replace it, no ciphertext the server did not store for that field, and no
 * stored secret read out of its field by a JSON Patch.
 *
 * <p>The secret locations come from {@link WorkflowDefinitionMasker}, which masks and restores the
 * same fields.
 */
public final class WorkflowDefinitionSecretGuards {
  private static final String MASKED_SECRET_MESSAGE =
      "Workflow node '%s' still has a masked secret ('%s'); provide the actual value";
  private static final String ENCRYPTED_SECRET_MESSAGE =
      """
      Workflow node '%s' has an encrypted secret ('%s'); encrypted values cannot be supplied, \
      provide the actual value\
      """;
  private static final String COPIED_SECRET_MESSAGE =
      "A sink secret cannot be copied or moved out of its field; it was found at '%s'";

  /** Set from the request after a patch is applied, so a value a patch puts there never stays. */
  private static final String UPDATED_BY_FIELD = "updatedBy";

  private WorkflowDefinitionSecretGuards() {}

  /**
   * Rejects a definition whose sink secret is still the mask, which is what remains when no stored
   * secret could be restored for it: a new definition, a new or renamed node, or a node that had no
   * secret.
   */
  public static void requireNoMaskedSecrets(WorkflowDefinition definition) {
    WorkflowDefinitionMasker.sinkTasks(definition)
        .filter(WorkflowDefinitionMasker::hasSinkConfig)
        .forEach(WorkflowDefinitionSecretGuards::requireNoMaskedSecret);
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
    requireStoredEncryptedSecrets(WorkflowDefinitionMasker.sinkTasksByName(original), updated);
  }

  /**
   * Rejects {@code patched}, the result of applying {@code patch} to {@code original}, when the
   * patch reads from another location ({@code copy} or {@code move}) and a sink secret stored in
   * {@code original} now appears anywhere but a sink secret field. Masking covers only the secret
   * fields, so a secret anywhere else would be served as stored. A caller only ever reads the mask,
   * so copy and move are the only way a request can place a stored secret elsewhere.
   */
  public static void requireSecretsOnlyInSecretFields(
      WorkflowDefinition original, WorkflowDefinition patched, JsonPatch patch) {
    if (JsonPatchUtils.readsFromAnotherPath(patch)) {
      requireStoredSecretsOnlyInSecretFields(original, patched);
    }
  }

  private static void requireStoredSecretsOnlyInSecretFields(
      WorkflowDefinition original, WorkflowDefinition patched) {
    Set<String> storedSecrets = storedSecrets(original);
    if (!storedSecrets.isEmpty()) {
      JsonNode withoutSecretFields = callerSetFields(patched);
      WorkflowDefinitionMasker.transformSecrets(withoutSecretFields, secret -> "");
      findText(withoutSecretFields, JsonPointer.empty(), storedSecrets)
          .ifPresent(
              pointer -> {
                throw new BadRequestException(COPIED_SECRET_MESSAGE.formatted(pointer));
              });
    }
  }

  private static void requireNoMaskedSecret(SinkTaskDefinition sinkTask) {
    JsonNode sinkConfig = JsonUtils.valueToTree(sinkTask.getConfig().getSinkConfig());
    WorkflowDefinitionMasker.secretPointers(sinkTask).stream()
        .filter(pointer -> PASSWORD_MASK.equals(sinkConfig.at(pointer).textValue()))
        .findFirst()
        .ifPresent(
            pointer -> {
              throw new BadRequestException(
                  MASKED_SECRET_MESSAGE.formatted(sinkTask.getName(), pointer));
            });
  }

  private static void requireStoredEncryptedSecrets(
      Map<String, SinkTaskDefinition> storedSinkTasks, WorkflowDefinition updated) {
    WorkflowDefinitionMasker.sinkTasks(updated)
        .filter(WorkflowDefinitionMasker::hasSinkConfig)
        .forEach(
            sinkTask ->
                requireStoredEncryptedSecret(
                    sinkTask, storedSinkConfig(storedSinkTasks.get(sinkTask.getName()))));
  }

  private static void requireStoredEncryptedSecret(
      SinkTaskDefinition sinkTask, JsonNode storedConfig) {
    JsonNode sinkConfig = JsonUtils.valueToTree(sinkTask.getConfig().getSinkConfig());
    WorkflowDefinitionMasker.ALL_SECRET_POINTERS.stream()
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

  /** The stored sink config of {@code stored}, or a missing node when there is none. */
  private static JsonNode storedSinkConfig(SinkTaskDefinition stored) {
    JsonNode storedConfig = MissingNode.getInstance();
    if (stored != null && WorkflowDefinitionMasker.hasSinkConfig(stored)) {
      storedConfig = JsonUtils.valueToTree(stored.getConfig().getSinkConfig());
    }
    return storedConfig;
  }

  /**
   * The JSON of {@code definition} without the fields the server writes: its change descriptions,
   * which may still record an earlier secret and are replaced on every update, and {@code
   * updatedBy}, set from the request after the patch is applied.
   */
  private static JsonNode callerSetFields(WorkflowDefinition definition) {
    JsonNode json = JsonUtils.valueToTree(definition);
    // A WorkflowDefinition always serializes to a JSON object.
    if (json instanceof ObjectNode definitionJson) {
      definitionJson.remove(WorkflowDefinitionMasker.CHANGE_DESCRIPTION_FIELDS);
      definitionJson.remove(UPDATED_BY_FIELD);
    }
    return json;
  }

  private static Set<String> storedSecrets(WorkflowDefinition original) {
    Set<String> secrets = new HashSet<>();
    WorkflowDefinitionMasker.transformSecrets(
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
}

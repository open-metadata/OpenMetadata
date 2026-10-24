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

package org.openmetadata.service.alerting.channel;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.util.JsonPatchUtils;

/** What a request may say about a destination's secrets, and what only the server may. */
public final class DestinationSecretGuards {
  private static final String MASKED_MESSAGE =
      "Destination %s still has a masked value at '%s'; provide the actual value";
  private static final String ENCRYPTED_MESSAGE =
      "Destination %s has an encrypted value at '%s'; encrypted values cannot be supplied, provide the actual value";
  private static final String CHANGED_FOR_TEST_MESSAGE =
      "Destination %s is tested with its stored credentials; to test changed credentials, enter every one of them";
  private static final String COPIED_MESSAGE =
      "A destination secret cannot be copied or moved out of its field; it was found at '%s'";
  private static final List<String> SERVER_SET_FIELDS =
      List.of("changeDescription", "incrementalChangeDescription", "updatedBy");

  private DestinationSecretGuards() {}

  /** A mask that no stored value could be restored for stands for nothing. */
  public static void requireNoMaskedSecrets(List<SubscriptionDestination> destinations) {
    listOrEmpty(destinations)
        .forEach(
            destination ->
                firstSecret(destination, value -> PASSWORD_MASK.equals(value))
                    .ifPresent(field -> refuse(MASKED_MESSAGE, destination, field)));
  }

  /** Only the server encrypts: ciphertext in a request is refused where nothing is stored. */
  public static void requireNoCiphertext(List<SubscriptionDestination> destinations) {
    listOrEmpty(destinations)
        .forEach(
            destination ->
                firstSecret(destination, Fernet::isTokenized)
                    .ifPresent(field -> refuse(ENCRYPTED_MESSAGE, destination, field)));
  }

  /** Ciphertext in an update must be the value stored at the same field of the same destination. */
  public static void requireStoredCiphertext(
      EventSubscription original, EventSubscription updated) {
    List<SubscriptionDestination> stored = listOrEmpty(original.getDestinations());
    List<SubscriptionDestination> incoming = listOrEmpty(updated.getDestinations());
    for (int position = 0; position < incoming.size(); position++) {
      SubscriptionDestination destination = incoming.get(position);
      JsonNode storedConfig =
          DestinationSecrets.counterpart(stored, destination, position)
              .map(it -> JsonUtils.valueToTree(it.getConfig()))
              .orElse(JsonUtils.getObjectNode());
      firstSecret(
              destination,
              (field, value) ->
                  Fernet.isTokenized(value) && !value.equals(storedConfig.at(field).textValue()))
          .ifPresent(field -> refuse(ENCRYPTED_MESSAGE, destination, field));
    }
  }

  /** Every secret of a destination tested with stored credentials must be the stored one. */
  public static void requireSecretsAsStored(
      SubscriptionDestination stored, SubscriptionDestination submitted) {
    JsonNode storedConfig = JsonUtils.valueToTree(stored.getConfig());
    firstSecret(submitted, (field, value) -> !value.equals(storedConfig.at(field).textValue()))
        .ifPresent(field -> refuse(CHANGED_FOR_TEST_MESSAGE, submitted, field));
  }

  /**
   * A caller only ever reads the mask, so a copy or move operation is the one way a request can
   * place a stored secret where it is served as stored. Rejects {@code patched}, the result of
   * applying {@code patch} to {@code original}, when such an operation leaves a stored secret
   * anywhere but a secret field.
   */
  public static void requireSecretsOnlyInSecretFields(
      EventSubscription original, EventSubscription patched, JsonPatch patch) {
    if (JsonPatchUtils.readsFromAnotherPath(patch)) {
      Set<String> secrets = storedSecrets(original);
      if (!secrets.isEmpty()) {
        findText(callerSetFields(patched), JsonPointer.empty(), secrets)
            .ifPresent(
                pointer -> {
                  throw new BadRequestException(COPIED_MESSAGE.formatted(pointer));
                });
      }
    }
  }

  private interface SecretTest {
    boolean fails(JsonPointer field, String value);
  }

  private static Optional<JsonPointer> firstSecret(
      SubscriptionDestination destination, Predicate<String> failing) {
    return firstSecret(destination, (field, value) -> failing.test(value));
  }

  private static Optional<JsonPointer> firstSecret(
      SubscriptionDestination destination, SecretTest test) {
    JsonNode config = JsonUtils.valueToTree(destination.getConfig());
    return DestinationSecrets.secretFieldsOf(destination, config).stream()
        .filter(field -> test.fails(field, config.at(field).textValue()))
        .findFirst();
  }

  private static void refuse(String message, SubscriptionDestination destination, JsonPointer at) {
    throw new BadRequestException(message.formatted(destination.getId(), at));
  }

  private static Set<String> storedSecrets(EventSubscription original) {
    Set<String> secrets = new HashSet<>();
    for (SubscriptionDestination destination : listOrEmpty(original.getDestinations())) {
      JsonNode config = JsonUtils.valueToTree(destination.getConfig());
      DestinationSecrets.secretFieldsOf(destination, config)
          .forEach(field -> secrets.add(config.at(field).textValue()));
    }
    secrets.removeIf(secret -> secret.isBlank() || PASSWORD_MASK.equals(secret));
    return secrets;
  }

  // Without the fields the server writes, and with the secret fields blanked: what the caller set.
  private static JsonNode callerSetFields(EventSubscription patched) {
    EventSubscription blanked = DestinationSecrets.mask(patched);
    ObjectNode json = (ObjectNode) JsonUtils.valueToTree(blanked);
    json.remove(SERVER_SET_FIELDS);
    return json;
  }

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
    } else if (node.isObject()) {
      var fields = node.properties().iterator();
      while (fields.hasNext() && found.isEmpty()) {
        var field = fields.next();
        found = findText(field.getValue(), pointer.appendProperty(field.getKey()), values);
      }
    }
    return found;
  }
}

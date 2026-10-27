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
  private static final String MOVED_TARGET_MESSAGE =
      "Destination %s no longer sends to its stored endpoint or token URL; to change where a destination sends, enter every one of its credentials again";
  private static final String SERVED_CHANNEL_MESSAGE =
      "Destination %s changes its served channel from '%s' to '%s'; a destination keeps its channel, so delete it and add a destination for the new channel instead";
  private static final String COPIED_MESSAGE =
      "A destination secret cannot be copied or moved out of its field; it was found at '%s'";
  private static final JsonPointer TOKEN_URL = JsonPointer.compile("/authType/tokenUrl");
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
                  Fernet.isTokenized(value) && !value.equals(storedConfig.at(field).asText(null)))
          .ifPresent(field -> refuse(ENCRYPTED_MESSAGE, destination, field));
    }
  }

  /**
   * A destination an update keeps by its id serves through the channel it is stored under: its
   * configuration belongs to that channel, and so do the secrets encrypted and masked by its rules.
   * A save naming another channel would leave them unprotected, so it is refused here, before any
   * secret is read. A replacement destination carries a new id and needs no guard.
   */
  public static void requireServedChannelUnchanged(
      EventSubscription original, EventSubscription updated) {
    List<SubscriptionDestination> stored = listOrEmpty(original.getDestinations());
    for (SubscriptionDestination sent : listOrEmpty(updated.getDestinations())) {
      if (sent.getId() == null || sent.getType() == null) {
        continue;
      }
      stored.stream()
          .filter(it -> sent.getId().equals(it.getId()) && it.getType() != null)
          .findFirst()
          .ifPresent(storedOne -> requireTheSameChannel(storedOne, sent));
    }
  }

  private static void requireTheSameChannel(
      SubscriptionDestination stored, SubscriptionDestination sent) {
    String storedChannel = ChannelResolution.of(stored).channelId();
    String sentChannel = ChannelResolution.of(sent).channelId();
    if (!storedChannel.equals(sentChannel)) {
      throw new BadRequestException(
          SERVED_CHANNEL_MESSAGE.formatted(sent.getId(), storedChannel, sentChannel));
    }
  }

  /**
   * A secret restored beside a moved target would be delivered to the target the request chose,
   * and a caller who only ever read the mask cannot be allowed to choose it. So a destination
   * whose endpoint or token URL the update moves carries every secret again: a mask left as read,
   * or the stored ciphertext an earlier request left in place, is refused, as testDestination
   * refuses one.
   */
  public static void requireFreshSecretsOnAMovedTarget(
      EventSubscription original, EventSubscription updated) {
    List<SubscriptionDestination> stored = listOrEmpty(original.getDestinations());
    List<SubscriptionDestination> incoming = listOrEmpty(updated.getDestinations());
    for (int position = 0; position < incoming.size(); position++) {
      SubscriptionDestination sent = incoming.get(position);
      DestinationSecrets.counterpart(stored, sent, position)
          .filter(it -> DestinationSecrets.targetMoved(it, sent))
          .ifPresent(
              it ->
                  firstSecret(
                          sent, value -> PASSWORD_MASK.equals(value) || Fernet.isTokenized(value))
                      .ifPresent(field -> refuse(MOVED_TARGET_MESSAGE, sent, field)));
    }
  }

  /** Every secret of a destination tested with stored credentials must be the stored one. */
  public static void requireSecretsAsStored(
      SubscriptionDestination stored, SubscriptionDestination submitted) {
    JsonNode storedConfig = JsonUtils.valueToTree(stored.getConfig());
    firstSecret(submitted, (field, value) -> !value.equals(storedConfig.at(field).asText(null)))
        .ifPresent(field -> refuse(CHANGED_FOR_TEST_MESSAGE, submitted, field));
    // OAuth credentials are sent to the token URL, not the webhook endpoint. Keeping only the
    // secret fields unchanged would allow a test to send stored credentials to another server.
    JsonNode submittedConfig = JsonUtils.valueToTree(submitted.getConfig());
    if (!storedConfig.at(TOKEN_URL).equals(submittedConfig.at(TOKEN_URL))) {
      refuse(CHANGED_FOR_TEST_MESSAGE, submitted, TOKEN_URL);
    }
  }

  /**
   * A caller only ever reads the mask, so a copy or move operation is the one way a request can
   * place a stored secret where it is served as stored. Rejects {@code patched}, the result of
   * applying {@code patch} to {@code original}, when such an operation introduces a stored secret
   * anywhere but a secret field. Unchanged values may already coincide with a legacy secret.
   */
  public static void requireSecretsOnlyInSecretFields(
      EventSubscription original, EventSubscription patched, JsonPatch patch) {
    if (JsonPatchUtils.readsFromAnotherPath(patch)) {
      Set<String> secrets = storedSecrets(original);
      if (!secrets.isEmpty()) {
        findText(callerSetFields(patched), callerSetFields(original), JsonPointer.empty(), secrets)
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
        .filter(field -> test.fails(field, config.at(field).asText()))
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
          .forEach(field -> secrets.add(config.at(field).asText()));
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
      JsonNode node, JsonNode original, JsonPointer pointer, Set<String> values) {
    if (node.equals(original)) {
      return Optional.empty();
    }
    Optional<JsonPointer> found = Optional.empty();
    if (node.isTextual()) {
      String text = node.textValue();
      found = values.stream().anyMatch(text::contains) ? Optional.of(pointer) : found;
    } else if (node.isValueNode() && !node.isNull()) {
      found = values.contains(node.asText()) ? Optional.of(pointer) : found;
    } else if (node.isArray()) {
      for (int i = 0; i < node.size() && found.isEmpty(); i++) {
        found = findText(node.get(i), original.path(i), pointer.appendIndex(i), values);
      }
    } else if (node.isObject()) {
      var fields = node.properties().iterator();
      while (fields.hasNext() && found.isEmpty()) {
        var field = fields.next();
        found =
            findText(
                field.getValue(),
                original.path(field.getKey()),
                pointer.appendProperty(field.getKey()),
                values);
      }
    }
    return found;
  }
}

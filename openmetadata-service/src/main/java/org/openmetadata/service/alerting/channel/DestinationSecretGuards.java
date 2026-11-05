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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.util.JsonPatchUtils;

/** What a request may say about a destination's secrets, and what only the server may. */
public final class DestinationSecretGuards {
  private static final String MASKED_MESSAGE =
      "Enter the %2$s of the %1$s destination again; a hidden value cannot be used here";
  private static final String ENCRYPTED_MESSAGE =
      "Enter the %2$s of the %1$s destination again; an encrypted value cannot be supplied";
  private static final String CHANGED_FOR_TEST_MESSAGE =
      "You changed the %2$s of the %1$s destination; to test it, enter all of its hidden values again";
  private static final String MOVED_TARGET_MESSAGE =
      "You changed where the %1$s destination sends; enter its %2$s again";
  private static final String UNKEPT_SECRET_MESSAGE =
      "The %1$s destination cannot move to %3$s while it keeps its %2$s; remove it first, or add a new destination instead";
  private static final String COPIED_MESSAGE =
      "A destination secret cannot be copied or moved out of its field; it was found at '%s'";
  private static final String CARRIED_MESSAGE =
      "The %1$s destination cannot keep its %2$s on %3$s, which would not keep it secret; enter it again, or add a new destination instead";
  private static final String UNREPLAYED_MESSAGE =
      "A patch may not depend on the value of a destination secret, such as by testing it";
  private static final JsonPointer TOKEN_URL = JsonPointer.compile("/authType/tokenUrl");
  private static final List<String> SERVER_SET_FIELDS =
      List.of("changeDescription", "incrementalChangeDescription", "updatedBy");
  private static final String DESTINATION_CONFIG = "/destinations/%d/config";
  // Stands in for every stored secret while a patch is replayed, followed by the destination and
  // the field it is stored at; unguessable, so a patch cannot write it on purpose and pass a
  // carried secret off as one it entered.
  private static final String LEFT_IN_PLACE = "left-in-place:" + UUID.randomUUID() + ":";

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
   * A destination an update keeps by its id may move to another channel, but every value its stored
   * channel keeps secret must stay secret under the new one, or it would be stored and served as
   * written. Webhook, Slack, Microsoft Teams and Google Chat keep the same fields secret; email and
   * the activity feed keep none, so only a stored secret left behind on such a channel is refused.
   * A replacement destination carries a new id and needs no guard.
   */
  public static void requireStoredSecretsStaySecret(
      EventSubscription original, EventSubscription updated) {
    List<SubscriptionDestination> stored = listOrEmpty(original.getDestinations());
    for (SubscriptionDestination sent : listOrEmpty(updated.getDestinations())) {
      if (sent.getId() == null || sent.getType() == null) {
        continue;
      }
      stored.stream()
          .filter(it -> sent.getId().equals(it.getId()) && it.getType() != null)
          .findFirst()
          .ifPresent(storedOne -> requireSecretsKeptSecret(storedOne, sent));
    }
  }

  private static boolean holdsAValue(JsonNode node) {
    return node.isValueNode() && !node.isNull();
  }

  private static void requireSecretsKeptSecret(
      SubscriptionDestination stored, SubscriptionDestination sent) {
    JsonNode storedConfig = JsonUtils.valueToTree(stored.getConfig());
    JsonNode sentConfig = JsonUtils.valueToTree(sent.getConfig());
    List<JsonPointer> keptSecret = DestinationSecrets.secretFieldsOf(sent, sentConfig);
    DestinationSecrets.secretFieldsOf(stored, storedConfig).stream()
        .filter(field -> holdsAValue(sentConfig.at(field)) && !keptSecret.contains(field))
        .findFirst()
        .ifPresent(
            field ->
                refuse(
                    UNKEPT_SECRET_MESSAGE, stored, field, ChannelResolution.of(sent).channelId()));
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

  /**
   * The PATCH form of both guards above. A patch is applied to the alert as stored, so a secret
   * field it does not write keeps the stored value: in a row stored before secrets were encrypted,
   * the plaintext, which the caller never read either, and which reads as entered to the form
   * above. The same patch replayed on the stored alert with a marker at every secret leaves the
   * marker wherever it wrote nothing. That tells a secret the patch entered again from one it
   * carried, and a carried one must stay protected by the destination that keeps it: it stays in
   * the field of the destination it was stored in, whatever id the patch gives that destination,
   * it may not follow a moved target, and its channel must still name its field a secret, or the
   * value would be stored and served in the clear.
   */
  public static void requireUnwrittenSecretsStayProtected(
      EventSubscription original, EventSubscription updated, JsonPatch patch) {
    List<SubscriptionDestination> incoming = listOrEmpty(updated.getDestinations());
    if (!incoming.isEmpty()) {
      List<SubscriptionDestination> stored = listOrEmpty(original.getDestinations());
      JsonNode replayed = replayedOnMarkedSecrets(original, patch);
      for (int position = 0; position < incoming.size(); position++) {
        JsonNode config = replayed.at(DESTINATION_CONFIG.formatted(position));
        requireCarriedSecretsStayProtected(stored, incoming.get(position), position, config);
      }
    }
  }

  private static void requireCarriedSecretsStayProtected(
      List<SubscriptionDestination> stored,
      SubscriptionDestination sent,
      int position,
      JsonNode config) {
    List<JsonPointer> secretFields = DestinationSecrets.secretFieldsOf(sent, config);
    OptionalInt own = DestinationSecrets.counterpartIndex(stored, sent, position);
    boolean moved =
        own.isPresent() && DestinationSecrets.targetMoved(stored.get(own.getAsInt()), sent);
    carriedIn(config)
        .forEach(
            (at, carried) -> {
              if (!secretFields.contains(at)) {
                refuse(
                    CARRIED_MESSAGE,
                    stored.get(carried.destination()),
                    at,
                    ChannelResolution.of(sent).channelId());
              }
              if (!carried.isStoredAt(own, at)) {
                throw new BadRequestException(
                    COPIED_MESSAGE.formatted(DESTINATION_CONFIG.formatted(position) + at));
              }
              if (moved) {
                refuse(MOVED_TARGET_MESSAGE, sent, at);
              }
            });
  }

  // The patch already applied to the alert as stored, so a replay that fails on the markers is one
  // that reads a secret's value, a test operation on it, say: it is refused rather than guessed at.
  private static JsonNode replayedOnMarkedSecrets(EventSubscription original, JsonPatch patch) {
    EventSubscription marked = JsonUtils.deepCopy(original, EventSubscription.class);
    List<SubscriptionDestination> destinations = listOrEmpty(marked.getDestinations());
    for (int index = 0; index < destinations.size(); index++) {
      markSecrets(destinations.get(index), index);
    }
    try {
      return JsonUtils.valueToTree(JsonUtils.applyPatch(marked, patch, EventSubscription.class));
    } catch (RuntimeException e) {
      throw new BadRequestException(UNREPLAYED_MESSAGE);
    }
  }

  private static void markSecrets(SubscriptionDestination destination, int index) {
    JsonNode config = JsonUtils.valueToTree(destination.getConfig());
    DestinationSecrets.secretFieldsOf(destination, config)
        .forEach(
            field -> DestinationSecrets.set(config, field, new Carried(index, field).marker()));
    destination.withConfig(JsonUtils.treeToValue(config, Object.class));
  }

  /** A stored secret a patch left in place: the destination and the field it is stored at. */
  private record Carried(int destination, JsonPointer field) {
    private static Optional<Carried> of(String text) {
      Optional<Carried> carried = Optional.empty();
      if (text.startsWith(LEFT_IN_PLACE)) {
        String origin = text.substring(LEFT_IN_PLACE.length());
        int separator = origin.indexOf(':');
        carried =
            Optional.of(
                new Carried(
                    Integer.parseInt(origin.substring(0, separator)),
                    JsonPointer.compile(origin.substring(separator + 1))));
      }
      return carried;
    }

    private String marker() {
      return LEFT_IN_PLACE + destination + ":" + field;
    }

    private boolean isStoredAt(OptionalInt storedDestination, JsonPointer at) {
      return storedDestination.isPresent()
          && storedDestination.getAsInt() == destination
          && field.equals(at);
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
    throw new BadRequestException(
        message.formatted(DestinationLabels.of(destination), DestinationLabels.field(at)));
  }

  private static void refuse(
      String message, SubscriptionDestination destination, JsonPointer at, String channel) {
    throw new BadRequestException(
        message.formatted(
            DestinationLabels.of(destination),
            DestinationLabels.field(at),
            DestinationLabels.channel(channel)));
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

  /** Every stored secret the request left in this configuration, by where it ends up. */
  private static Map<JsonPointer, Carried> carriedIn(JsonNode config) {
    Map<JsonPointer, Carried> found = new LinkedHashMap<>();
    collectCarried(config, JsonPointer.empty(), found);
    return found;
  }

  private static void collectCarried(
      JsonNode node, JsonPointer pointer, Map<JsonPointer, Carried> found) {
    if (node.isTextual()) {
      Carried.of(node.textValue()).ifPresent(carried -> found.put(pointer, carried));
    } else if (node.isArray()) {
      for (int i = 0; i < node.size(); i++) {
        collectCarried(node.get(i), pointer.appendIndex(i), found);
      }
    } else if (node.isObject()) {
      node.properties()
          .forEach(
              field ->
                  collectCarried(field.getValue(), pointer.appendProperty(field.getKey()), found));
    }
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

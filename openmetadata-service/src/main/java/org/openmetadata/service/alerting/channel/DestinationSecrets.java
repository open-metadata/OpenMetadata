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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;

/**
 * What a destination's configuration holds that must not be stored or read back in the clear: the
 * secrets its channel names. They are encrypted before an alert is stored, decrypted only where a
 * message is sent, and masked in every response. A response sent back as it was read carries the
 * mask, which stands for the stored value.
 */
public final class DestinationSecrets {
  private static final String DESTINATIONS = "destinations";
  private static final String CONFIG = "config";
  private static final String FIELD_CHANGE_NAME = "name";
  private static final List<String> CHANGE_DESCRIPTIONS =
      List.of("changeDescription", "incrementalChangeDescription");
  private static final List<String> FIELD_CHANGE_LISTS =
      List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted");
  private static final List<String> FIELD_CHANGE_VALUES = List.of("oldValue", "newValue");

  private DestinationSecrets() {}

  /**
   * The destinations of a new alert, with their secrets encrypted. A new alert has no stored
   * secret, so a mask or ciphertext stands for nothing and is refused.
   */
  public static List<SubscriptionDestination> ofANewAlert(
      List<SubscriptionDestination> destinations) {
    DestinationSecretGuards.requireNoMaskedSecrets(destinations);
    DestinationSecretGuards.requireNoCiphertext(destinations);
    return encrypt(destinations);
  }

  /**
   * Encrypts, in place, the secrets of each destination, and gives a destination without an id
   * one. Ciphertext is kept as it is, so a stored value sent again stays the same.
   */
  public static List<SubscriptionDestination> encrypt(List<SubscriptionDestination> destinations) {
    List<SubscriptionDestination> result = new ArrayList<>();
    listOrEmpty(destinations)
        .forEach(
            destination -> {
              if (nullOrEmpty(destination.getId())) {
                destination.withId(UUID.randomUUID());
              }
              transform(destination, ConfigSecrets::encrypt);
              result.add(destination);
            });
    return result;
  }

  /** A copy of the destination with its secrets decrypted: the configuration as it is used. */
  public static SubscriptionDestination decrypted(SubscriptionDestination destination) {
    SubscriptionDestination copy = JsonUtils.deepCopy(destination, SubscriptionDestination.class);
    transform(copy, ConfigSecrets::decrypt);
    return copy;
  }

  /** A copy of the alert with every secret masked, in its destinations and its change history. */
  public static EventSubscription mask(EventSubscription alert) {
    JsonNode tree = JsonUtils.valueToTree(alert);
    maskAlert(tree);
    return JsonUtils.treeToValue(tree, EventSubscription.class);
  }

  public static ResultList<EventSubscription> mask(ResultList<EventSubscription> alerts) {
    alerts.setData(listOrEmpty(alerts.getData()).stream().map(DestinationSecrets::mask).toList());
    return alerts;
  }

  public static EntityHistory mask(EntityHistory history) {
    List<Object> versions =
        listOrEmpty(history.getVersions()).stream().map(DestinationSecrets::maskVersion).toList();
    return new EntityHistory().withEntityType(history.getEntityType()).withVersions(versions);
  }

  /** Copies of the destinations with their secrets masked. */
  public static List<SubscriptionDestination> mask(List<SubscriptionDestination> destinations) {
    ArrayNode tree = (ArrayNode) JsonUtils.valueToTree(listOrEmpty(destinations));
    transformDestinations(tree, ConfigSecrets::mask);
    return JsonUtils.readObjects(JsonUtils.pojoToJson(tree), SubscriptionDestination.class);
  }

  public static boolean hasMaskedSecrets(SubscriptionDestination destination) {
    JsonNode config = JsonUtils.valueToTree(destination.getConfig());
    return secretFieldsOf(destination, config).stream()
        .anyMatch(field -> ConfigSecrets.isMask(config.at(field).asText(null)));
  }

  /**
   * Restores, in place, the stored secrets an update sends back: a mask stands for the value stored
   * at the same field of the same destination, and a plaintext that the stored ciphertext decrypts
   * to is replaced by that ciphertext, so sending a secret again changes nothing. Fernet ciphertext
   * is randomized, so encrypting it again never would. A destination whose target moved gets
   * nothing restored: it moves only when every secret is entered again.
   */
  public static void restore(EventSubscription original, EventSubscription updated) {
    List<SubscriptionDestination> stored = listOrEmpty(original.getDestinations());
    List<SubscriptionDestination> incoming = listOrEmpty(updated.getDestinations());
    Set<UUID> explicitIds =
        incoming.stream()
            .map(SubscriptionDestination::getId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    for (int position = 0; position < incoming.size(); position++) {
      SubscriptionDestination destination = incoming.get(position);
      counterpart(stored, destination, position)
          .filter(it -> destination.getId() != null || !explicitIds.contains(it.getId()))
          .ifPresent(
              storedDestination -> {
                restore(storedDestination, destination);
                if (destination.getId() == null) {
                  destination.withId(storedDestination.getId());
                }
              });
    }
  }

  /** Restores, in place, the secrets of one destination from the one stored for it. */
  public static void restore(SubscriptionDestination stored, SubscriptionDestination updated) {
    if (targetMoved(stored, updated)) {
      // The stored secret must not follow, so a caller is never served it beside an address they
      // chose; entering every secret again is how it moves.
      return;
    }
    JsonNode storedConfig = JsonUtils.valueToTree(stored.getConfig());
    JsonNode updatedConfig = JsonUtils.valueToTree(updated.getConfig());
    if (ConfigSecrets.restore(
        storedConfig, updatedConfig, secretFieldsOf(updated, updatedConfig))) {
      updated.withConfig(JsonUtils.treeToValue(updatedConfig, Object.class));
    }
  }

  /**
   * The stored destination an incoming one updates: the one with its id, or, as a PUT carries no
   * ids, the one stored at its position when that is of the same type and channel.
   */
  static Optional<SubscriptionDestination> counterpart(
      List<SubscriptionDestination> stored, SubscriptionDestination destination, int position) {
    Optional<SubscriptionDestination> found;
    if (destination.getId() != null) {
      found = stored.stream().filter(it -> destination.getId().equals(it.getId())).findFirst();
    } else {
      found =
          Optional.of(position)
              .filter(it -> it < stored.size())
              .map(stored::get)
              .filter(it -> sameKind(it, destination));
    }
    return found;
  }

  /** The secrets this destination carries, as the text at each of its secret fields. */
  static List<JsonPointer> secretFieldsOf(SubscriptionDestination destination, JsonNode config) {
    return ChannelResolution.of(destination)
        .channel()
        .map(channel -> channel.configRules().secretFields(config))
        .orElse(List.of());
  }

  static void set(JsonNode config, JsonPointer field, String value) {
    ConfigSecrets.set(config, field, value);
  }

  private static boolean sameKind(SubscriptionDestination stored, SubscriptionDestination sent) {
    return stored.getType() == sent.getType()
        && Objects.equals(stored.getChannel(), sent.getChannel());
  }

  /** Whether {@code sent} would deliver what {@code stored} carries somewhere it is not stored. */
  static boolean targetMoved(SubscriptionDestination stored, SubscriptionDestination sent) {
    return ConfigSecrets.targetMoved(
        JsonUtils.valueToTree(stored.getConfig()), JsonUtils.valueToTree(sent.getConfig()));
  }

  private static void transform(
      SubscriptionDestination destination, BiPredicate<JsonNode, List<JsonPointer>> transform) {
    JsonNode config = JsonUtils.valueToTree(destination.getConfig());
    if (transform.test(config, secretFieldsOf(destination, config))) {
      destination.withConfig(JsonUtils.treeToValue(config, Object.class));
    }
  }

  /**
   * Encrypts, in place, the secrets of an alert as JSON: a stored row or one of its versions, in its
   * destinations and in the destination lists its change descriptions record. Ciphertext is kept as
   * it is, so running it again changes nothing. Returns whether anything changed.
   */
  public static boolean encryptAlertTree(JsonNode alert) {
    return transformAlert(alert, ConfigSecrets::encrypt);
  }

  private static void maskAlert(JsonNode alert) {
    transformAlert(alert, ConfigSecrets::mask);
  }

  private static boolean transformAlert(
      JsonNode alert, BiPredicate<JsonNode, List<JsonPointer>> transform) {
    boolean changed = transformDestinations(alert.path(DESTINATIONS), transform);
    for (String name : CHANGE_DESCRIPTIONS) {
      changed |= transformChangeDescription(alert.path(name), transform);
    }
    return changed;
  }

  private static boolean transformDestinations(
      JsonNode destinations, BiPredicate<JsonNode, List<JsonPointer>> transform) {
    boolean changed = false;
    for (JsonNode destination : destinations) {
      SubscriptionDestination typed =
          JsonUtils.treeToValue(destination, SubscriptionDestination.class);
      JsonNode config = destination.path(CONFIG);
      changed |= transform.test(config, secretFieldsOf(typed, config));
    }
    return changed;
  }

  // The updater records a destination list as a JSON array string, and a FieldChange is an object.
  private static boolean transformChangeDescription(
      JsonNode changeDescription, BiPredicate<JsonNode, List<JsonPointer>> transform) {
    boolean changed = false;
    for (String list : FIELD_CHANGE_LISTS) {
      for (JsonNode fieldChange : changeDescription.path(list)) {
        if (DESTINATIONS.equals(fieldChange.path(FIELD_CHANGE_NAME).asText())
            && fieldChange instanceof ObjectNode holder) {
          for (String valueField : FIELD_CHANGE_VALUES) {
            changed |= transformDestinationsJson(holder, valueField, transform);
          }
        }
      }
    }
    return changed;
  }

  private static boolean transformDestinationsJson(
      ObjectNode fieldChange,
      String valueField,
      BiPredicate<JsonNode, List<JsonPointer>> transform) {
    JsonNode value = fieldChange.path(valueField);
    boolean changed = false;
    if (value.isTextual()
        && JsonUtils.readTree(value.textValue()) instanceof ArrayNode destinations) {
      changed = transformDestinations(destinations, transform);
      if (changed) {
        fieldChange.put(valueField, JsonUtils.pojoToJson(destinations));
      }
    }
    return changed;
  }

  // EntityHistory.versions is an untyped List<Object> holding each version's entity JSON.
  private static Object maskVersion(Object version) {
    Object masked = version;
    if (version instanceof String json) {
      JsonNode tree = JsonUtils.readTree(json);
      maskAlert(tree);
      masked = JsonUtils.pojoToJson(tree);
    }
    return masked;
  }
}

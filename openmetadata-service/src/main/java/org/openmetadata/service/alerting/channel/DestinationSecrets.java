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
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.macasaet.fernet.TokenValidationException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.UnaryOperator;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.fernet.Fernet;

/**
 * What a destination's configuration holds that must not be stored or read back in the clear: the
 * secrets its channel names. They are encrypted before an alert is stored, decrypted only where a
 * message is sent, and masked in every response. A response sent back as it was read carries the
 * mask, which stands for the stored value.
 */
@Slf4j
public final class DestinationSecrets {
  private static final String DESTINATIONS = "destinations";
  private static final String CONFIG = "config";
  private static final String FIELD_CHANGE_NAME = "name";
  private static final List<String> CHANGE_DESCRIPTIONS =
      List.of("changeDescription", "incrementalChangeDescription");
  private static final List<String> FIELD_CHANGE_LISTS =
      List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted");
  private static final List<String> FIELD_CHANGE_VALUES = List.of("oldValue", "newValue");
  private static final UnaryOperator<String> MASK = secret -> PASSWORD_MASK;

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
              transform(destination, DestinationSecrets::encrypted);
              result.add(destination);
            });
    return result;
  }

  /** A copy of the destination with its secrets decrypted: the configuration as it is used. */
  public static SubscriptionDestination decrypted(SubscriptionDestination destination) {
    SubscriptionDestination copy = JsonUtils.deepCopy(destination, SubscriptionDestination.class);
    transform(copy, DestinationSecrets::decryptedValue);
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
    maskDestinations(tree);
    return JsonUtils.readObjects(JsonUtils.pojoToJson(tree), SubscriptionDestination.class);
  }

  public static boolean hasMaskedSecrets(SubscriptionDestination destination) {
    JsonNode config = JsonUtils.valueToTree(destination.getConfig());
    return secretFieldsOf(destination, config).stream()
        .anyMatch(field -> PASSWORD_MASK.equals(config.at(field).asText(null)));
  }

  /**
   * Restores, in place, the stored secrets an update sends back: a mask stands for the value stored
   * at the same field of the same destination, and a plaintext that the stored ciphertext decrypts
   * to is replaced by that ciphertext, so sending a secret again changes nothing. Fernet ciphertext
   * is randomized, so encrypting it again never would.
   */
  public static void restore(EventSubscription original, EventSubscription updated) {
    List<SubscriptionDestination> stored = listOrEmpty(original.getDestinations());
    List<SubscriptionDestination> incoming = listOrEmpty(updated.getDestinations());
    for (int position = 0; position < incoming.size(); position++) {
      SubscriptionDestination destination = incoming.get(position);
      counterpart(stored, destination, position)
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
    JsonNode storedConfig = JsonUtils.valueToTree(stored.getConfig());
    JsonNode updatedConfig = JsonUtils.valueToTree(updated.getConfig());
    boolean changed = false;
    for (JsonPointer field : secretFieldsOf(updated, updatedConfig)) {
      String storedValue = storedConfig.at(field).asText(null);
      if (storedValue != null
          && standsForStored(updatedConfig.at(field).asText(null), storedValue)) {
        set(updatedConfig, field, storedValue);
        changed = true;
      }
    }
    if (changed) {
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
    ((ObjectNode) config.at(field.head())).put(field.last().getMatchingProperty(), value);
  }

  private static boolean sameKind(SubscriptionDestination stored, SubscriptionDestination sent) {
    return stored.getType() == sent.getType()
        && Objects.equals(stored.getChannel(), sent.getChannel());
  }

  private static boolean standsForStored(String incoming, String stored) {
    return PASSWORD_MASK.equals(incoming) || isCiphertextOf(incoming, stored);
  }

  // Ciphertext the primary key cannot decrypt, one of an older key of a rotation list included,
  // matches nothing, so sending the secret again encrypts it with the primary key.
  private static boolean isCiphertextOf(String incoming, String stored) {
    return incoming != null
        && !Fernet.isTokenized(incoming)
        && Fernet.isTokenized(stored)
        && Fernet.getInstance().isKeyDefined()
        && incoming.equals(decryptOrNull(stored));
  }

  private static String decryptOrNull(String ciphertext) {
    String plaintext = null;
    try {
      plaintext = Fernet.getInstance().decryptWithPrimaryKey(ciphertext);
    } catch (TokenValidationException | IllegalArgumentException e) {
      LOG.debug("A stored destination secret does not decrypt with the primary Fernet key", e);
    }
    return plaintext;
  }

  private static void transform(
      SubscriptionDestination destination, UnaryOperator<String> transform) {
    JsonNode config = JsonUtils.valueToTree(destination.getConfig());
    if (transform(config, secretFieldsOf(destination, config), transform)) {
      destination.withConfig(JsonUtils.treeToValue(config, Object.class));
    }
  }

  private static boolean transform(
      JsonNode config, List<JsonPointer> fields, UnaryOperator<String> transform) {
    boolean changed = false;
    for (JsonPointer field : fields) {
      String value = config.at(field).asText();
      String transformed = transform.apply(value);
      if (!transformed.equals(value)) {
        set(config, field, transformed);
        changed = true;
      }
    }
    return changed;
  }

  private static String encrypted(String value) {
    boolean keptAsIs = value.isEmpty() || !Fernet.getInstance().isKeyDefined();
    return keptAsIs ? value : Fernet.getInstance().encryptIfApplies(value);
  }

  private static String decryptedValue(String value) {
    return Fernet.getInstance().isKeyDefined()
        ? Fernet.getInstance().decryptIfApplies(value)
        : value;
  }

  private static void maskAlert(JsonNode alert) {
    maskDestinations(alert.path(DESTINATIONS));
    CHANGE_DESCRIPTIONS.forEach(name -> maskChangeDescription(alert.path(name)));
  }

  private static void maskDestinations(JsonNode destinations) {
    for (JsonNode destination : destinations) {
      SubscriptionDestination typed =
          JsonUtils.treeToValue(destination, SubscriptionDestination.class);
      JsonNode config = destination.path(CONFIG);
      transform(config, secretFieldsOf(typed, config), MASK);
    }
  }

  // The updater records a destination list as a JSON array string, and a FieldChange is an object.
  private static void maskChangeDescription(JsonNode changeDescription) {
    for (String list : FIELD_CHANGE_LISTS) {
      for (JsonNode fieldChange : changeDescription.path(list)) {
        if (DESTINATIONS.equals(fieldChange.path(FIELD_CHANGE_NAME).asText())
            && fieldChange instanceof ObjectNode holder) {
          FIELD_CHANGE_VALUES.forEach(valueField -> maskDestinationsJson(holder, valueField));
        }
      }
    }
  }

  private static void maskDestinationsJson(ObjectNode fieldChange, String valueField) {
    JsonNode value = fieldChange.path(valueField);
    if (value.isTextual()
        && JsonUtils.readTree(value.textValue()) instanceof ArrayNode destinations) {
      maskDestinations(destinations);
      fieldChange.put(valueField, JsonUtils.pojoToJson(destinations));
    }
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

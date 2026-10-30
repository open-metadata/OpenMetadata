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

package org.openmetadata.service.alerting.channel.webhook;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.BiPredicate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.alerting.channel.ConfigSecrets;
import org.openmetadata.service.fernet.Fernet;

/**
 * The webhooks a user or a team keeps on its profile, one for each channel that can address them.
 * Each one is a {@link org.openmetadata.schema.type.Webhook}, the type an alert destination is
 * configured with, so it carries the same secrets ({@link WebhookSecrets}) and they are kept the
 * same way: encrypted before the profile is stored, masked in every response, restored from the
 * stored profile when a request sends the mask back, and decrypted only to send.
 */
public final class ProfileWebhookSecrets {
  private static final String SUBSCRIPTION = "subscription";
  private static final String PROFILE = "profile";
  private static final JsonPointer SUBSCRIPTIONS = JsonPointer.compile("/profile/subscription");
  private static final List<String> CHANGE_DESCRIPTIONS =
      List.of("changeDescription", "incrementalChangeDescription");
  private static final List<String> FIELD_CHANGE_LISTS =
      List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted");
  private static final List<String> FIELD_CHANGE_VALUES = List.of("oldValue", "newValue");
  private static final List<String> WRITING_OPERATIONS = List.of("add", "replace", "copy", "move");

  private static final String MASKED_MESSAGE =
      "Profile webhook '%s' has a masked value at '%s' and nothing is stored for it; provide the actual value";
  private static final String ENCRYPTED_MESSAGE =
      "Profile webhook '%s' has an encrypted value at '%s'; encrypted values cannot be supplied, provide the actual value";
  private static final String MOVED_TARGET_MESSAGE =
      "Profile webhook '%s' no longer sends to its stored endpoint or token URL; to change where it sends, enter every one of its credentials again";
  private static final String READ_MESSAGE =
      "A profile webhook secret cannot be copied or moved; the patch reads from '%s'";

  private ProfileWebhookSecrets() {}

  /**
   * The profile of a new user or team, with its webhook secrets encrypted. Nothing is stored that a
   * mask or ciphertext could stand for, so either is refused.
   */
  public static Profile ofANewEntity(Profile profile) {
    return transformWebhooks(
        profile,
        (slot, config) -> {
          List<JsonPointer> fields = WebhookSecrets.fieldsIn(config);
          fields.forEach(
              field ->
                  requireEntered(
                      slot, field, config.at(field).asText(), MissingNode.getInstance()));
          ConfigSecrets.encrypt(config, fields);
        });
  }

  /**
   * The profile an update stores. A mask stands for the value stored at the same field of the same
   * webhook, and ciphertext is accepted only where it is that stored value; both are refused once
   * the webhook sends somewhere else, since a caller who only read the mask may not choose where a
   * stored secret goes. Everything else is encrypted, so the change description and the stored row
   * carry ciphertext only.
   */
  public static Profile updated(Profile stored, Profile sent) {
    JsonNode storedSubscriptions = subscriptionsOf(stored);
    return transformWebhooks(
        sent, (slot, config) -> updateWebhook(slot, storedSubscriptions.path(slot), config));
  }

  /**
   * The checks a PATCH needs beyond {@link #updated}, since a patch is applied to the profile as
   * stored: nothing is copied or moved out of a profile webhook, and a webhook whose target changes
   * has every secret written by the patch itself.
   */
  public static void validatePatch(Profile stored, Profile patched, JsonPatch patch) {
    List<JsonObject> operations = operationsOf(patch);
    operations.stream()
        .map(operation -> operation.getString("from", null))
        .filter(from -> from != null && overlapsSubscriptions(from))
        .findFirst()
        .ifPresent(
            from -> {
              throw new BadRequestException(READ_MESSAGE.formatted(from));
            });
    List<String> written = writtenPaths(operations);
    JsonNode storedSubscriptions = subscriptionsOf(stored);
    JsonNode patchedSubscriptions = subscriptionsOf(patched);
    patchedSubscriptions
        .properties()
        .forEach(
            webhook ->
                requireMovedWebhookRewritten(
                    webhook.getKey(),
                    storedSubscriptions.path(webhook.getKey()),
                    webhook.getValue(),
                    written));
  }

  /** A copy of the profile with every webhook secret decrypted: the profile as it is used to send. */
  public static Profile decrypted(Profile profile) {
    return transformWebhooks(
        profile, (slot, config) -> ConfigSecrets.decrypt(config, WebhookSecrets.fieldsIn(config)));
  }

  /** A copy of the profile with every webhook secret masked. */
  public static Profile masked(Profile profile) {
    return transformWebhooks(
        profile, (slot, config) -> ConfigSecrets.mask(config, WebhookSecrets.fieldsIn(config)));
  }

  /** Masks, in place, the profile webhook secrets of a user: in its profile and its history. */
  public static User mask(User user) {
    user.setProfile(masked(user.getProfile()));
    maskChangeDescriptions(user);
    return user;
  }

  /** Masks, in place, the profile webhook secrets of a team: in its profile and its history. */
  public static Team mask(Team team) {
    team.setProfile(masked(team.getProfile()));
    maskChangeDescriptions(team);
    return team;
  }

  private static void maskChangeDescriptions(EntityInterface<?> entity) {
    if (recordsProfile(entity.getChangeDescription())) {
      entity.setChangeDescription(masked(entity.getChangeDescription()));
    }
    if (recordsProfile(entity.getIncrementalChangeDescription())) {
      entity.setIncrementalChangeDescription(masked(entity.getIncrementalChangeDescription()));
    }
  }

  private static ChangeDescription masked(ChangeDescription changeDescription) {
    JsonNode tree = JsonUtils.valueToTree(changeDescription);
    transformChangeDescription(tree, ConfigSecrets::mask);
    return JsonUtils.treeToValue(tree, ChangeDescription.class);
  }

  /**
   * Masks, in place, the profile webhook secrets of a user or a team as JSON: a stored row or one of
   * its versions. Returns whether anything changed.
   */
  public static boolean maskEntityTree(JsonNode entity) {
    return transformEntityTree(entity, ConfigSecrets::mask);
  }

  /**
   * Encrypts, in place, the profile webhook secrets of a user or a team as JSON, in its profile and
   * in the profile values its change descriptions record. Ciphertext is kept as it is, so running it
   * again changes nothing. Returns whether anything changed.
   */
  public static boolean encryptEntityTree(JsonNode entity) {
    return transformEntityTree(entity, ConfigSecrets::encrypt);
  }

  private static boolean transformEntityTree(
      JsonNode entity, BiPredicate<JsonNode, List<JsonPointer>> transform) {
    boolean changed = transformSubscriptions(entity.at(SUBSCRIPTIONS), transform);
    for (String name : CHANGE_DESCRIPTIONS) {
      changed |= transformChangeDescription(entity.path(name), transform);
    }
    return changed;
  }

  private static boolean transformSubscriptions(
      JsonNode subscriptions, BiPredicate<JsonNode, List<JsonPointer>> transform) {
    boolean changed = false;
    for (JsonNode config : subscriptions) {
      if (config.isObject()) {
        changed |= transform.test(config, WebhookSecrets.fieldsIn(config));
      }
    }
    return changed;
  }

  // The updaters record a profile as a JSON object string, and a FieldChange is an object.
  private static boolean transformChangeDescription(
      JsonNode changeDescription, BiPredicate<JsonNode, List<JsonPointer>> transform) {
    boolean changed = false;
    for (String list : FIELD_CHANGE_LISTS) {
      for (JsonNode fieldChange : changeDescription.path(list)) {
        if (isProfileChange(fieldChange.path("name").asText())
            && fieldChange instanceof ObjectNode holder) {
          for (String valueField : FIELD_CHANGE_VALUES) {
            changed |= transformRecordedProfile(holder, valueField, transform);
          }
        }
      }
    }
    return changed;
  }

  private static boolean transformRecordedProfile(
      ObjectNode fieldChange,
      String valueField,
      BiPredicate<JsonNode, List<JsonPointer>> transform) {
    JsonNode value = fieldChange.path(valueField);
    boolean changed = false;
    if (value.isTextual() && value.textValue().startsWith("{")) {
      JsonNode profile = JsonUtils.readTree(value.textValue());
      changed = transformSubscriptions(profile.path(SUBSCRIPTION), transform);
      if (changed) {
        fieldChange.put(valueField, JsonUtils.pojoToJson(profile));
      }
    }
    return changed;
  }

  private static void updateWebhook(String slot, JsonNode stored, JsonNode sent) {
    List<JsonPointer> fields = WebhookSecrets.fieldsIn(sent);
    boolean moved = ConfigSecrets.targetMoved(stored, sent);
    for (JsonPointer field : fields) {
      String value = sent.at(field).asText();
      requireEntered(slot, field, value, stored);
      if (moved && standsForAStoredValue(value)) {
        throw new BadRequestException(MOVED_TARGET_MESSAGE.formatted(slot));
      }
    }
    if (!moved) {
      ConfigSecrets.restore(stored, sent, fields);
    }
    ConfigSecrets.encrypt(sent, fields);
  }

  /**
   * A mask stands for what is stored at its field, and ciphertext may only be that stored value:
   * only the server encrypts, and a value it encrypted for one field does not stand for another.
   */
  private static void requireEntered(
      String slot, JsonPointer field, String value, JsonNode stored) {
    String storedValue = stored.at(field).asText(null);
    if (ConfigSecrets.isMask(value) && storedValue == null) {
      throw new BadRequestException(MASKED_MESSAGE.formatted(slot, field));
    }
    if (Fernet.isTokenized(value) && !value.equals(storedValue)) {
      throw new BadRequestException(ENCRYPTED_MESSAGE.formatted(slot, field));
    }
  }

  private static boolean standsForAStoredValue(String value) {
    return ConfigSecrets.isMask(value) || Fernet.isTokenized(value);
  }

  private static void requireMovedWebhookRewritten(
      String slot, JsonNode stored, JsonNode patched, List<String> written) {
    if (!stored.isMissingNode() && ConfigSecrets.targetMoved(stored, patched)) {
      String base = SUBSCRIPTIONS + "/" + slot;
      boolean everySecretWritten =
          WebhookSecrets.fieldsIn(patched).stream()
              .allMatch(field -> isWritten(base + field, written));
      if (!everySecretWritten) {
        throw new BadRequestException(MOVED_TARGET_MESSAGE.formatted(slot));
      }
    }
  }

  private static boolean isWritten(String pointer, List<String> written) {
    return written.stream().anyMatch(path -> isSelfOrAncestor(path, pointer));
  }

  private static List<String> writtenPaths(List<JsonObject> operations) {
    List<String> paths = new ArrayList<>();
    for (JsonObject operation : operations) {
      if (WRITING_OPERATIONS.contains(operation.getString("op", ""))) {
        paths.add(operation.getString("path", ""));
      }
    }
    return paths;
  }

  private static boolean overlapsSubscriptions(String pointer) {
    String subscriptions = SUBSCRIPTIONS.toString();
    return isSelfOrAncestor(pointer, subscriptions) || isSelfOrAncestor(subscriptions, pointer);
  }

  private static boolean isSelfOrAncestor(String path, String pointer) {
    String normalized = "/".equals(path) ? "" : path;
    return pointer.equals(normalized) || pointer.startsWith(normalized + "/");
  }

  private static List<JsonObject> operationsOf(JsonPatch patch) {
    return patch.toJsonArray().stream()
        .filter(operation -> operation.getValueType() == JsonValue.ValueType.OBJECT)
        .map(JsonValue::asJsonObject)
        .toList();
  }

  private static boolean isProfileChange(String fieldName) {
    return PROFILE.equals(fieldName);
  }

  private static boolean hasWebhooks(Profile profile) {
    return profile != null && profile.getSubscription() != null;
  }

  private static boolean recordsProfile(ChangeDescription changeDescription) {
    return changeDescription != null
        && List.of(
                changeDescription.getFieldsAdded(),
                changeDescription.getFieldsUpdated(),
                changeDescription.getFieldsDeleted())
            .stream()
            .filter(Objects::nonNull)
            .flatMap(List::stream)
            .map(FieldChange::getName)
            .anyMatch(name -> name != null && isProfileChange(name));
  }

  private static JsonNode subscriptionsOf(Profile profile) {
    return profile == null
        ? MissingNode.getInstance()
        : JsonUtils.valueToTree(profile).path(SUBSCRIPTION);
  }

  /** Applies {@code transform} to every webhook of a copy of the profile, by its slot name. */
  private static Profile transformWebhooks(
      Profile profile, BiConsumer<String, JsonNode> transform) {
    Profile result = profile;
    if (hasWebhooks(profile)) {
      JsonNode tree = JsonUtils.valueToTree(profile);
      for (Map.Entry<String, JsonNode> webhook : tree.path(SUBSCRIPTION).properties()) {
        if (webhook.getValue().isObject()) {
          transform.accept(webhook.getKey(), webhook.getValue());
        }
      }
      result = JsonUtils.treeToValue(tree, Profile.class);
    }
    return result;
  }
}

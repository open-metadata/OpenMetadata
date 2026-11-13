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
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiPredicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.profile.SubscriptionStatusConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.SecretOwner;

/**
 * The webhooks a user or a team keeps on its profile, one for each channel that can address them.
 * Each one is a {@link org.openmetadata.schema.type.Webhook}, the type an alert destination is
 * configured with, so it carries the same secrets ({@link WebhookSecrets}) and they are kept the
 * same way: encrypted before the profile is stored, masked in every response, restored from the
 * stored profile when a request sends the mask back, and decrypted only to send.
 */
@Slf4j
public final class ProfileWebhookSecrets {
  private static final String SUBSCRIPTION = "subscription";
  private static final String PROFILE = "profile";
  private static final JsonPointer SUBSCRIPTIONS = JsonPointer.compile("/profile/subscription");
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

  private static final String WEBHOOK = "webhook";

  private ProfileWebhookSecrets() {}

  /**
   * The user or team a profile belongs to, by its entity type and id. Each of its webhooks owns its
   * secrets: a secret written for one opens for no other, in this profile or another. A holder
   * without an id has nothing stored for it, so it owns nothing a stored secret opens for, and
   * nothing is encrypted for it.
   */
  public record Holder(String entityType, UUID id) {
    // A user or a team has its id before its profile is stored; a secret encrypted for a holder
    // without one could never be decrypted.
    Holder requireId() {
      if (id == null) {
        throw new IllegalStateException(
            "The " + entityType + " has no id, so its profile webhook secrets have no owner");
      }
      return this;
    }

    SecretOwner ownerOf(String slot) {
      return SecretOwner.builder(entityType)
          .id(id == null ? UUID.randomUUID() : id)
          .literal(WEBHOOK)
          .literal(slot.toLowerCase(Locale.ROOT))
          .build();
    }
  }

  /**
   * The profile of a new user or team, with its webhook secrets encrypted. Nothing is stored that a
   * mask or ciphertext could stand for, so either is refused.
   */
  public static Profile ofANewEntity(Holder holder, Profile profile) {
    return withoutStatus(
        transformWebhooks(
            profile,
            (slot, config) -> {
              List<JsonPointer> fields = WebhookSecrets.fieldsIn(config);
              fields.forEach(
                  field ->
                      requireEntered(
                          slot, field, config.at(field).asText(), MissingNode.getInstance()));
              ConfigSecrets.encrypt(holder.requireId().ownerOf(slot), config, fields);
            }));
  }

  /**
   * The profile an update stores. A mask stands for the value stored at the same field of the same
   * webhook, and ciphertext is accepted only where it is that stored value; both are refused once
   * the webhook sends somewhere else, since a caller who only read the mask may not choose where a
   * stored secret goes. Everything else is encrypted, so the change description and the stored row
   * carry ciphertext only.
   */
  public static Profile updated(Holder holder, Profile stored, Profile sent) {
    JsonNode storedSubscriptions = subscriptionsOf(stored);
    return withoutStatus(
        transformWebhooks(
            sent,
            (slot, config) ->
                updateWebhook(
                    holder.requireId().ownerOf(slot),
                    slot,
                    storedSubscriptions.path(slot),
                    config)));
  }

  /**
   * The checks a PATCH needs beyond {@link #updated}, since a patch is applied to the profile as
   * stored: nothing is copied or moved out of a profile webhook, and a webhook whose target changes
   * has every secret written by the patch itself.
   */
  public static void validatePatch(
      Holder holder, Profile stored, Profile patched, JsonPatch patch) {
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
                    holder.ownerOf(webhook.getKey()),
                    webhook.getKey(),
                    storedSubscriptions.path(webhook.getKey()),
                    webhook.getValue(),
                    written));
  }

  /**
   * A copy of the profile with every webhook secret decrypted: the profile as it is used to send. A
   * webhook holding a value that does not open for it is left out of the copy until the value is
   * entered again, and the profile's other webhooks still send.
   */
  public static Profile decrypted(Holder holder, Profile profile) {
    Profile result = profile;
    if (hasWebhooks(profile)) {
      JsonNode tree = JsonUtils.valueToTree(profile);
      ObjectNode subscriptions = (ObjectNode) tree.path(SUBSCRIPTION);
      List<String> leftOut = new ArrayList<>();
      subscriptions
          .properties()
          .forEach(
              webhook -> {
                if (webhook.getValue().isObject()
                    && !opened(holder, webhook.getKey(), webhook.getValue())) {
                  leftOut.add(webhook.getKey());
                }
              });
      subscriptions.remove(leftOut);
      result = JsonUtils.treeToValue(tree, Profile.class);
    }
    return result;
  }

  private static boolean opened(Holder holder, String slot, JsonNode config) {
    Optional<String> unusable = decryptedOrUnusableBecause(holder, slot, config);
    unusable.ifPresent(
        reason ->
            LOG.warn(
                "The {} webhook of {} {} is left out of the send: {}",
                slot,
                holder.entityType(),
                holder.id(),
                reason));
    return unusable.isEmpty();
  }

  /** Decrypts the webhook in place, or says why its stored values cannot be used to send. */
  private static Optional<String> decryptedOrUnusableBecause(
      Holder holder, String slot, JsonNode config) {
    Optional<String> unusable = Optional.empty();
    try {
      ConfigSecrets.decrypt(holder.ownerOf(slot), config, WebhookSecrets.fieldsIn(config));
    } catch (BadRequestException e) {
      unusable = Optional.of(e.getMessage());
    }
    return unusable;
  }

  /**
   * Masks, in place, the profile webhook secrets of a user as a read shows them, and reports in
   * {@code profile.subscriptionStatus} each webhook that does not send until a stored value is
   * entered again. The status is computed on every read and never stored, and the schema keeps it
   * out of change events.
   */
  public static User maskForRead(User user) {
    user.setProfile(withStatus(new Holder(Entity.USER, user.getId()), user.getProfile()));
    return mask(user);
  }

  /** As {@link #maskForRead(User)}, for a team. */
  public static Team maskForRead(Team team) {
    team.setProfile(withStatus(new Holder(Entity.TEAM, team.getId()), team.getProfile()));
    return mask(team);
  }

  /**
   * A copy of the profile whose status names each webhook a send would leave out ({@link
   * #decrypted}), with the reason; no status when every webhook can send.
   */
  static Profile withStatus(Holder holder, Profile profile) {
    Profile result = profile;
    if (hasWebhooks(profile)) {
      ObjectNode statuses = JsonUtils.getObjectNode();
      subscriptionsOf(profile)
          .properties()
          .forEach(
              webhook ->
                  unusableBecause(holder, webhook.getKey(), webhook.getValue())
                      .ifPresent(
                          reason ->
                              statuses.set(
                                  webhook.getKey(), JsonUtils.valueToTree(failed(reason)))));
      result =
          JsonUtils.deepCopy(profile, Profile.class)
              .withSubscriptionStatus(
                  statuses.isEmpty()
                      ? null
                      : JsonUtils.treeToValue(statuses, SubscriptionStatusConfig.class));
    }
    return result;
  }

  private static Optional<String> unusableBecause(Holder holder, String slot, JsonNode config) {
    return config.isObject()
        ? decryptedOrUnusableBecause(holder, slot, config.deepCopy())
        : Optional.empty();
  }

  private static SubscriptionStatus failed(String reason) {
    return new SubscriptionStatus()
        .withStatus(SubscriptionStatus.Status.FAILED)
        .withLastFailedReason(reason)
        .withConfigurationUnusable(true)
        .withTimestamp(System.currentTimeMillis());
  }

  // Computed on every read, so a status sent back by a client is never stored.
  private static Profile withoutStatus(Profile profile) {
    return profile == null ? null : profile.withSubscriptionStatus(null);
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

  /** A copy of the user with its profile webhook secrets masked, or the user when it has none. */
  public static User masked(User user) {
    return carriesProfileWebhooks(user, user.getProfile())
        ? mask(JsonUtils.deepCopy(user, User.class))
        : user;
  }

  /** A copy of the team with its profile webhook secrets masked, or the team when it has none. */
  public static Team masked(Team team) {
    return carriesProfileWebhooks(team, team.getProfile())
        ? mask(JsonUtils.deepCopy(team, Team.class))
        : team;
  }

  private static boolean carriesProfileWebhooks(EntityInterface<?> entity, Profile profile) {
    return hasWebhooks(profile)
        || recordsProfile(entity.getChangeDescription())
        || recordsProfile(entity.getIncrementalChangeDescription());
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

  private static void updateWebhook(
      SecretOwner owner, String slot, JsonNode stored, JsonNode sent) {
    List<JsonPointer> fields = WebhookSecrets.fieldsIn(sent);
    boolean moved = ConfigSecrets.targetMoved(owner, stored, sent);
    for (JsonPointer field : fields) {
      String value = sent.at(field).asText();
      requireEntered(slot, field, value, stored);
      if (moved && standsForAStoredValue(value)) {
        throw new BadRequestException(MOVED_TARGET_MESSAGE.formatted(slot));
      }
    }
    if (!moved) {
      ConfigSecrets.restore(owner, stored, sent, fields);
    }
    ConfigSecrets.encrypt(owner, sent, fields);
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
      SecretOwner owner, String slot, JsonNode stored, JsonNode patched, List<String> written) {
    if (!stored.isMissingNode() && ConfigSecrets.targetMoved(owner, stored, patched)) {
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

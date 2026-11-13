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

package org.openmetadata.service.migration.utils.v210;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.io.BaseEncoding;
import com.macasaet.fernet.Key;
import com.macasaet.fernet.StringValidator;
import com.macasaet.fernet.Token;
import com.macasaet.fernet.TokenValidationException;
import com.macasaet.fernet.Validator;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.TemporalAmount;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.crypto.digests.SHA256Digest;
import org.bouncycastle.crypto.generators.HKDFBytesGenerator;
import org.bouncycastle.crypto.params.HKDFParameters;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The webhook secret rules of release 2.1, frozen for its data step: which fields of a webhook
 * configuration hold secrets, how a secret is bound to the alert destination or profile webhook
 * that holds it, and how a stored row, version or change event is brought to that form. It calls
 * no platform code that later releases may change; it uses only the Fernet token format,
 * BouncyCastle's HKDF and the configured Fernet keys, so it always writes what release 2.1 writes.
 * ADR:2026-11-03-a-webhook-secret-opens-only-where-it-was-written
 */
@Slf4j
final class StoredWebhookSecrets {
  static final String MASK = "*********";
  static final String FERNET_PREFIX = "fernet:";
  static final String BOUND_PREFIX = FERNET_PREFIX + "bound:";

  private static final byte[] SALT =
      "openmetadata/bound-ciphertext/v1".getBytes(StandardCharsets.UTF_8);
  private static final int KEY_LENGTH = 32;
  private static final char SEPARATOR = '\u0000';
  private static final BaseEncoding BASE32 = BaseEncoding.base32().lowerCase().omitPadding();
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final Validator<String> NEVER_EXPIRES =
      new StringValidator() {
        @Override
        public TemporalAmount getTimeToLive() {
          return Duration.ofSeconds(Instant.MAX.getEpochSecond());
        }
      };

  // The channels whose destinations hold webhook secrets, by channel id.
  private static final List<String> WEBHOOK_CHANNELS =
      List.of("Webhook", "Slack", "MsTeams", "GChat");
  private static final JsonPointer ENDPOINT = JsonPointer.compile("/endpoint");
  private static final JsonPointer HEADERS = JsonPointer.compile("/headers");
  // The fields releases before 2.1 stored encrypted: the only ones whose ciphertext is carried
  // over.
  private static final List<JsonPointer> ENCRYPTED_BEFORE_2_1 =
      List.of(
          JsonPointer.compile("/authType/secretKey"),
          JsonPointer.compile("/authType/clientId"),
          JsonPointer.compile("/authType/clientSecret"));
  private static final String DESTINATIONS = "destinations";
  private static final String PROFILE = "profile";
  private static final JsonPointer SUBSCRIPTIONS = JsonPointer.compile("/profile/subscription");
  private static final List<String> CHANGE_DESCRIPTIONS =
      List.of("changeDescription", "incrementalChangeDescription");
  private static final List<String> FIELD_CHANGE_LISTS =
      List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted");
  private static final List<String> FIELD_CHANGE_VALUES = List.of("oldValue", "newValue");

  private final List<Key> keys;

  StoredWebhookSecrets(List<Key> keys) {
    this.keys = List.copyOf(keys);
  }

  /** The secret fields of a webhook configuration: its endpoint, header values and credentials. */
  static List<JsonPointer> fieldsIn(JsonNode config) {
    List<JsonPointer> fields = new ArrayList<>();
    if (config != null && config.isObject()) {
      addIfScalar(fields, config, ENDPOINT);
      for (Map.Entry<String, JsonNode> header : config.at(HEADERS).properties()) {
        addIfScalar(fields, config, HEADERS.appendProperty(header.getKey()));
      }
      ENCRYPTED_BEFORE_2_1.forEach(pointer -> addIfScalar(fields, config, pointer));
    }
    return List.copyOf(fields);
  }

  /** The secret fields of a stored destination; none when its channel is not a webhook. */
  static List<JsonPointer> destinationFields(JsonNode destination) {
    JsonNode named = destination.path("channel");
    String channelId = named.isTextual() ? named.textValue() : destination.path("type").asText();
    return WEBHOOK_CHANNELS.contains(channelId) ? fieldsIn(destination.path("config")) : List.of();
  }

  static boolean isLegacyCiphertext(String value) {
    return value != null && value.startsWith(FERNET_PREFIX) && !value.startsWith(BOUND_PREFIX);
  }

  static String alertDestinationOwner(UUID destinationId) {
    return "alertdestination/" + encodeId(destinationId);
  }

  static String profileOwner(String entityType, UUID id, String slot) {
    return entityType + "/" + encodeId(id) + "/webhook/" + slot.toLowerCase(Locale.ROOT);
  }

  /**
   * Binds, in place, the destinations of a stored alert and masks its change descriptions. Legacy
   * ciphertext is carried over at the fields releases before 2.1 encrypted, wherever else the same
   * value is stored: each copy is bound to the destination that holds it. Any other value stays as
   * stored, opens for no destination, and is entered again before the destination sends. Returns
   * whether it changed.
   */
  boolean bindAlert(JsonNode alert) {
    JsonNode before = alert.deepCopy();
    for (JsonNode destination : alert.path(DESTINATIONS)) {
      if (destination instanceof ObjectNode stored) {
        bindDestination(alert.path("name").asText(), stored);
      }
    }
    CHANGE_DESCRIPTIONS.forEach(name -> maskRecordedDestinations(alert.path(name)));
    return !alert.equals(before);
  }

  /**
   * Binds, in place, the profile webhooks of a stored user or team and masks its change
   * descriptions. Releases before 2.1 stored profile webhooks in plain text, so no ciphertext is
   * carried over. Returns whether it changed.
   */
  boolean bindProfileEntity(String entityType, JsonNode entity) {
    JsonNode before = entity.deepCopy();
    UUID id = UUID.fromString(entity.path("id").asText());
    for (Map.Entry<String, JsonNode> webhook : entity.at(SUBSCRIPTIONS).properties()) {
      String owner = profileOwner(entityType, id, webhook.getKey());
      String label = "The " + webhook.getKey() + " webhook of " + entityType + " " + id;
      bind(owner, label, webhook.getValue(), fieldsIn(webhook.getValue()), field -> false);
    }
    CHANGE_DESCRIPTIONS.forEach(name -> maskRecordedProfile(entity.path(name)));
    return !entity.equals(before);
  }

  /** Masks, in place, an alert version: its destinations and its change descriptions. */
  static boolean maskAlert(JsonNode alert) {
    boolean changed = maskDestinations(alert.path(DESTINATIONS));
    for (String name : CHANGE_DESCRIPTIONS) {
      changed |= maskRecordedDestinations(alert.path(name));
    }
    return changed;
  }

  /** Masks, in place, a user or team version: its profile webhooks and its change descriptions. */
  static boolean maskProfileEntity(JsonNode entity) {
    boolean changed = maskSubscriptions(entity.at(SUBSCRIPTIONS));
    for (String name : CHANGE_DESCRIPTIONS) {
      changed |= maskRecordedProfile(entity.path(name));
    }
    return changed;
  }

  /** Masks, in place, a stored change event: its change description and the entity it carries. */
  static boolean maskChangeEvent(JsonNode event, Predicate<JsonNode> maskEntity) {
    boolean changed = maskEntity.test(event);
    JsonNode entity = event.path("entity");
    if (entity.isTextual() && entity.textValue().startsWith("{")) {
      JsonNode entityTree = JsonUtils.readTree(entity.textValue());
      if (maskEntity.test(entityTree)) {
        ((ObjectNode) event).put("entity", JsonUtils.pojoToJson(entityTree));
        changed = true;
      }
    } else if (entity.isObject()) {
      changed |= maskEntity.test(entity);
    }
    return changed;
  }

  /** The secret a bound {@code value} holds, when it was bound to {@code owner} at {@code field}. */
  Optional<String> openBound(String owner, String field, String value) {
    List<Key> derived = keys.stream().map(key -> derive(key, owner, field)).toList();
    return open(value.substring(BOUND_PREFIX.length()), derived);
  }

  private void bindDestination(String alertName, ObjectNode destination) {
    if (destination.path("id").asText().isEmpty()) {
      destination.put("id", UUID.randomUUID().toString());
    }
    String id = destination.path("id").asText();
    String owner = alertDestinationOwner(UUID.fromString(id));
    String label = "Destination " + id + " of alert " + alertName;
    bind(
        owner,
        label,
        destination.path("config"),
        destinationFields(destination),
        ENCRYPTED_BEFORE_2_1::contains);
  }

  private void bind(
      String owner,
      String label,
      JsonNode config,
      List<JsonPointer> fields,
      Predicate<JsonPointer> carriedOver) {
    List<JsonPointer> toEnterAgain = new ArrayList<>();
    for (JsonPointer field : fields) {
      String value = config.at(field).asText();
      Optional<String> secret = secretToBind(field, value, carriedOver);
      secret.ifPresent(it -> set(config, field, encrypt(owner, field.toString(), it)));
      if (secret.isEmpty() && isLegacyCiphertext(value)) {
        toEnterAgain.add(field);
      }
    }
    if (!toEnterAgain.isEmpty()) {
      LOG.warn("{}: the values at {} must be entered again before it sends", label, toEnterAgain);
    }
  }

  // Plaintext is bound as entered; legacy ciphertext only where it is carried over.
  private Optional<String> secretToBind(
      JsonPointer field, String value, Predicate<JsonPointer> carriedOver) {
    Optional<String> secret = Optional.empty();
    if (isLegacyCiphertext(value)) {
      secret = carriedOver.test(field) ? decryptLegacy(value) : Optional.empty();
    } else if (!value.isEmpty() && !value.startsWith(BOUND_PREFIX)) {
      secret = Optional.of(value);
    }
    return secret;
  }

  private String encrypt(String owner, String field, String secret) {
    Key key = derive(keys.getFirst(), owner, field);
    return BOUND_PREFIX + Token.generate(RANDOM, key, secret).serialise();
  }

  private Optional<String> decryptLegacy(String ciphertext) {
    return open(ciphertext.substring(FERNET_PREFIX.length()), keys);
  }

  private static Optional<String> open(String token, List<Key> candidates) {
    Optional<String> secret = Optional.empty();
    try {
      secret = Optional.of(Token.fromString(token).validateAndDecrypt(candidates, NEVER_EXPIRES));
    } catch (TokenValidationException | IllegalArgumentException e) {
      LOG.debug("A stored webhook secret does not decrypt with the configured Fernet keys", e);
    }
    return secret;
  }

  private static Key derive(Key key, String owner, String field) {
    byte[] context = (owner + SEPARATOR + field).getBytes(StandardCharsets.UTF_8);
    HKDFBytesGenerator hkdf = new HKDFBytesGenerator(SHA256Digest.newInstance());
    hkdf.init(new HKDFParameters(material(key), SALT, context));
    byte[] derived = new byte[KEY_LENGTH];
    hkdf.generateBytes(derived, 0, KEY_LENGTH);
    return new Key(derived);
  }

  private static byte[] material(Key key) {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try {
      key.writeTo(bytes);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    return bytes.toByteArray();
  }

  private static String encodeId(UUID id) {
    ByteBuffer bytes = ByteBuffer.allocate(Long.BYTES * 2);
    bytes.putLong(id.getMostSignificantBits()).putLong(id.getLeastSignificantBits());
    return BASE32.encode(bytes.array());
  }

  private static boolean maskDestinations(JsonNode destinations) {
    boolean changed = false;
    for (JsonNode destination : destinations) {
      changed |= mask(destination.path("config"), destinationFields(destination));
    }
    return changed;
  }

  private static boolean maskSubscriptions(JsonNode subscriptions) {
    boolean changed = false;
    for (JsonNode config : subscriptions) {
      changed |= mask(config, fieldsIn(config));
    }
    return changed;
  }

  private static boolean mask(JsonNode config, List<JsonPointer> fields) {
    boolean changed = false;
    for (JsonPointer field : fields) {
      if (!MASK.equals(config.at(field).asText())) {
        set(config, field, MASK);
        changed = true;
      }
    }
    return changed;
  }

  // The updaters record a destination list as a JSON array string.
  private static boolean maskRecordedDestinations(JsonNode changeDescription) {
    return maskRecorded(
        changeDescription,
        DESTINATIONS,
        value ->
            JsonUtils.readTree(value) instanceof ArrayNode destinations
                    && maskDestinations(destinations)
                ? JsonUtils.pojoToJson(destinations)
                : null);
  }

  // The updaters record a profile as a JSON object string.
  private static boolean maskRecordedProfile(JsonNode changeDescription) {
    return maskRecorded(
        changeDescription,
        PROFILE,
        value -> {
          JsonNode profile = JsonUtils.readTree(value);
          return maskSubscriptions(profile.path("subscription"))
              ? JsonUtils.pojoToJson(profile)
              : null;
        });
  }

  /** Replaces, in place, the recorded values of {@code fieldName} that {@code masked} changes. */
  private static boolean maskRecorded(
      JsonNode changeDescription, String fieldName, Function<String, String> masked) {
    boolean changed = false;
    for (String list : FIELD_CHANGE_LISTS) {
      for (JsonNode fieldChange : changeDescription.path(list)) {
        if (fieldName.equals(fieldChange.path("name").asText())
            && fieldChange instanceof ObjectNode holder) {
          changed |= maskRecordedValues(holder, masked);
        }
      }
    }
    return changed;
  }

  private static boolean maskRecordedValues(
      ObjectNode fieldChange, Function<String, String> masked) {
    boolean changed = false;
    for (String valueField : FIELD_CHANGE_VALUES) {
      String recorded = fieldChange.path(valueField).asText("");
      String replacement = isJson(recorded) ? masked.apply(recorded) : null;
      if (replacement != null) {
        fieldChange.put(valueField, replacement);
        changed = true;
      }
    }
    return changed;
  }

  private static boolean isJson(String text) {
    return text.startsWith("[") || text.startsWith("{");
  }

  private static void addIfScalar(List<JsonPointer> fields, JsonNode config, JsonPointer pointer) {
    if (config.at(pointer).isValueNode() && !config.at(pointer).isNull()) {
      fields.add(pointer);
    }
  }

  private static void set(JsonNode config, JsonPointer field, String value) {
    ((ObjectNode) config.at(field.head())).put(field.last().getMatchingProperty(), value);
  }
}

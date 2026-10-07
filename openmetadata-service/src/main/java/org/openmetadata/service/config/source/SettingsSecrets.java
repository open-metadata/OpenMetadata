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

package org.openmetadata.service.config.source;

import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.introspect.Annotated;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.macasaet.fernet.TokenValidationException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

/**
 * The secret fields of each setting that lives both in the deployment and in the database, found
 * from the {@code "format": "password"} schema annotation, and the operations on them: Fernet
 * encryption at rest, decryption for comparison, and masking for API responses.
 */
@Slf4j
public final class SettingsSecrets {
  private static final String SCHEMA_PACKAGE = "org.openmetadata";
  private static final Map<SettingsType, Set<String>> SECRET_POINTERS =
      Arrays.stream(DualSourceSetting.values())
          .collect(
              Collectors.toUnmodifiableMap(
                  DualSourceSetting::settingsType,
                  setting -> discoverSecretPointers(setting.valueClass())));

  private SettingsSecrets() {}

  public static Set<String> pointersOf(SettingsType settingsType) {
    return SECRET_POINTERS.getOrDefault(settingsType, Set.of());
  }

  /** A copy of {@code value} with its secrets decrypted; undecryptable secrets are left as is. */
  public static ObjectNode decrypted(SettingsType settingsType, JsonNode value) {
    return transformSecrets(settingsType, value, secret -> decryptOrKeep(settingsType, secret));
  }

  /** A copy of {@code value} with its secrets Fernet-encrypted, when a Fernet key is configured. */
  public static ObjectNode encrypted(SettingsType settingsType, JsonNode value) {
    Fernet fernet = Fernet.getInstance();
    return fernet.isKeyDefined()
        ? transformSecrets(settingsType, value, fernet::encryptIfApplies)
        : copyOf(value);
  }

  public static ObjectNode masked(SettingsType settingsType, JsonNode value) {
    return transformSecrets(settingsType, value, secret -> PasswordEntityMasker.PASSWORD_MASK);
  }

  /**
   * A copy of {@code updated} in which secrets the client sent back masked, or left out, take their
   * value from {@code original}. Clients only ever see masked secrets, so sending one back means
   * "unchanged".
   */
  public static ObjectNode withMaskedSecretsRestored(
      SettingsType settingsType, JsonNode updated, JsonNode original) {
    ObjectNode restored = copyOf(updated);
    for (String pointer : pointersOf(settingsType)) {
      JsonNode sent = JsonPointers.valueAt(updated, pointer);
      JsonNode kept = JsonPointers.valueAt(original, pointer);
      if (isMaskedOrMissing(sent) && !kept.isMissingNode()) {
        JsonPointers.setValue(restored, pointer, kept.deepCopy());
      }
    }
    return restored;
  }

  private static boolean isMaskedOrMissing(JsonNode sent) {
    return sent.isMissingNode() || PasswordEntityMasker.PASSWORD_MASK.equals(sent.asText());
  }

  /**
   * Masks the secrets of {@code value} in place. Works on the object itself: a JSON round trip
   * would re-apply schema defaults to fields the caller set to null.
   */
  public static void maskInPlace(SettingsType settingsType, Object value) {
    for (String pointer : pointersOf(settingsType)) {
      BeanPath.parentOf(value, pointer)
          .filter(parent -> !isEmptySecret(BeanPath.get(parent, BeanPath.lastSegment(pointer))))
          .ifPresent(
              parent ->
                  BeanPath.set(
                      parent, BeanPath.lastSegment(pointer), PasswordEntityMasker.PASSWORD_MASK));
    }
  }

  /**
   * Gives every secret of {@code updated} that the client sent back masked, or left out, the value
   * it has in {@code original}, in place. Clients only ever see masked secrets.
   */
  public static void restoreMaskedInPlace(
      SettingsType settingsType, Object updated, Object original) {
    for (String pointer : pointersOf(settingsType)) {
      String field = BeanPath.lastSegment(pointer);
      BeanPath.parentOf(updated, pointer)
          .filter(parent -> isMaskedOrMissing(BeanPath.get(parent, field)))
          .ifPresent(
              parent ->
                  BeanPath.parentOf(original, pointer)
                      .map(originalParent -> BeanPath.get(originalParent, field))
                      .ifPresent(kept -> BeanPath.set(parent, field, kept)));
    }
  }

  private static boolean isEmptySecret(Object secret) {
    return secret == null || secret.toString().isEmpty();
  }

  private static boolean isMaskedOrMissing(Object sent) {
    return sent == null || PasswordEntityMasker.PASSWORD_MASK.equals(sent);
  }

  private static ObjectNode transformSecrets(
      SettingsType settingsType, JsonNode value, UnaryOperator<String> transform) {
    ObjectNode result = copyOf(value);
    for (String pointer : pointersOf(settingsType)) {
      JsonNode secret = JsonPointers.valueAt(result, pointer);
      if (secret.isTextual() && !secret.asText().isEmpty()) {
        JsonPointers.setValue(result, pointer, TextNode.valueOf(transform.apply(secret.asText())));
      }
    }
    return result;
  }

  /** A secret written with another Fernet key cannot be read; it is kept rather than lost. */
  private static String decryptOrKeep(SettingsType settingsType, String secret) {
    Fernet fernet = Fernet.getInstance();
    String decrypted = secret;
    if (Fernet.isTokenized(secret) && fernet.isKeyDefined()) {
      try {
        decrypted = fernet.decrypt(secret);
      } catch (TokenValidationException | IllegalArgumentException undecryptable) {
        LOG.warn("A secret of {} cannot be decrypted with the configured Fernet key", settingsType);
      }
    }
    return decrypted;
  }

  private static ObjectNode copyOf(JsonNode value) {
    return value instanceof ObjectNode objectValue
        ? objectValue.deepCopy()
        : JsonNodeFactory.instance.objectNode();
  }

  static Set<String> discoverSecretPointers(Class<?> valueClass) {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    Set<String> pointers = new TreeSet<>();
    collectSecretPointers(mapper, mapper.constructType(valueClass), "", pointers, new HashSet<>());
    return Set.copyOf(pointers);
  }

  private static void collectSecretPointers(
      ObjectMapper mapper,
      JavaType type,
      String prefix,
      Set<String> pointers,
      Set<Class<?>> visiting) {
    if (visiting.add(type.getRawClass())) {
      BeanDescription description = mapper.getSerializationConfig().introspect(type);
      for (BeanPropertyDefinition property : description.findProperties()) {
        String pointer = JsonPointers.child(prefix, property.getName());
        if (isSecret(property)) {
          pointers.add(pointer);
        } else if (isSettingsObject(property.getPrimaryType())) {
          collectSecretPointers(mapper, property.getPrimaryType(), pointer, pointers, visiting);
        }
      }
      visiting.remove(type.getRawClass());
    }
  }

  private static boolean isSecret(BeanPropertyDefinition property) {
    return hasPasswordAnnotation(property.getField())
        || hasPasswordAnnotation(property.getGetter());
  }

  private static boolean hasPasswordAnnotation(Annotated member) {
    return member != null && member.hasAnnotation(PasswordField.class);
  }

  private static boolean isSettingsObject(JavaType type) {
    Class<?> rawClass = type.getRawClass();
    return !rawClass.isEnum()
        && !rawClass.isPrimitive()
        && rawClass.getPackageName().startsWith(SCHEMA_PACKAGE);
  }
}

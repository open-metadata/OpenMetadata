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

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.BadRequestException;
import java.lang.reflect.Method;
import java.util.Collection;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsUtil;
import org.openmetadata.service.util.ReflectionUtil;

/**
 * Stored connection secrets stay with the endpoint they were entered for. A caller who only ever
 * sees a connection's secrets masked may change its other settings, but once those settings point
 * the connection somewhere else its secrets must be entered again: restoring the stored ones would
 * hand them to whatever the connection now points at.
 *
 * <p>Both connections are masked, which turns every secret into the same placeholder; whatever
 * still differs is a setting that is not secret. Any such change other than an ingestion filter, a
 * capability flag or a description is treated as redirecting the connection, so a connector-specific
 * target field the guard does not recognise fails closed rather than silently restoring the secret.
 * A secret counts as kept when it arrives masked, as the stored value, or as any encoded value.
 * ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged
 */
public final class ConnectionSecretsGuard {
  public static final String SECRETS_REQUIRED =
      "The connection now points somewhere else, so enter its secrets again.";

  private ConnectionSecretsGuard() {}

  public static void requireSecretsReenteredOnRetarget(
      Object incomingConfig, Object storedConfig, String connectionType, ServiceType serviceType) {
    if (incomingConfig == null || storedConfig == null) {
      return;
    }
    JsonNode incoming;
    JsonNode stored;
    JsonNode maskedIncoming;
    JsonNode maskedStored;
    Set<String> passwordMapPaths;
    try {
      Object incomingPojo =
          SecretsUtil.convert(copyOf(incomingConfig), connectionType, null, serviceType);
      Object storedPojo =
          SecretsUtil.convert(copyOf(storedConfig), connectionType, null, serviceType);
      incoming = JsonUtils.valueToTree(incomingPojo);
      stored = JsonUtils.valueToTree(storedPojo);
      maskedIncoming = masked(incomingConfig, connectionType, serviceType);
      maskedStored = masked(storedConfig, connectionType, serviceType);
      passwordMapPaths = passwordMapEntryPaths(incomingPojo);
    } catch (RuntimeException e) {
      // A connection that cannot be read fails where it is unmasked and saved, restoring nothing.
      return;
    }
    if ((nonExemptFieldChanged(maskedIncoming, maskedStored)
            || maskedPasswordMapEntryEdited(maskedIncoming, incoming, stored, passwordMapPaths, ""))
        && keepsStoredSecret(maskedIncoming, incoming, stored)) {
      throw new BadRequestException(SECRETS_REQUIRED);
    }
  }

  /**
   * Whether a password-map entry was typed over. Every string entry of a password-valued map
   * (Kafka {@code consumerConfig}, say) masks to the same placeholder, so an edit to a non-secret
   * entry - the OAuth token endpoint URL next to the client secret - is invisible in the masked
   * comparison above. Before maps were masked the edit was visible and the guard caught it, so
   * without this check an editor could redirect a map setting while keeping the map's secrets
   * masked and have them restored. A typed (plaintext) value at a masked map entry counts as an
   * edit unless it still equals the stored entry; a value arriving as the mask, a Fernet token or
   * a {@code secret:} reference is the stored entry kept, not a change.
   *
   * <p>The check is scoped to password-map entries deliberately: at a scalar password field a
   * typed value is a re-entered secret, which the guard has always accepted, and only the map
   * blanket masks non-secret settings.
   */
  private static boolean maskedPasswordMapEntryEdited(
      JsonNode masked,
      JsonNode incoming,
      JsonNode stored,
      Set<String> passwordMapPaths,
      String path) {
    if (masked.isObject()) {
      for (Iterator<Map.Entry<String, JsonNode>> fields = masked.fields(); fields.hasNext(); ) {
        Map.Entry<String, JsonNode> field = fields.next();
        String childPath = path.isEmpty() ? field.getKey() : path + "." + field.getKey();
        if (maskedPasswordMapEntryEdited(
            field.getValue(),
            incoming.path(field.getKey()),
            stored.path(field.getKey()),
            passwordMapPaths,
            childPath)) {
          return true;
        }
      }
      return false;
    }
    if (masked.isArray()) {
      for (int i = 0; i < masked.size(); i++) {
        if (maskedPasswordMapEntryEdited(
            masked.get(i), incoming.path(i), stored.path(i), passwordMapPaths, path + "." + i)) {
          return true;
        }
      }
      return false;
    }
    if (!masked.isTextual()
        || !PASSWORD_MASK.equals(masked.asText())
        || !passwordMapPaths.contains(path)
        || !incoming.isTextual()) {
      return false;
    }
    String value = incoming.asText();
    if (PASSWORD_MASK.equals(value)
        || Fernet.isTokenized(value)
        || value.startsWith(SecretsManager.SECRET_FIELD_PREFIX)) {
      return false;
    }
    return !value.equals(cleartextOfStoredEntry(stored));
  }

  /**
   * The cleartext a stored map entry holds when it can be recovered locally: the value itself for
   * rows saved before maps were encrypted, a Fernet decrypt for current rows. An entry whose value
   * cannot be recovered - an external {@code secret:} reference the server never fetches, or a
   * token that does not decrypt - yields null, and the caller treats the typed value as an edit:
   * it cannot be shown to be the stored one.
   */
  private static String cleartextOfStoredEntry(JsonNode stored) {
    if (!stored.isTextual()) {
      return null;
    }
    String value = stored.asText();
    if (!Fernet.isTokenized(value)) {
      return value;
    }
    try {
      return Fernet.getInstance().decrypt(value);
    } catch (RuntimeException e) {
      return null;
    }
  }

  /**
   * The JSON paths of every entry of a password-valued map reachable from {@code config}, built
   * with the same reflection walk the masker uses so the two agree on what a password-map is. A
   * {@code getAdditionalProperties} map flattens into its holder's JSON object, so its entries
   * live at the holder's path, not under an {@code additionalProperties} segment.
   */
  private static Set<String> passwordMapEntryPaths(Object config) {
    Set<String> paths = new LinkedHashSet<>();
    collectPasswordMapEntryPaths(config, "", paths);
    return paths;
  }

  private static void collectPasswordMapEntryPaths(Object node, String prefix, Set<String> paths) {
    if (!Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(node))) {
      return;
    }
    for (Method method : node.getClass().getMethods()) {
      if (!ReflectionUtil.isGetMethodOfObject(method)) {
        continue;
      }
      Object value = ReflectionUtil.getObjectFromMethod(method, node);
      if (value == null) {
        continue;
      }
      if (method.getAnnotation(PasswordField.class) != null && value instanceof Map<?, ?> map) {
        String base =
            "getAdditionalProperties".equals(method.getName())
                ? prefix
                : prefix + jsonName(method) + ".";
        map.keySet().forEach(key -> paths.add(base + key));
      } else if (Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(value))) {
        collectPasswordMapEntryPaths(value, prefix + jsonName(method) + ".", paths);
      } else if (value instanceof Collection<?> collection) {
        int index = 0;
        for (Object element : collection) {
          collectPasswordMapEntryPaths(
              element, prefix + jsonName(method) + "." + index++ + ".", paths);
        }
      }
    }
  }

  private static String jsonName(Method getter) {
    JsonProperty jsonProperty = getter.getAnnotation(JsonProperty.class);
    if (jsonProperty != null && !jsonProperty.value().isEmpty()) {
      return jsonProperty.value();
    }
    String name = getter.getName().replaceFirst("^get", "");
    return Character.toLowerCase(name.charAt(0)) + name.substring(1);
  }

  // Fields that cannot change where a connection points, so a change to one must not force the
  // secret to be re-entered: ingestion filter patterns (names ending "filterPattern"), capability
  // flags (names starting "supports") and free-text descriptions. Every other field is assumed able
  // to redirect the connection. Matching known-safe fields rather than known-endpoint ones fails
  // closed: a connector-specific target the list does not name (an Oracle TNS descriptor, a host in
  // connectionArguments, Domo's instanceDomain) is still treated as a redirect, not silently kept.
  private static final Set<String> EXEMPT_FIELD_SUFFIXES = Set.of("filterpattern", "description");

  private static boolean isExemptField(String key) {
    String lower = key.toLowerCase(Locale.ROOT);
    return lower.startsWith("supports") || EXEMPT_FIELD_SUFFIXES.stream().anyMatch(lower::endsWith);
  }

  /**
   * Whether any field other than a known-safe one differs between the two masked configs, in either
   * direction. A key or array entry the incoming config drops counts as much as one it adds:
   * removing an override such as a host in {@code connectionArguments} moves the connection too.
   */
  private static boolean nonExemptFieldChanged(JsonNode incoming, JsonNode stored) {
    if (incoming.isObject() || stored.isObject()) {
      Set<String> names = new LinkedHashSet<>();
      incoming.fieldNames().forEachRemaining(names::add);
      stored.fieldNames().forEachRemaining(names::add);
      for (String name : names) {
        if (!isExemptField(name) && nonExemptFieldChanged(incoming.path(name), stored.path(name))) {
          return true;
        }
      }
      return false;
    }
    if (incoming.isArray() || stored.isArray()) {
      for (int i = 0; i < Math.max(incoming.size(), stored.size()); i++) {
        if (nonExemptFieldChanged(incoming.path(i), stored.path(i))) {
          return true;
        }
      }
      return false;
    }
    return !incoming.equals(stored);
  }

  private static boolean keepsStoredSecret(JsonNode masked, JsonNode incoming, JsonNode stored) {
    if (masked.isObject()) {
      for (Iterator<Map.Entry<String, JsonNode>> fields = masked.fields(); fields.hasNext(); ) {
        Map.Entry<String, JsonNode> field = fields.next();
        if (keepsStoredSecret(
            field.getValue(), incoming.path(field.getKey()), stored.path(field.getKey()))) {
          return true;
        }
      }
      return false;
    }
    if (masked.isArray()) {
      for (int i = 0; i < masked.size(); i++) {
        if (keepsStoredSecret(masked.get(i), incoming.path(i), stored.path(i))) {
          return true;
        }
      }
      return false;
    }
    if (!PASSWORD_MASK.equals(masked.asText())) {
      return false;
    }
    String value = incoming.asText();
    return PASSWORD_MASK.equals(value)
        || Fernet.isTokenized(value)
        || value.startsWith(SecretsManager.SECRET_FIELD_PREFIX)
        || (!stored.isMissingNode() && value.equals(stored.asText()));
  }

  private static JsonNode masked(Object config, String connectionType, ServiceType serviceType) {
    return JsonUtils.valueToTree(
        EntityMaskerFactory.getEntityMasker()
            .maskServiceConnectionConfig(copyOf(config), connectionType, serviceType));
  }

  /** Masking and conversion may work on the object they are given, so they get a copy. */
  private static Object copyOf(Object config) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(config), Object.class);
  }
}

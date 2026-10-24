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

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.BadRequestException;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsUtil;

/**
 * Stored connection secrets stay with the endpoint they were entered for. A caller who only ever
 * sees a connection's secrets masked may change its other settings, but once those settings point
 * the connection somewhere else its secrets must be entered again: restoring the stored ones would
 * hand them to whatever the connection now points at.
 *
 * <p>Both connections are masked, which turns every secret into the same placeholder; whatever
 * still differs is a setting that is not secret. A secret counts as kept when it arrives masked,
 * as the stored value, or as any encoded value.
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
    try {
      incoming = converted(incomingConfig, connectionType, serviceType);
      stored = converted(storedConfig, connectionType, serviceType);
      maskedIncoming = masked(incomingConfig, connectionType, serviceType);
      maskedStored = masked(storedConfig, connectionType, serviceType);
    } catch (RuntimeException e) {
      // A connection that cannot be read fails where it is unmasked and saved, restoring nothing.
      return;
    }
    if (endpointChanged(maskedIncoming, maskedStored, "")
        && keepsStoredSecret(maskedIncoming, incoming, stored)) {
      throw new BadRequestException(SECRETS_REQUIRED);
    }
  }

  // The fields that say where a connection points. Only a change to one of these can redirect a
  // kept secret to somewhere new; editing a filter, a flag or a description keeps the same target,
  // so it must not force the secret to be re-entered. Matched case-insensitively as a substring, so
  // hostPort, serverUrl, accountUrl, serviceEndpoint, databaseHost and the like are all covered.
  private static final Set<String> ENDPOINT_FIELD_TOKENS =
      Set.of("host", "url", "uri", "endpoint", "account", "server", "address", "port");

  /** Whether any endpoint field differs between the two masked configs. */
  private static boolean endpointChanged(JsonNode incoming, JsonNode stored, String key) {
    if (incoming.isObject()) {
      for (Iterator<Map.Entry<String, JsonNode>> fields = incoming.fields(); fields.hasNext(); ) {
        Map.Entry<String, JsonNode> field = fields.next();
        if (endpointChanged(field.getValue(), stored.path(field.getKey()), field.getKey())) {
          return true;
        }
      }
      return false;
    }
    if (incoming.isArray()) {
      for (int i = 0; i < incoming.size(); i++) {
        if (endpointChanged(incoming.get(i), stored.path(i), key)) {
          return true;
        }
      }
      return false;
    }
    return isEndpointField(key) && !incoming.equals(stored);
  }

  private static boolean isEndpointField(String key) {
    String lower = key.toLowerCase(java.util.Locale.ROOT);
    return ENDPOINT_FIELD_TOKENS.stream().anyMatch(lower::contains);
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

  private static JsonNode converted(Object config, String connectionType, ServiceType serviceType) {
    return JsonUtils.valueToTree(
        SecretsUtil.convert(copyOf(config), connectionType, null, serviceType));
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

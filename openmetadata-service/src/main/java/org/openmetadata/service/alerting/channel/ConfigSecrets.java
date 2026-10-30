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

import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.macasaet.fernet.TokenValidationException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.UnaryOperator;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.fernet.Fernet;

/**
 * The secrets of one sending configuration, as JSON, at the fields its owner names: encrypted before
 * the configuration is stored, decrypted where a message is sent, masked in a response, and
 * restored from the stored configuration when a request sends back what it read. An alert's
 * destinations and the webhooks on a user's or a team's profile keep their secrets this one way.
 */
@Slf4j
public final class ConfigSecrets {
  public static final UnaryOperator<String> MASK = secret -> PASSWORD_MASK;

  // Where a configuration delivers what it carries: the endpoint it posts to, and, for OAuth
  // credentials, the token URL they are shown to. A secret restored beside a moved target would
  // be delivered to an address the request chose, which a caller who only ever read the mask
  // cannot be allowed to pick, so a target that moved gets every secret entered again.
  private static final List<JsonPointer> SECRET_TARGETS =
      List.of(JsonPointer.compile("/endpoint"), JsonPointer.compile("/authType/tokenUrl"));
  // Each receiver replaces the endpoint at send time and is sent the same headers and
  // credentials, so a receivers list is a target too.
  private static final JsonPointer RECEIVERS = JsonPointer.compile("/receivers");

  private ConfigSecrets() {}

  /** Encrypts, in place, the text at each field. Ciphertext is kept as it is. */
  public static boolean encrypt(JsonNode config, List<JsonPointer> fields) {
    return transform(config, fields, ConfigSecrets::encrypted);
  }

  /** Decrypts, in place, the text at each field. Text that is not ciphertext is kept as it is. */
  public static boolean decrypt(JsonNode config, List<JsonPointer> fields) {
    return transform(config, fields, ConfigSecrets::decrypted);
  }

  /** Replaces, in place, the text at each field with the mask. */
  public static boolean mask(JsonNode config, List<JsonPointer> fields) {
    return transform(config, fields, MASK);
  }

  /**
   * Restores, in place, what {@code sent} carries as it was read from {@code stored}: a mask stands
   * for the value stored at the same field, and a plaintext that the stored ciphertext decrypts to
   * is replaced by that ciphertext, so sending a secret again changes nothing. Fernet ciphertext is
   * randomized, so encrypting it again never would. Says nothing of a moved target, which the caller
   * judges first with {@link #targetMoved}.
   */
  public static boolean restore(JsonNode stored, JsonNode sent, List<JsonPointer> fields) {
    boolean changed = false;
    for (JsonPointer field : fields) {
      String storedValue = stored.at(field).asText(null);
      if (storedValue != null && standsForStored(sent.at(field).asText(null), storedValue)) {
        set(sent, field, storedValue);
        changed = true;
      }
    }
    return changed;
  }

  /** Whether {@code sent} would deliver what {@code stored} carries somewhere it is not stored. */
  public static boolean targetMoved(JsonNode stored, JsonNode sent) {
    return SECRET_TARGETS.stream()
            .anyMatch(
                target ->
                    !targetUnchanged(sent.at(target).asText(null), stored.at(target).asText(null)))
        || !receiverTexts(stored).equals(receiverTexts(sent));
  }

  public static boolean isMask(String value) {
    return PASSWORD_MASK.equals(value);
  }

  static void set(JsonNode config, JsonPointer field, String value) {
    ((ObjectNode) config.at(field.head())).put(field.last().getMatchingProperty(), value);
  }

  static boolean transform(JsonNode config, List<JsonPointer> fields, UnaryOperator<String> op) {
    boolean changed = false;
    for (JsonPointer field : fields) {
      String value = config.at(field).asText();
      String transformed = op.apply(value);
      if (!transformed.equals(value)) {
        set(config, field, transformed);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Whether a target stands for what is stored: the same secret in plain text, the mask standing
   * for the stored one, or plain text the stored ciphertext decrypts to. A plain text beside a
   * plain text (a configuration stored before this model) is kept as it reads.
   */
  private static boolean targetUnchanged(String sent, String stored) {
    if (stored == null) {
      return sent == null;
    }
    return sent != null && (sent.equals(stored) || isMask(sent) || isCiphertextOf(sent, stored));
  }

  private static Set<String> receiverTexts(JsonNode config) {
    Set<String> receivers = new HashSet<>();
    config.at(RECEIVERS).forEach(receiver -> receivers.add(receiver.asText()));
    return receivers;
  }

  private static boolean standsForStored(String incoming, String stored) {
    return isMask(incoming) || isCiphertextOf(incoming, stored);
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
      LOG.debug("A stored secret does not decrypt with the primary Fernet key", e);
    }
    return plaintext;
  }

  private static String encrypted(String value) {
    boolean keptAsIs = value.isEmpty() || !Fernet.getInstance().isKeyDefined();
    return keptAsIs ? value : Fernet.getInstance().encryptIfApplies(value);
  }

  private static String decrypted(String value) {
    return Fernet.getInstance().isKeyDefined()
        ? Fernet.getInstance().decryptIfApplies(value)
        : value;
  }
}

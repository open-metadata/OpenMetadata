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
import jakarta.ws.rs.BadRequestException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.BoundCiphertext;
import org.openmetadata.service.secrets.SecretOwner;

/**
 * The secrets of one sending configuration, as JSON, at the fields its owner names: encrypted for
 * that owner before the configuration is stored, decrypted where a message is sent, masked in a
 * response, and restored from the stored configuration when a request sends back what it read. An
 * alert's destinations and the webhooks on a user's or a team's profile keep their secrets this one
 * way. A secret opens only for the owner and field it was written for ({@link BoundCiphertext}).
 */
@Slf4j
public final class ConfigSecrets {
  private static final String ENTER_AGAIN = "The value at '%s' must be entered again";

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

  /** Encrypts, in place, the text at each field for {@code owner}. Ciphertext is kept as it is. */
  public static boolean encrypt(SecretOwner owner, JsonNode config, List<JsonPointer> fields) {
    return transform(config, fields, (field, value) -> encrypted(owner, field, value));
  }

  /**
   * Decrypts, in place, the text at each field. Text that is not ciphertext is kept as it is, and
   * ciphertext not written for {@code owner} at that field is refused with a 400.
   */
  public static boolean decrypt(SecretOwner owner, JsonNode config, List<JsonPointer> fields) {
    return transform(config, fields, (field, value) -> decrypted(owner, field, value));
  }

  /** Replaces, in place, the text at each field with the mask. */
  public static boolean mask(JsonNode config, List<JsonPointer> fields) {
    return transform(config, fields, (field, value) -> PASSWORD_MASK);
  }

  /**
   * Restores, in place, what {@code sent} carries as it was read from {@code stored}: a mask stands
   * for the value stored at the same field, and a plaintext that the stored ciphertext decrypts to
   * is replaced by that ciphertext, so sending a secret again changes nothing. Fernet ciphertext is
   * randomized, so encrypting it again never would. Says nothing of a moved target, which the caller
   * judges first with {@link #targetMoved}.
   */
  public static boolean restore(
      SecretOwner owner, JsonNode stored, JsonNode sent, List<JsonPointer> fields) {
    boolean changed = false;
    for (JsonPointer field : fields) {
      String storedValue = stored.at(field).asText(null);
      String sentValue = sent.at(field).asText(null);
      if (storedValue != null && standsForStored(owner, field, sentValue, storedValue)) {
        set(sent, field, storedValue);
        changed = true;
      }
    }
    return changed;
  }

  /** Whether {@code sent} would deliver what {@code stored} carries somewhere it is not stored. */
  public static boolean targetMoved(SecretOwner owner, JsonNode stored, JsonNode sent) {
    return SECRET_TARGETS.stream()
            .anyMatch(
                target ->
                    !targetUnchanged(
                        owner,
                        target,
                        sent.at(target).asText(null),
                        stored.at(target).asText(null)))
        || !receiverTexts(stored).equals(receiverTexts(sent));
  }

  public static boolean isMask(String value) {
    return PASSWORD_MASK.equals(value);
  }

  static void set(JsonNode config, JsonPointer field, String value) {
    ((ObjectNode) config.at(field.head())).put(field.last().getMatchingProperty(), value);
  }

  static boolean transform(
      JsonNode config, List<JsonPointer> fields, BiFunction<JsonPointer, String, String> op) {
    boolean changed = false;
    for (JsonPointer field : fields) {
      String value = config.at(field).asText();
      String transformed = op.apply(field, value);
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
  private static boolean targetUnchanged(
      SecretOwner owner, JsonPointer target, String sent, String stored) {
    if (stored == null) {
      return sent == null;
    }
    return sent != null
        && (sent.equals(stored) || isMask(sent) || isCiphertextOf(owner, target, sent, stored));
  }

  private static Set<String> receiverTexts(JsonNode config) {
    Set<String> receivers = new HashSet<>();
    config.at(RECEIVERS).forEach(receiver -> receivers.add(receiver.asText()));
    return receivers;
  }

  private static boolean standsForStored(
      SecretOwner owner, JsonPointer field, String incoming, String stored) {
    return isMask(incoming) || isCiphertextOf(owner, field, incoming, stored);
  }

  // Ciphertext the primary key cannot decrypt, one of an older key of a rotation list included,
  // matches nothing, so sending the secret again encrypts it with the primary key.
  private static boolean isCiphertextOf(
      SecretOwner owner, JsonPointer field, String incoming, String stored) {
    return incoming != null
        && !Fernet.isTokenized(incoming)
        && BoundCiphertext.isBound(stored)
        && Fernet.getInstance().isKeyDefined()
        && BoundCiphertext.decryptWithPrimaryKey(owner, field.toString(), stored)
            .filter(incoming::equals)
            .isPresent();
  }

  private static String encrypted(SecretOwner owner, JsonPointer field, String value) {
    boolean keptAsIs =
        value.isEmpty() || !Fernet.getInstance().isKeyDefined() || Fernet.isTokenized(value);
    return keptAsIs ? value : BoundCiphertext.encrypt(owner, field.toString(), value);
  }

  private static String decrypted(SecretOwner owner, JsonPointer field, String value) {
    boolean ciphertext = Fernet.getInstance().isKeyDefined() && Fernet.isTokenized(value);
    return ciphertext
        ? BoundCiphertext.decrypt(owner, field.toString(), value)
            .orElseThrow(() -> new BadRequestException(ENTER_AGAIN.formatted(field)))
        : value;
  }
}

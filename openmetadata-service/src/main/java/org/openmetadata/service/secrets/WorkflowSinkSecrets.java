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

package org.openmetadata.service.secrets;

import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.databind.JsonNode;
import com.macasaet.fernet.TokenValidationException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.WorkflowDefinitionMasker;

/**
 * Encrypts the credentials of governance workflow sink tasks at rest and decrypts them for the
 * sink provider.
 *
 * <p>Sink secrets are Fernet-encrypted in place, as event subscription webhook secrets are: the
 * server reads them back itself when the workflow runs, so they are kept out of external secrets
 * managers. Values that are already encrypted, empty or the mask are kept as they are, so
 * encrypting twice changes nothing. Without a Fernet key ({@code no_encryption_at_rest}) secrets
 * are stored as sent.
 */
@Slf4j
public final class WorkflowSinkSecrets {
  private WorkflowSinkSecrets() {}

  /** Encrypts, in place, every plaintext sink secret of the nodes of {@code definition}. */
  public static void encrypt(WorkflowDefinition definition) {
    if (Fernet.getInstance().isKeyDefined()) {
      WorkflowDefinitionMasker.transformSecrets(definition, WorkflowSinkSecrets::encryptSecret);
    }
  }

  /**
   * Encrypts, in place, every plaintext sink secret of {@code updated}, an update of {@code
   * original}. A plaintext value that the stored ciphertext at the same field of the sink node of
   * the same name decrypts to is replaced by that ciphertext, so sending a secret again leaves the
   * definition unchanged; Fernet ciphertext is randomized, so encrypting it again never would.
   */
  public static void encrypt(WorkflowDefinition original, WorkflowDefinition updated) {
    if (Fernet.getInstance().isKeyDefined()) {
      WorkflowDefinitionMasker.restoreStoredSecrets(
          original, updated, WorkflowSinkSecrets::isCiphertextOf);
      encrypt(updated);
    }
  }

  /**
   * Encrypts, in place, every plaintext sink secret of a stored workflow definition JSON, including
   * the nodes recorded in its change descriptions. Returns whether any value was encrypted. Used by
   * the Collate 2.1.0 sink workflow migration; OpenMetadata itself has no caller.
   */
  public static boolean encrypt(JsonNode definition) {
    return Fernet.getInstance().isKeyDefined()
        && WorkflowDefinitionMasker.transformSecrets(
            definition, WorkflowSinkSecrets::encryptSecret);
  }

  /**
   * Returns a copy of {@code sinkConfig} with every encrypted secret decrypted. Plaintext values,
   * secret references ({@code secret:/...}) among them, are returned as they are.
   */
  public static Object decrypt(Object sinkConfig) {
    return WorkflowDefinitionMasker.transformSinkConfigSecrets(
        sinkConfig, Fernet.getInstance()::decryptIfApplies);
  }

  /**
   * Whether {@code stored} is ciphertext of the plaintext {@code incoming} under the primary Fernet
   * key. Ciphertext the primary key cannot decrypt, one made with an older key of a rotation list
   * included, matches nothing, so sending the secret again encrypts it with the primary key.
   */
  static boolean isCiphertextOf(String incoming, String stored) {
    return !Fernet.isTokenized(incoming)
        && Fernet.isTokenized(stored)
        && incoming.equals(decryptOrNull(stored));
  }

  private static String decryptOrNull(String ciphertext) {
    String plaintext = null;
    try {
      plaintext = Fernet.getInstance().decryptWithPrimaryKey(ciphertext);
    } catch (TokenValidationException | IllegalArgumentException e) {
      LOG.debug("A stored sink secret does not decrypt with the primary Fernet key", e);
    }
    return plaintext;
  }

  static String encryptSecret(String secret) {
    boolean keptAsIs =
        secret.isEmpty() || Fernet.isTokenized(secret) || PASSWORD_MASK.equals(secret);
    return keptAsIs ? secret : Fernet.getInstance().encrypt(secret);
  }
}

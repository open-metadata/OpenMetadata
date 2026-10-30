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

import static org.openmetadata.service.secrets.SecretsManager.SECRET_FIELD_PREFIX;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;

/**
 * Stores credentials under keys derived from their owner's identity: {@code
 * <managed namespace><owner segments>/<field key>}. The namespace says who a stored secret belongs
 * to.
 *
 * <p>A reference into the managed namespace is kept when it lies in the owner's own namespace or
 * the owner already holds it. References into a vault the caller manages themselves, outside the
 * managed namespace, are left alone. ADR:2026-10-30-owned-secret-keys-are-derived-from-owner-ids
 */
@Slf4j
public final class OwnedSecrets {
  private static final String FOREIGN_REFERENCE =
      "Field [%s] refers to a secret it does not hold. Enter the credential itself instead.";
  private static final String KEY_TOO_LONG =
      "Secret key [%s] is %d characters long, over the %d the secrets manager accepts. "
          + "Shorten the configured secrets manager prefix or cluster name.";

  private final SecretsManager secretsManager;

  OwnedSecrets(SecretsManager secretsManager) {
    this.secretsManager = secretsManager;
  }

  /** What a migration moved, and the fields whose stored secret it could not read. */
  public record RekeyResult(
      List<String> rekeyedFields, List<String> missingFields, List<String> failedFields) {
    public RekeyResult {
      rekeyedFields = List.copyOf(rekeyedFields);
      missingFields = List.copyOf(missingFields);
      failedFields = List.copyOf(failedFields);
    }
  }

  private enum FieldValue {
    CLEARED,
    REFERENCE,
    PLAINTEXT
  }

  /**
   * Prepares {@code value} for storage, in place: a plaintext credential is written under the
   * owner's key and replaced by its reference, and every value is kept Fernet-encrypted.
   *
   * @param path where {@code value} sits inside the owner, so two parts of one owner never share a
   *     key
   * @param keptReferences the references the owner holds today; they may stay although they lie
   *     outside the owner's namespace, which is how secrets stored under an older key layout keep
   *     working
   */
  public Object encrypt(
      Object value, SecretOwner owner, List<String> path, Set<String> keptReferences) {
    if (value != null) {
      PasswordFieldWalker.walk(
          value,
          path,
          (fieldPath, stored) -> encryptField(owner, fieldPath, stored, keptReferences));
    }
    return value;
  }

  /**
   * Moves every secret {@code value} references under an older key layout to the owner's own key,
   * in place. A field whose old secret is missing or cannot be read keeps its reference, so it
   * resolves exactly as before. The old secret is never deleted: deployed copies of a configuration
   * may still point at it.
   */
  public RekeyResult rekey(Object value, SecretOwner owner, List<String> path) {
    Rekeying rekeying = new Rekeying(owner);
    if (value != null) {
      PasswordFieldWalker.walk(value, path, rekeying::visit);
    }
    return rekeying.result();
  }

  /** Every {@code secret:} reference {@code value} holds, Fernet-decrypted. */
  public Set<String> references(Object value) {
    Set<String> references = new LinkedHashSet<>();
    if (value != null) {
      PasswordFieldWalker.walk(
          value, List.of(), (fieldPath, stored) -> collectReference(stored, references));
    }
    return Collections.unmodifiableSet(references);
  }

  /**
   * Deletes the secrets of {@code references} that lie in the owner's namespace; anything else is
   * left alone. A failed delete is logged and leaves an unused secret behind, so it never fails the
   * caller's write.
   */
  public void delete(Collection<String> references, SecretOwner owner) {
    references.stream()
        .filter(reference -> isOwnedBy(reference, owner))
        .map(OwnedSecrets::secretName)
        .forEach(this::deleteQuietly);
  }

  /** Whether {@code reference} points into the namespace this deployment manages. */
  public boolean isManaged(String reference) {
    return isReference(reference) && secretName(reference).startsWith(managedNamespace());
  }

  public boolean isOwnedBy(String reference, SecretOwner owner) {
    return isReference(reference) && secretName(reference).startsWith(namespace(owner));
  }

  /** Whether the secret {@code reference} points at exists. Reads it, but never returns it. */
  public boolean exists(String reference) {
    return secretsManager.findSecretValue(reference).isPresent();
  }

  private String encryptField(
      SecretOwner owner, List<String> fieldPath, String stored, Set<String> keptReferences) {
    String value = fernet().decryptIfApplies(stored);
    return switch (classify(value)) {
      case CLEARED -> null;
      case REFERENCE -> {
        requireAcceptedReference(value, owner, keptReferences, fieldPath);
        yield storedForm(stored, value, value);
      }
      case PLAINTEXT -> storedForm(stored, value, storeValue(owner, fieldPath, value));
    };
  }

  /** Keeps the stored ciphertext when the field ends up holding what it held, so a re-save is a no-op. */
  private String storedForm(String stored, String value, String result) {
    return Fernet.isTokenized(stored) && result.equals(value) ? stored : fernet().encrypt(result);
  }

  private FieldValue classify(String value) {
    FieldValue fieldValue = FieldValue.PLAINTEXT;
    if (value.isEmpty()) {
      fieldValue = FieldValue.CLEARED;
    } else if (isReference(value)) {
      fieldValue = FieldValue.REFERENCE;
    }
    return fieldValue;
  }

  private void requireAcceptedReference(
      String reference, SecretOwner owner, Set<String> keptReferences, List<String> fieldPath) {
    boolean accepted =
        !isManaged(reference) || isOwnedBy(reference, owner) || keptReferences.contains(reference);
    if (!accepted) {
      throw new SecretsManagerException(
          Response.Status.BAD_REQUEST, String.format(FOREIGN_REFERENCE, fieldPath.getLast()));
    }
  }

  private String storeValue(SecretOwner owner, List<String> fieldPath, String value) {
    return secretsManager.storeOwnedValue(fieldPath.getLast(), secretId(owner, fieldPath), value);
  }

  private String secretId(SecretOwner owner, List<String> fieldPath) {
    String secretId = namespace(owner) + SecretKeyEncoding.fieldKey(fieldPath);
    int maxLength = secretsManager.maxSecretIdLength();
    if (secretId.length() > maxLength) {
      throw new SecretsManagerException(
          String.format(KEY_TOO_LONG, secretId, secretId.length(), maxLength));
    }
    return secretId;
  }

  private String namespace(SecretOwner owner) {
    String separator = separator();
    return managedNamespace() + String.join(separator, owner.segments()) + separator;
  }

  private String managedNamespace() {
    return secretsManager.buildSecretId(true) + separator();
  }

  private String separator() {
    return secretsManager.getSecretsIdConfig().separator();
  }

  private boolean isReference(String value) {
    return Boolean.TRUE.equals(secretsManager.isSecret(value));
  }

  private String collectReference(String stored, Set<String> references) {
    String value = fernet().decryptIfApplies(stored);
    if (isReference(value)) {
      references.add(value);
    }
    return stored;
  }

  private void deleteQuietly(String secretName) {
    try {
      secretsManager.deleteStoredSecret(secretName);
    } catch (SecretsManagerException e) {
      LOG.warn(
          "Secret [{}] is no longer used but could not be deleted; remove it from the secrets "
              + "manager: {}",
          secretName,
          e.getMessage());
    }
  }

  private Fernet fernet() {
    return secretsManager.fernet();
  }

  private static String secretName(String reference) {
    return reference.substring(SECRET_FIELD_PREFIX.length());
  }

  private final class Rekeying {
    private final SecretOwner owner;
    private final List<String> rekeyed = new ArrayList<>();
    private final List<String> missing = new ArrayList<>();
    private final List<String> failed = new ArrayList<>();

    private Rekeying(SecretOwner owner) {
      this.owner = owner;
    }

    private String visit(List<String> fieldPath, String stored) {
      String value = fernet().decryptIfApplies(stored);
      boolean isLegacy = isManaged(value) && !isOwnedBy(value, owner);
      return isLegacy ? move(fieldPath, stored, value) : stored;
    }

    private String move(List<String> fieldPath, String stored, String reference) {
      String moved = stored;
      try {
        moved =
            secretsManager
                .findSecretValue(reference)
                .map(secret -> copy(fieldPath, stored, secret))
                .orElseGet(() -> markMissing(fieldPath, stored));
      } catch (SecretsManagerException e) {
        failed.add(SecretKeyEncoding.pointer(fieldPath));
        LOG.warn(
            "Kept the old secret of field [{}]: {}",
            SecretKeyEncoding.pointer(fieldPath),
            e.getMessage());
      }
      return moved;
    }

    private String copy(List<String> fieldPath, String stored, String secret) {
      String reference = storeValue(owner, fieldPath, secret);
      rekeyed.add(SecretKeyEncoding.pointer(fieldPath));
      return Fernet.isTokenized(stored) ? fernet().encrypt(reference) : reference;
    }

    private String markMissing(List<String> fieldPath, String stored) {
      missing.add(SecretKeyEncoding.pointer(fieldPath));
      return stored;
    }

    private RekeyResult result() {
      return new RekeyResult(rekeyed, missing, failed);
    }
  }
}

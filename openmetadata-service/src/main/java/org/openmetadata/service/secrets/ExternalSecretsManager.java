/*
 *  Copyright 2021 Collate
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

import com.google.common.annotations.VisibleForTesting;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.exception.SecretsManagerException;

@Slf4j
public abstract class ExternalSecretsManager extends SecretsManager {
  public static final String NULL_SECRET_STRING = "null";

  /**
   * Default write rate to the external backend, used when {@link #RATE_LIMIT_PERMITS_PER_SECOND} is
   * not configured. Ten per second keeps a multi-field encrypt clear of the lowest write quota among
   * the supported providers while staying imperceptible for the common single-field case.
   */
  static final double DEFAULT_PERMITS_PER_SECOND = 10.0;

  /**
   * Optional {@code secretsManager.parameters} key (e.g. in {@code openmetadata.yaml}) overriding the
   * write rate. The limiter is process-global by design — it protects a per-account provider quota
   * that is itself shared across the whole deployment — so operators on higher-quota accounts can
   * raise this to speed up bulk or concurrent saves.
   */
  static final String RATE_LIMIT_PERMITS_PER_SECOND = "rateLimitPermitsPerSecond";

  private static final int MAX_CAUSE_CHAIN_DEPTH = 25;

  private final SecretsManagerRateLimiter rateLimiter;

  protected ExternalSecretsManager(
      SecretsManagerProvider secretsManagerProvider, SecretsConfig secretsConfig) {
    this(
        secretsManagerProvider,
        secretsConfig,
        SecretsManagerRateLimiter.perSecond(permitsPerSecond(secretsConfig)));
  }

  @VisibleForTesting
  protected ExternalSecretsManager(
      SecretsManagerProvider secretsManagerProvider,
      SecretsConfig secretsConfig,
      SecretsManagerRateLimiter rateLimiter) {
    super(secretsManagerProvider, secretsConfig);
    this.rateLimiter = rateLimiter;
  }

  @VisibleForTesting
  static double permitsPerSecond(SecretsConfig secretsConfig) {
    double permits = DEFAULT_PERMITS_PER_SECOND;
    String configured = optionalParameter(secretsConfig, RATE_LIMIT_PERMITS_PER_SECOND);
    if (configured != null) {
      try {
        double parsed = Double.parseDouble(configured.trim());
        if (parsed > 0) {
          permits = parsed;
        } else {
          LOG.warn(
              "Ignoring non-positive {}=[{}]; using default {} permits/sec",
              RATE_LIMIT_PERMITS_PER_SECOND,
              configured,
              DEFAULT_PERMITS_PER_SECOND);
        }
      } catch (NumberFormatException e) {
        LOG.warn(
            "Ignoring unparseable {}=[{}]; using default {} permits/sec",
            RATE_LIMIT_PERMITS_PER_SECOND,
            configured,
            DEFAULT_PERMITS_PER_SECOND);
      }
    }
    return permits;
  }

  private static String optionalParameter(SecretsConfig secretsConfig, String key) {
    String value = null;
    if (secretsConfig != null && secretsConfig.parameters() != null) {
      Map<String, Object> properties = secretsConfig.parameters().getAdditionalProperties();
      Object raw = properties != null ? properties.get(key) : null;
      if (raw != null) {
        value = raw.toString();
      }
    }
    return value;
  }

  @Override
  protected String storeValue(String fieldName, String value, String secretId, boolean store) {
    String fieldSecretId = buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT));
    String result;
    if (isEmptySecret(value)) {
      // Clearing a credential means removing it. Writing the NULL_SECRET_STRING placeholder instead
      // would make consumers read the literal "null" back as if it were the secret.
      if (store) {
        deleteSecret(fieldSecretId);
      }
      result = null;
      // check if value does not start with 'config:' only String can have password annotation
    } else if (Boolean.FALSE.equals(isSecret(value))) {
      if (store) {
        upsertSecret(fieldSecretId, value);
      }
      result = SECRET_FIELD_PREFIX + fieldSecretId;
    } else {
      result = value;
    }
    return result;
  }

  /**
   * Resolves a {@code secret:/...} reference, mapping the {@link #NULL_SECRET_STRING} placeholder
   * written by older versions back to an absent value. Services saved before this was fixed still
   * hold a secret whose payload is the literal "null", which must never be used as a credential.
   * Reading it as absent is what cleans those services up: the connection carries null, and the
   * next save drops the stale secret through {@link #storeValue}.
   *
   * <p>This makes {@link #NULL_SECRET_STRING} a reserved payload — a credential whose real value is
   * the four characters "null" stores fine but reads back as absent. Nothing recorded alongside the
   * secret distinguishes the placeholder from that value, so a one-time migration over the vault
   * could not tell them apart either; it would delete the credential outright where this only hides
   * it, leaving the warning below and a re-save as the way back.
   */
  @Override
  public String getSecretValue(String secretWithPrefix) {
    String secretValue = super.getSecretValue(secretWithPrefix);
    boolean isPlaceholder = NULL_SECRET_STRING.equals(secretValue);
    if (isPlaceholder) {
      LOG.warn(
          "Secret [{}] holds the reserved placeholder \"{}\" that older versions wrote for a "
              + "cleared credential; reading it as absent. Re-save the field to remove the stale "
              + "secret, or set a different value if \"{}\" was the intended credential.",
          secretWithPrefix,
          NULL_SECRET_STRING,
          NULL_SECRET_STRING);
    }
    return isPlaceholder ? null : secretValue;
  }

  public void upsertSecret(String secretName, String secretValue) {
    String sanitizedValue = cleanNullOrEmpty(secretValue);
    try {
      storeOrUpdateSecret(secretName, sanitizedValue);
    } catch (SecretsManagerException e) {
      throw e;
    } catch (RuntimeException e) {
      throw upsertFailure(secretName, e);
    }
  }

  /**
   * Persists a secret, creating it or updating it in place. The default probes existence with a read
   * and then branches to {@link #storeSecret} or {@link #updateSecret}. Providers whose backend
   * offers a read-free idempotent write (e.g. Azure {@code setSecret}, SSM {@code PutParameter}
   * overwrite) should override this to skip the existence read — that read otherwise needs
   * decrypt/read permission on every write and doubles the per-field call count.
   */
  void storeOrUpdateSecret(String secretName, String secretValue) {
    boolean exists = existSecret(secretName);
    throttle();
    if (exists) {
      updateSecret(secretName, secretValue);
    } else {
      storeSecret(secretName, secretValue);
    }
  }

  /**
   * Removes a secret from the external backend, tolerating one that is already gone so clearing a
   * credential that was never stored is not an error. Deliberately does not probe with {@link
   * #existSecret} first: that read reports any failure as "absent", which would silently skip the
   * delete and orphan the secret while the entity says the credential is gone.
   */
  public void deleteSecret(String secretName) {
    throttle();
    try {
      deleteSecretInternal(secretName);
    } catch (RuntimeException e) {
      if (!isNotFoundInCauseChain(e)) {
        throw deleteFailure(secretName, e);
      }
      LOG.debug(
          "Secret [{}] is already absent from {}", secretName, getSecretsManagerProvider().value());
    }
  }

  private SecretsManagerException deleteFailure(String secretName, RuntimeException cause) {
    return new SecretsManagerException(
        String.format(
            "Failed to delete secret [%s] from %s: %s",
            secretName, getSecretsManagerProvider().value(), exceptionMessage(cause)),
        cause);
  }

  private SecretsManagerException upsertFailure(String secretName, RuntimeException cause) {
    // The write may be a create or an update, so the message must not claim "store" specifically.
    return new SecretsManagerException(
        String.format(
            "Failed to store or update secret [%s] in %s: %s",
            secretName, getSecretsManagerProvider().value(), exceptionMessage(cause)),
        cause);
  }

  public boolean existSecret(String secretName) {
    boolean exists = false;
    // Reads are not rate-limited: the limiter protects the (much scarcer) write quota, and charging
    // the existence read against it would needlessly halve write throughput.
    try {
      exists = getSecret(secretName) != null;
    } catch (RuntimeException e) {
      if (!isNotFoundInCauseChain(e)) {
        throw readFailure(secretName, e);
      }
    }
    return exists;
  }

  /**
   * Recognises a provider's not-found error even when it is wrapped inside another exception (an SDK
   * or client-creation wrapper), so a genuinely missing secret is still reported absent and routed to
   * create rather than surfaced as a read failure. Bounded to guard against pathological cause cycles.
   */
  private boolean isNotFoundInCauseChain(Throwable throwable) {
    boolean notFound = false;
    Throwable cause = throwable;
    for (int depth = 0; cause != null && depth < MAX_CAUSE_CHAIN_DEPTH; depth++) {
      if (cause instanceof Exception exception && isNotFoundException(exception)) {
        notFound = true;
        break;
      }
      cause = cause.getCause();
    }
    return notFound;
  }

  private SecretsManagerException readFailure(String secretName, RuntimeException cause) {
    return new SecretsManagerException(
        String.format(
            "Unable to read secret [%s] from %s to determine whether it already exists: %s. "
                + "This is a read failure (e.g. missing read/decrypt permissions on the secret), "
                + "not a missing secret.",
            secretName, getSecretsManagerProvider().value(), exceptionMessage(cause)),
        cause);
  }

  abstract void storeSecret(String secretName, String secretValue);

  abstract void updateSecret(String secretName, String secretValue);

  protected abstract boolean isNotFoundException(Exception exception);

  /**
   * Blocks, if necessary, to keep <em>write</em> calls to the external backend within its API quota.
   * The limiter is shared across the process (the secrets manager is a singleton), so this is a
   * deployment-wide write rate, not per-thread. Call it before each create/update, not before reads.
   */
  protected void throttle() {
    rateLimiter.acquire();
  }

  public String cleanNullOrEmpty(String secretValue) {
    return isEmptySecret(secretValue) ? NULL_SECRET_STRING : secretValue;
  }

  private static boolean isEmptySecret(String secretValue) {
    return Objects.isNull(secretValue) || secretValue.isEmpty();
  }
}

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
    // check if value does not start with 'config:' only String can have password annotation
    if (Boolean.FALSE.equals(isSecret(value))) {
      if (store) {
        upsertSecret(fieldSecretId, value);
      }
      result = SECRET_FIELD_PREFIX + fieldSecretId;
    } else {
      result = value;
    }
    return result;
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
    return Objects.isNull(secretValue) || secretValue.isEmpty() ? NULL_SECRET_STRING : secretValue;
  }
}

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
import java.util.Objects;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.exception.SecretsManagerException;

public abstract class ExternalSecretsManager extends SecretsManager {
  public static final String NULL_SECRET_STRING = "null";

  /**
   * Default ceiling on calls to the external backend. Ten per second (one every ~100ms) keeps a
   * multi-field encrypt clear of the lowest write quota among the supported providers while staying
   * imperceptible for the common single-field case.
   */
  static final double DEFAULT_PERMITS_PER_SECOND = 10.0;

  private final SecretsManagerRateLimiter rateLimiter;

  protected ExternalSecretsManager(
      SecretsManagerProvider secretsManagerProvider, SecretsConfig secretsConfig) {
    this(
        secretsManagerProvider,
        secretsConfig,
        SecretsManagerRateLimiter.perSecond(DEFAULT_PERMITS_PER_SECOND));
  }

  @VisibleForTesting
  protected ExternalSecretsManager(
      SecretsManagerProvider secretsManagerProvider,
      SecretsConfig secretsConfig,
      SecretsManagerRateLimiter rateLimiter) {
    super(secretsManagerProvider, secretsConfig);
    this.rateLimiter = rateLimiter;
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
      throw storeFailure(secretName, e);
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

  private SecretsManagerException storeFailure(String secretName, RuntimeException cause) {
    return new SecretsManagerException(
        String.format(
            "Failed to store secret [%s] in %s: %s",
            secretName, getSecretsManagerProvider().value(), exceptionMessage(cause)),
        cause);
  }

  public boolean existSecret(String secretName) {
    boolean exists = false;
    throttle();
    try {
      exists = getSecret(secretName) != null;
    } catch (RuntimeException e) {
      if (!isNotFoundException(e)) {
        throw readFailure(secretName, e);
      }
    }
    return exists;
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

  /** Blocks, if necessary, to keep calls to the external backend within its API quota. */
  protected void throttle() {
    rateLimiter.acquire();
  }

  public String cleanNullOrEmpty(String secretValue) {
    return Objects.isNull(secretValue) || secretValue.isEmpty() ? NULL_SECRET_STRING : secretValue;
  }
}

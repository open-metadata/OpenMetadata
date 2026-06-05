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

import java.util.Locale;
import java.util.Objects;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.exception.UnhandledServerException;

public abstract class ExternalSecretsManager extends SecretsManager {
  public static final String NULL_SECRET_STRING = "null";
  private final long waitTimeBetweenStoreCalls;

  protected ExternalSecretsManager(
      SecretsManagerProvider secretsManagerProvider,
      SecretsConfig secretsConfig,
      long waitTimeBetweenCalls) {
    super(secretsManagerProvider, secretsConfig);
    waitTimeBetweenStoreCalls = waitTimeBetweenCalls;
  }

  @Override
  protected String storeValue(String fieldName, String value, String secretId, boolean store) {
    String fieldSecretId = buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT));
    // check if value does not start with 'config:' only String can have password annotation
    if (Boolean.FALSE.equals(isSecret(value))) {
      if (store) {
        upsertSecret(fieldSecretId, value);
      }
      return SECRET_FIELD_PREFIX + fieldSecretId;
    } else {
      return value;
    }
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

  private void storeOrUpdateSecret(String secretName, String secretValue) {
    if (existSecret(secretName)) {
      updateSecret(secretName, secretValue);
    } else {
      storeSecret(secretName, secretValue);
    }
    sleep();
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
    try {
      exists = getSecret(secretName) != null;
      sleep();
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

  private void sleep() {
    // delay reaching secrets manager quotas
    if (waitTimeBetweenStoreCalls > 0) {
      try {
        Thread.sleep(waitTimeBetweenStoreCalls);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new UnhandledServerException("Exception encountered", e);
      }
    }
  }

  public String cleanNullOrEmpty(String secretValue) {
    return Objects.isNull(secretValue) || secretValue.isEmpty() ? NULL_SECRET_STRING : secretValue;
  }
}

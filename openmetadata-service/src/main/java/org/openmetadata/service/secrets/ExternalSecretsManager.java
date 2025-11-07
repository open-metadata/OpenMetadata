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
        // If value is null, delete the secret instead of storing it
        if (value == null) {
          deleteSecretIfExists(fieldSecretId);
          return null;
        }
        upsertSecret(fieldSecretId, value);
      }
      return SECRET_FIELD_PREFIX + fieldSecretId;
    } else {
      return value;
    }
  }

  public void upsertSecret(String secretName, String secretValue) {
    // Don't store null secrets - delete them instead
    if (secretValue == null) {
      deleteSecretIfExists(secretName);
      return;
    }

    if (existSecret(secretName)) {
      updateSecret(secretName, secretValue);
      sleep();
    } else {
      storeSecret(secretName, secretValue);
      sleep();
    }
  }

  public boolean existSecret(String secretName) {
    try {
      boolean exists = getSecret(secretName) != null;
      sleep();
      return exists;
    } catch (Exception e) {
      return false;
    }
  }

  abstract void storeSecret(String secretName, String secretValue);

  abstract void updateSecret(String secretName, String secretValue);

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

  /**
   * Helper method to delete a secret if it exists. Used to clean up null secrets.
   */
  private void deleteSecretIfExists(String secretName) {
    try {
      if (existSecret(secretName)) {
        deleteSecretInternal(secretName);
        sleep();
      }
    } catch (Exception e) {
      // Ignore errors when deleting secrets that don't exist
    }
  }

  @Override
  public String getSecret(String secretName) {
    try {
      String secretValue = getSecretInternal(secretName);
      // Clean up existing null secrets: if we retrieve "null" string, delete it and return null
      if (NULL_SECRET_STRING.equals(secretValue)) {
        deleteSecretIfExists(secretName);
        return null;
      }
      return secretValue;
    } catch (Exception e) {
      return null;
    }
  }

  /**
   * Internal method to get the secret value from the secrets manager implementation.
   * Subclasses should implement this instead of overriding getSecret().
   */
  protected abstract String getSecretInternal(String secretName);
}

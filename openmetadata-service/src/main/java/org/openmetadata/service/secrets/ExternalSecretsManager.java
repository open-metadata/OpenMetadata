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
    // Issue #21259: a null/empty value means "no credential". Handle this case BEFORE
    // calling isSecret() — isSecret() invokes startsWith() on the value and would NPE
    // on null. Returning null here ensures the entity does not carry a stale secret:/
    // reference to a deleted secret.
    if (Objects.isNull(value) || value.isEmpty()) {
      if (store) {
        upsertSecret(fieldSecretId, value);
      }
      return null;
    }
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
    // Issue #21259: when the value is null/empty, the user's intent is "remove this
    // credential" — delete the backing secret instead of storing the literal string
    // "null". This also satisfies the GCP/Kubernetes empty-string rejection constraint
    // (PR #25224) by simply not calling upsert with an empty value.
    if (Objects.isNull(secretValue) || secretValue.isEmpty()) {
      if (existSecret(secretName)) {
        deleteSecretInternal(secretName);
        sleep();
      }
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
}

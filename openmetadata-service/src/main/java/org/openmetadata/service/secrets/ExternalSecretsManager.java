/*
 *  Copyright 2022 Collate
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
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;

public abstract class ExternalSecretsManager extends SecretsManager {
  public static final String NULL_SECRET_STRING = "null";
  public static final String SECRET_FIELD_PREFIX = "secret:";

  private final long WAIT_TIME_BETWEEN_STORE_CALLS;

  protected ExternalSecretsManager(
      SecretsManagerProvider secretsManagerProvider, String clusterPrefix, long waitTimeBetweenCalls) {
    super(secretsManagerProvider, clusterPrefix);
    WAIT_TIME_BETWEEN_STORE_CALLS = waitTimeBetweenCalls;
  }

  @Override
  protected String storeValue(String fieldName, String value, String secretId) {
    String fieldSecretId = buildSecretId(false, secretId, fieldName.toLowerCase(Locale.ROOT));
    // check if value does not start with 'config:' only String can have password annotation
    if (!value.startsWith(SECRET_FIELD_PREFIX)) {
      upsertSecret(fieldSecretId, value);
      return SECRET_FIELD_PREFIX + fieldSecretId;
    } else {
      return value;
    }
  }

  public void upsertSecret(String secretName, String secretValue) {
    if (existSecret(secretName)) {
      updateSecret(secretName, secretValue != null ? secretValue : NULL_SECRET_STRING);
      sleep();
    } else {
      storeSecret(secretName, secretValue != null ? secretValue : NULL_SECRET_STRING);
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

  abstract String getSecret(String secretName);

  private void sleep() {
    // delay reaching secrets manager quotas
    if (WAIT_TIME_BETWEEN_STORE_CALLS > 0) {
      try {
        Thread.sleep(WAIT_TIME_BETWEEN_STORE_CALLS);
      } catch (InterruptedException e) {
        throw new RuntimeException(e);
      }
    }
  }
}

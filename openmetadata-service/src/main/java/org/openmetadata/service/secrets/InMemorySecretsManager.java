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

import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.exception.SecretsManagerException;

/** Secret Manager used for testing */
public class InMemorySecretsManager extends ExternalSecretsManager {
  private static InMemorySecretsManager instance;
  @Getter private final Map<String, String> secretsMap = new HashMap<>();

  protected InMemorySecretsManager(SecretsConfig secretsConfig) {
    super(SecretsManagerProvider.IN_MEMORY, secretsConfig, SecretsManagerRateLimiter.noOp());
  }

  public static InMemorySecretsManager getInstance(SecretsConfig secretsConfig) {
    if (instance == null) {
      instance = new InMemorySecretsManager(secretsConfig);
    }
    return instance;
  }

  @Override
  void storeSecret(String secretName, String secretValue) {
    secretsMap.put(secretName, secretValue);
  }

  @Override
  void updateSecret(String secretName, String secretValue) {
    storeSecret(secretName, secretValue);
  }

  @Override
  protected void deleteSecretInternal(String secretName) {
    secretsMap.remove(secretName);
  }

  @Override
  String getSecret(String secretName) {
    String value = secretsMap.getOrDefault(secretName, null);
    if (value == null) {
      throw new KeyNotFoundException(
          String.format("Key [%s] not found in in-memory secrets manager", secretName));
    }
    return value;
  }

  @Override
  protected boolean isNotFoundException(Exception exception) {
    // Only a missing key is a not-found; a generic SecretsManagerException is a real failure and
    // must not be reclassified as "absent" (which would route it to the create path).
    return exception instanceof KeyNotFoundException;
  }

  private static class KeyNotFoundException extends SecretsManagerException {
    KeyNotFoundException(String message) {
      super(message);
    }
  }
}

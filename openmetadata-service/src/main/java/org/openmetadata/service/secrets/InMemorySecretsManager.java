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

  private static InMemorySecretsManager INSTANCE;

  @Getter private final Map<String, String> secretsMap = new HashMap<>();

  protected InMemorySecretsManager(String clusterPrefix) {
    super(SecretsManagerProvider.IN_MEMORY, clusterPrefix, 0);
  }

  public static InMemorySecretsManager getInstance(String clusterPrefix) {
    if (INSTANCE == null) INSTANCE = new InMemorySecretsManager(clusterPrefix);
    return INSTANCE;
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
  String getSecret(String secretName) {
    String value = secretsMap.getOrDefault(secretName, null);
    if (value == null) {
      throw new SecretsManagerException(String.format("Key [%s] not found in in-memory secrets manager", secretName));
    }
    return value;
  }
}

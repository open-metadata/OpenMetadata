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

import org.openmetadata.schema.security.secrets.SecretsManagerProvider;

public class DBSecretsManager extends SecretsManager {
  private static DBSecretsManager instance;

  private DBSecretsManager(SecretsManagerProvider secretsManagerProvider, SecretsConfig secretsConfig) {
    super(secretsManagerProvider, secretsConfig);
  }

  public static DBSecretsManager getInstance(SecretsConfig secretsConfig) {
    if (instance == null) {
      instance = new DBSecretsManager(SecretsManagerProvider.DB, secretsConfig);
    }
    return instance;
  }

  @Override
  protected String storeValue(String fieldName, String value, String secretId, boolean store) {
    return value;
  }

  // Nothing to delete on the Noop SM. We only delete on External SM
  @Override
  protected void deleteSecretInternal(String secretName) {}
}

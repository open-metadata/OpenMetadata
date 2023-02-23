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
import lombok.Getter;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;

public class SecretsManagerFactory {
  @Getter private static SecretsManager secretsManager;

  private SecretsManagerFactory() {}

  /** Expected to be called only once when the Application starts */
  public static SecretsManager createSecretsManager(SecretsManagerConfiguration config, String clusterName) {
    if (secretsManager != null) {
      return secretsManager;
    }
    SecretsManagerProvider secretsManagerProvider =
        config != null && config.getSecretsManager() != null
            ? config.getSecretsManager()
            : SecretsManagerConfiguration.DEFAULT_SECRET_MANAGER;
    switch (secretsManagerProvider) {
      case NOOP:
      case AWS_SSM:
      case AWS:
        secretsManager = NoopSecretsManager.getInstance(clusterName, secretsManagerProvider);
        break;
      case MANAGED_AWS:
        secretsManager = AWSSecretsManager.getInstance(config, clusterName);
        break;
      case MANAGED_AWS_SSM:
        secretsManager = AWSSSMSecretsManager.getInstance(config, clusterName);
        break;
      case IN_MEMORY:
        secretsManager = InMemorySecretsManager.getInstance(clusterName);
        break;
      default:
        throw new IllegalArgumentException("Not implemented secret manager store: " + secretsManagerProvider);
    }
    return secretsManager;
  }

  @VisibleForTesting
  public static void setSecretsManager(SecretsManager secretsManager) {
    SecretsManagerFactory.secretsManager = secretsManager;
  }
}

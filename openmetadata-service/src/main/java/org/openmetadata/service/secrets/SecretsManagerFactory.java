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
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;

public class SecretsManagerFactory {
  @Getter private static SecretsManager secretsManager;

  private SecretsManagerFactory() {}

  /** Expected to be called only once when the Application starts */
  public static SecretsManager createSecretsManager(
      SecretsManagerConfiguration config, String clusterName) {
    if (secretsManager != null) {
      return secretsManager;
    }
    SecretsManager.SecretsConfig secretsConfig =
        new SecretsManager.SecretsConfig(
            clusterName, config.getPrefix(), config.getTags(), config.getParameters());
    SecretsManagerProvider secretsManagerProvider =
        config.getSecretsManager() != null ? config.getSecretsManager() : SecretsManagerProvider.DB;

    switch (secretsManagerProvider) {
      case DB, AWS_SSM, AWS, AZURE_KV ->
      /*
      We handle AWS and AWS_SSM as a NoopSecretsManager since we don't
      need to WRITE any secrets. We will be just reading them out of the
      AWS instance on the INGESTION side, but the server does not need
      to do anything here.

      If for example we want to set the AWS SSM (non-managed) we configure
      the server as `secretsManager: aws-ssm` and set the Airflow env vars
      to connect to AWS SSM as specified in the docs:
      https://docs.open-metadata.org/deployment/secrets-manager/supported-implementations/aws-ssm-parameter-store
      */
      secretsManager = DBSecretsManager.getInstance(secretsConfig);
      case MANAGED_AWS -> secretsManager = AWSSecretsManager.getInstance(secretsConfig);
      case MANAGED_AWS_SSM -> secretsManager = AWSSSMSecretsManager.getInstance(secretsConfig);
      case IN_MEMORY -> secretsManager = InMemorySecretsManager.getInstance(secretsConfig);
      case MANAGED_AZURE_KV -> secretsManager = AzureKVSecretsManager.getInstance(secretsConfig);
      case GCP -> secretsManager = GCPSecretsManager.getInstance(secretsConfig);
      case KUBERNETES -> secretsManager = KubernetesSecretsManager.getInstance(secretsConfig);
    }
    return secretsManager;
  }

  @VisibleForTesting
  public static void setSecretsManager(SecretsManager secretsManager) {
    SecretsManagerFactory.secretsManager = secretsManager;
  }
}

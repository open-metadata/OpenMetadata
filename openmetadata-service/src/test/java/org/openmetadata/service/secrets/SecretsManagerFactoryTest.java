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

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;

public class SecretsManagerFactoryTest {

  private SecretsManagerConfiguration config;

  private static final String CLUSTER_NAME = "openmetadata";

  @BeforeEach
  void setUp() {
    config = new SecretsManagerConfiguration();
    SecretsManagerFactory.setSecretsManager(null);
  }

  @Test
  void testDefaultIsCreatedIfNullConfig() {
    assertInstanceOf(
        DBSecretsManager.class, SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME));
  }

  @Test
  void testDefaultIsCreatedIfMissingSecretManager() {
    assertInstanceOf(
        DBSecretsManager.class, SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME));
  }

  @Test
  void testIsCreatedIfLocalSecretsManager() {
    config.setSecretsManager(SecretsManagerProvider.DB);
    assertInstanceOf(
        DBSecretsManager.class, SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME));
  }

  @Test
  void testIsCreatedIfAWSSecretsManager() {
    initConfigForAWSBasedSecretManager(SecretsManagerProvider.AWS);
    assertInstanceOf(
        DBSecretsManager.class, SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME));
  }

  @Test
  void testIsCreatedIfManagedAWSSecretsManager() {
    initConfigForAWSBasedSecretManager(SecretsManagerProvider.MANAGED_AWS);
    assertInstanceOf(
        AWSSecretsManager.class, SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME));
  }

  @Test
  void testIsCreatedIfAWSSSMSecretsManager() {
    initConfigForAWSBasedSecretManager(SecretsManagerProvider.AWS_SSM);
    assertInstanceOf(
        DBSecretsManager.class, SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME));
  }

  @Test
  void testIsCreatedIfManagedAWSSSMSecretsManager() {
    initConfigForAWSBasedSecretManager(SecretsManagerProvider.MANAGED_AWS_SSM);
    assertInstanceOf(
        AWSSSMSecretsManager.class,
        SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME));
  }

  @Test
  void testIsCreatedIfGCPSecretsManager() {
    initConfigForAGCPSecretManager(SecretsManagerProvider.GCP);
    config.setSecretsManager(SecretsManagerProvider.GCP);
    Assertions.assertSame(
        SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME).getClass(),
        GCPSecretsManager.class);
  }

  private void initConfigForAWSBasedSecretManager(SecretsManagerProvider secretManagerProvider) {
    config.setSecretsManager(secretManagerProvider);
    Parameters parameters = new Parameters();
    config.setParameters(parameters);
    config.getParameters().setAdditionalProperty("region", "eu-west-1");
    config.getParameters().setAdditionalProperty("accessKeyId", "123456");
    config.getParameters().setAdditionalProperty("secretAccessKey", "654321");
  }

  private void initConfigForAGCPSecretManager(SecretsManagerProvider secretManagerProvider) {
    config.setSecretsManager(secretManagerProvider);
    Parameters parameters = new Parameters();
    config.setParameters(parameters);
    config.getParameters().setAdditionalProperty("projectId", "123456");
  }
}

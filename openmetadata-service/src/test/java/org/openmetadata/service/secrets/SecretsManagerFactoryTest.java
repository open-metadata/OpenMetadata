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

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;

public class SecretsManagerFactoryTest {

  private SecretsManagerConfiguration config;

  private static final String CLUSTER_NAME = "openmetadata";

  @BeforeEach
  void setUp() {
    config = new SecretsManagerConfiguration();
    config.setParameters(new HashMap<>());
    SecretsManagerFactory.setSecretsManager(null);
  }

  @Test
  void testDefaultIsCreatedIfNullConfig() {
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof NoopSecretsManager);
  }

  @Test
  void testDefaultIsCreatedIfMissingSecretManager() {
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof NoopSecretsManager);
  }

  @Test
  void testIsCreatedIfLocalSecretsManager() {
    config.setSecretsManager(SecretsManagerProvider.NOOP);
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof NoopSecretsManager);
  }

  @Test
  void testIsCreatedIfAWSSecretsManager() {
    initConfigForAWSBasedSecretManager(SecretsManagerProvider.AWS);
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof NoopSecretsManager);
  }

  @Test
  void testIsCreatedIfManagedAWSSecretsManager() {
    initConfigForAWSBasedSecretManager(SecretsManagerProvider.MANAGED_AWS);
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof AWSSecretsManager);
  }

  @Test
  void testIsCreatedIfAWSSSMSecretsManager() {
    initConfigForAWSBasedSecretManager(SecretsManagerProvider.AWS_SSM);
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof NoopSecretsManager);
  }

  @Test
  void testIsCreatedIfManagedAWSSSMSecretsManager() {
    initConfigForAWSBasedSecretManager(SecretsManagerProvider.MANAGED_AWS_SSM);
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof AWSSSMSecretsManager);
  }

  private void initConfigForAWSBasedSecretManager(SecretsManagerProvider secretManagerProvider) {
    config.setSecretsManager(secretManagerProvider);
    config.getParameters().put("region", "eu-west-1");
    config.getParameters().put("accessKeyId", "123456");
    config.getParameters().put("secretAccessKey", "654321");
  }
}

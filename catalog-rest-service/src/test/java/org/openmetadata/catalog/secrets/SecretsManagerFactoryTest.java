package org.openmetadata.catalog.secrets;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.SecretsManagerProvider;

public class SecretsManagerFactoryTest {

  private SecretsManagerConfiguration config;

  private static final String CLUSTER_NAME = "openmetadata";

  @BeforeEach
  void setUp() {
    config = new SecretsManagerConfiguration();
    config.setParameters(new HashMap<>());
  }

  @Test
  void testDefaultIsCreatedIfNullConfig() {
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof LocalSecretsManager);
  }

  @Test
  void testDefaultIsCreatedIfMissingSecretManager() {
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof LocalSecretsManager);
  }

  @Test
  void testIsCreatedIfLocalSecretsManager() {
    config.setSecretsManager(SecretsManagerProvider.LOCAL);
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof LocalSecretsManager);
  }

  @Test
  void testIsCreatedIfAWSSecretsManager() {
    config.setSecretsManager(SecretsManagerProvider.AWS);
    config.getParameters().put("region", "eu-west-1");
    config.getParameters().put("accessKeyId", "123456");
    config.getParameters().put("secretAccessKey", "654321");
    assertTrue(SecretsManagerFactory.createSecretsManager(config, CLUSTER_NAME) instanceof AWSSecretsManager);
  }
}

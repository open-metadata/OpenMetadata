package org.openmetadata.catalog.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class SecretsManagerFactoryTest {

  private SecretsManagerConfiguration config;

  @BeforeEach
  void setUp() {
    config = new SecretsManagerConfiguration();
    config.setParameters(new HashMap<>());
  }

  @Test
  void testDefaultIsCreatedIfNullConfig() {
    assertTrue(SecretsManagerFactory.createSecretManagerStore(config) instanceof LocalSecretsManager);
  }

  @Test
  void testDefaultIsCreatedIfMissingSecretManager() {
    assertTrue(SecretsManagerFactory.createSecretManagerStore(config) instanceof LocalSecretsManager);
  }

  @Test
  void testIsCreatedIfLocalSecretsManager() {
    config.setSecretsManager("LocalSecretsManager");
    assertTrue(SecretsManagerFactory.createSecretManagerStore(config) instanceof LocalSecretsManager);
  }

  @Test
  void testIsCreatedIfAWSSecretsManager() {
    config.setSecretsManager("AWSSecretsManager");
    config.getParameters().put("region", "eu-west-1");
    config.getParameters().put("accessKeyId", "123456");
    config.getParameters().put("secretAccessKey", "654321");
    assertTrue(SecretsManagerFactory.createSecretManagerStore(config) instanceof AWSSecretsManager);
  }

  @Test
  void testExceptionIfNotExists() {
    config.setSecretsManager("WrongSecretsManager");
    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> SecretsManagerFactory.createSecretManagerStore(config));
    assertEquals("Unknown secret manager store: WrongSecretsManager", exception.getMessage());
  }
}

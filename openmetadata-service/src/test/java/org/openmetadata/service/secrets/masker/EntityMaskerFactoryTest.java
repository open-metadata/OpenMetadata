package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.SecurityConfiguration;

public class EntityMaskerFactoryTest {

  SecurityConfiguration config;

  @BeforeEach
  void setUp() {
    config = new SecurityConfiguration();
    EntityMaskerFactory.setEntityMasker(null);
  }

  @AfterAll
  static void afterAll() {
    EntityMaskerFactory.setEntityMasker(null);
  }

  @Test
  void testInitWithNoopEntityMasker() {
    assertTrue(EntityMaskerFactory.createEntityMasker(config) instanceof NoopEntityMasker);
  }

  @Test
  void testInitWithPasswordEntityMasker() {
    config.setAlwaysMaskPasswordsUI(true);
    assertTrue(EntityMaskerFactory.createEntityMasker(config) instanceof PasswordEntityMasker);
  }
}

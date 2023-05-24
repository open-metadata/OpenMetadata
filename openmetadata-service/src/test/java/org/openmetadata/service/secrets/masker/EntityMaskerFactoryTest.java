package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.SecurityConfiguration;

public class EntityMaskerFactoryTest {
  private static final SecurityConfiguration CONFIG = new SecurityConfiguration();

  @BeforeEach
  void setUp() {
    EntityMaskerFactory.setEntityMasker(null);
  }

  @AfterAll
  static void afterAll() {
    EntityMaskerFactory.setEntityMasker(null);
  }

  @Test
  void testInitWithNoopEntityMasker() {
    CONFIG.setMaskPasswordsAPI(false);
    assertTrue(EntityMaskerFactory.createEntityMasker(CONFIG) instanceof NoopEntityMasker);
  }

  @Test
  void testInitWithPasswordEntityMasker() {
    CONFIG.setMaskPasswordsAPI(true);
    assertTrue(EntityMaskerFactory.createEntityMasker(CONFIG) instanceof PasswordEntityMasker);
  }
}

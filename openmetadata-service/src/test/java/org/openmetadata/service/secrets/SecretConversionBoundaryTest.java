package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;

class SecretConversionBoundaryTest {
  private DBSecretsManager manager;

  @BeforeEach
  void configureSecretsManager() {
    Fernet.getInstance().setFernetKey("GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=");
    manager =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    manager.setFernet(Fernet.getInstance());
  }

  @Test
  void incompleteStoredCredentialStaysReadableAndMasked() {
    Object masked =
        EntityMaskerFactory.createEntityMasker()
            .maskServiceConnectionConfig(
                nats(Map.of("password", "stored-secret", "obsolete", true)),
                "Nats",
                ServiceType.MESSAGING);
    assertEquals(PASSWORD_MASK, JsonUtils.valueToTree(masked).at("/authType/password").asText());
    assertTrue(JsonUtils.valueToTree(masked).at("/authType/obsolete").asBoolean());
    assertFalse(JsonUtils.pojoToJson(masked).contains("stored-secret"));
  }

  @Test
  void newCredentialRejectsUnknownFieldsEvenWhenRequiredFieldsExist() {
    InvalidServiceConnectionException error =
        assertThrows(
            InvalidServiceConnectionException.class,
            () ->
                manager.encryptServiceConnectionConfig(
                    nats(Map.of("username", "u", "password", "secret", "obsolete", "typo")),
                    "Nats",
                    "nats",
                    ServiceType.MESSAGING));
    assertTrue(error.getMessage().contains("obsolete"), error.getMessage());
  }

  @Test
  void decryptingStoredCredentialPreservesObsoleteFields() {
    Object decrypted =
        manager.decryptServiceConnectionConfig(
            nats(
                Map.of(
                    "username",
                    "u",
                    "password",
                    Fernet.getInstance().encrypt("secret"),
                    "obsolete",
                    true)),
            "Nats",
            ServiceType.MESSAGING);
    assertEquals("secret", JsonUtils.valueToTree(decrypted).at("/authType/password").asText());
    assertTrue(JsonUtils.valueToTree(decrypted).at("/authType/obsolete").asBoolean());
  }

  private static Map<String, Object> nats(Map<String, Object> auth) {
    return Map.of("type", "Nats", "natsServers", "nats://localhost:4222", "authType", auth);
  }
}

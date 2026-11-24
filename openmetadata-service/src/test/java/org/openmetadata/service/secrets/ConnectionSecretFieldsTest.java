package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

class ConnectionSecretFieldsTest {
  record ConnectionField(String type, ServiceType serviceType, String field, String value) {
    Map<String, String> config(final String secret) {
      return Map.of("type", type, field, secret);
    }

    String valueOf(final Object config) {
      return JsonUtils.valueToTree(config).path(field).asText();
    }
  }

  static Stream<ConnectionField> fields() {
    return Stream.of(
        new ConnectionField(
            "Mlflow",
            ServiceType.ML_MODEL,
            "registryUri",
            "mysql+pymysql://user:password@localhost/demo_db"),
        new ConnectionField("Mlflow", ServiceType.ML_MODEL, "registryUri", "http://localhost:5000"),
        new ConnectionField("Teradata", ServiceType.DATABASE, "logdata", "demo.jwt/token+value="),
        new ConnectionField("Teradata", ServiceType.DATABASE, "logdata", "EXAMPLE.REALM"));
  }

  @BeforeEach
  void configureFernet() {
    Fernet.getInstance().setFernetKey("GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=");
  }

  @ParameterizedTest
  @MethodSource("fields")
  void masksAndPreservesMaskedUpdates(final ConnectionField field) {
    final var masker = EntityMaskerFactory.createEntityMasker();
    final Object original = field.config(field.value());
    final Object masked =
        masker.maskServiceConnectionConfig(original, field.type(), field.serviceType());
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, field.valueOf(masked));
    final Object restored =
        masker.unmaskServiceConnectionConfig(masked, original, field.type(), field.serviceType());
    assertEquals(field.value(), field.valueOf(restored));
    final Object replacement =
        masker.unmaskServiceConnectionConfig(
            field.config("replacement"), original, field.type(), field.serviceType());
    assertEquals("replacement", field.valueOf(replacement));
  }

  @ParameterizedTest
  @MethodSource("fields")
  void encryptsLegacyPlaintextAndDecryptsWithoutChangingIt(final ConnectionField field) {
    final var manager = DBSecretsManager.getInstance(SecretsManagerProvider.DB, config());
    manager.setFernet(Fernet.getInstance());
    final Object encrypted =
        manager.encryptServiceConnectionConfig(
            field.config(field.value()), field.type(), "my_service", field.serviceType());
    assertTrue(Fernet.isTokenized(field.valueOf(encrypted)));
    assertEquals(field.value(), Fernet.getInstance().decrypt(field.valueOf(encrypted)));
    final Object decrypted =
        manager.decryptServiceConnectionConfig(encrypted, field.type(), field.serviceType());
    assertEquals(field.value(), field.valueOf(decrypted));
  }

  @ParameterizedTest
  @MethodSource("fields")
  void storesWholeValueInManagedSecretsAndPreservesReferences(final ConnectionField field) {
    final var manager = new InMemorySecretsManager(config());
    final Object encrypted =
        manager.encryptServiceConnectionConfig(
            field.config(field.value()), field.type(), "my_service", field.serviceType());
    final Object decrypted =
        manager.decryptServiceConnectionConfig(encrypted, field.type(), field.serviceType());
    final String reference = field.valueOf(decrypted);
    assertTrue(reference.startsWith("secret:"));
    assertEquals(field.value(), manager.getSecretValue(reference));
    assertFalse(JsonUtils.pojoToJson(encrypted).contains(field.value()));
    final Object resaved =
        manager.encryptServiceConnectionConfig(
            decrypted, field.type(), "my_service", field.serviceType());
    assertEquals(
        reference,
        field.valueOf(
            manager.decryptServiceConnectionConfig(resaved, field.type(), field.serviceType())));
    assertEquals(1, manager.getSecretsMap().size());
    final Object cleared =
        manager.encryptServiceConnectionConfig(
            field.config(""), field.type(), "my_service", field.serviceType());
    assertNull(JsonUtils.valueToTree(cleared).get(field.field()));
    assertTrue(manager.getSecretsMap().isEmpty());
  }

  private static SecretsManager.SecretsConfig config() {
    return new SecretsManager.SecretsConfig("openmetadata", "", List.of(), null);
  }
}

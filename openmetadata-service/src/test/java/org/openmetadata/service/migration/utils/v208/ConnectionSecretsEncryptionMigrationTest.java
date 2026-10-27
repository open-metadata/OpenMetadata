package org.openmetadata.service.migration.utils.v208;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

class ConnectionSecretsEncryptionMigrationTest {
  @BeforeEach
  void configureFernet() {
    Fernet.getInstance().setFernetKey("GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=");
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "mysql+pymysql://user:password@localhost/demo_db",
        "http://localhost:5000",
        "secret:/my_registry",
        ""
      })
  void encryptsWholeRegistryValueAndIsIdempotent(String value) {
    String original = stored("Mlflow", "registryUri", value);
    String encrypted = ConnectionSecretsEncryptionMigration.encrypted(original);
    var node = JsonUtils.readTree(encrypted);
    String token = node.at("/connection/config/registryUri").asText();
    assertTrue(Fernet.isTokenized(token));
    assertEquals(value, Fernet.getInstance().decrypt(token));
    assertEquals(encrypted, ConnectionSecretsEncryptionMigration.encrypted(encrypted));
    assertEquals("description", node.path("description").asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"demo.jwt/token+value=", "EXAMPLE.REALM"})
  void encryptsLogdataRegardlessOfLogonMechanism(String value) {
    String encrypted =
        ConnectionSecretsEncryptionMigration.encrypted(stored("Teradata", "logdata", value));
    assertEquals(
        value,
        Fernet.getInstance()
            .decrypt(JsonUtils.readTree(encrypted).at("/connection/config/logdata").asText()));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{}",
        "{\"connection\":{\"config\":{\"type\":\"Teradata\",\"logdata\":null}}}",
        "{\"connection\":{\"config\":{\"type\":\"Mlflow\"}}}"
      })
  void preservesAbsentValues(String json) {
    assertEquals(json, ConnectionSecretsEncryptionMigration.encrypted(json));
  }

  @ParameterizedTest
  @ValueSource(strings = {"Mlflow", "Teradata"})
  void refusesToLeavePlaintextWhenEncryptionIsUnavailable(String type) {
    Fernet.getInstance().setFernetKey((String) null);
    try {
      assertThrows(
          IllegalArgumentException.class,
          () ->
              ConnectionSecretsEncryptionMigration.encrypted(
                  stored(type, type.equals("Mlflow") ? "registryUri" : "logdata", "demo-secret")));
    } finally {
      configureFernet();
    }
  }

  private String stored(String type, String field, String value) {
    return JsonUtils.pojoToJson(
        Map.of(
            "description",
            "description",
            "connection",
            Map.of("config", Map.of("type", type, field, value))));
  }
}

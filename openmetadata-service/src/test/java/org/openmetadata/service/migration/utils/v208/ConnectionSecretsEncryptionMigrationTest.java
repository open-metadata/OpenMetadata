package org.openmetadata.service.migration.utils.v208;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
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
        "mysql+pymysql://user:p%40ss%2Fword@localhost/demo_db?option=a%26b",
        "quotes\" backslash\\ unicode λ日本語 🔑",
        " \t\n ",
        ""
      })
  void encryptsWholeRegistryValueAndIsIdempotent(final String value) {
    final String original = stored("Mlflow", "registryUri", value);
    final String encrypted = ConnectionSecretsEncryptionMigration.encrypted(original);
    final var node = JsonUtils.readTree(encrypted);
    final String token = node.at("/connection/config/registryUri").asText();
    assertTrue(Fernet.isTokenized(token));
    assertEquals(value, Fernet.getInstance().decrypt(token));
    assertEquals(encrypted, ConnectionSecretsEncryptionMigration.encrypted(encrypted));
    assertEquals("description", node.path("description").asText());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "demo.jwt/token+value=",
        "EXAMPLE.REALM",
        "",
        " \t\n ",
        "CN=demo,OU=example",
        "quotes\" backslash\\ unicode λ日本語 🔑"
      })
  void encryptsLogdataRegardlessOfLogonMechanism(final String value) {
    final String encrypted =
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
  void preservesAbsentValues(final String json) {
    assertEquals(json, ConnectionSecretsEncryptionMigration.encrypted(json));
  }

  @ParameterizedTest
  @MethodSource("unchangedValues")
  void preservesUnrelatedConnectorsAndNonStringValues(final String json) {
    assertEquals(json, ConnectionSecretsEncryptionMigration.encrypted(json));
  }

  static Stream<String> unchangedValues() {
    final Stream<String> shapes =
        Stream.of("null", "false", "0", "[]", "{}", "\"text\"")
            .flatMap(
                value ->
                    Stream.of(
                        value,
                        "{\"connection\":" + value + "}",
                        "{\"connection\":{\"config\":" + value + "}}"));
    final Stream<String> types =
        Stream.of(
                "null",
                "false",
                "0",
                "[]",
                "{}",
                "\"Postgres\"",
                "\"CustomDatabase\"",
                "\"mlflow\"",
                "\"TERADATA\"",
                "\"Mlflow \"")
            .map(
                type ->
                    "{\"connection\":{\"config\":{\"type\":"
                        + type
                        + ",\"registryUri\":\"unchanged\",\"logdata\":\"unchanged\"}}}");
    final Stream<String> fields =
        Stream.of(
                "null",
                "false",
                "true",
                "0",
                "42",
                "1.25",
                "[]",
                "[\"value\"]",
                "{}",
                "{\"value\":\"text\"}")
            .flatMap(
                value ->
                    Stream.of(
                        "{\"connection\":{\"config\":{\"type\":\"Mlflow\",\"registryUri\":"
                            + value
                            + "}}}",
                        "{\"connection\":{\"config\":{\"type\":\"Teradata\",\"logdata\":"
                            + value
                            + "}}}"));
    return Stream.of(shapes, types, fields).flatMap(stream -> stream);
  }

  @ParameterizedTest
  @ValueSource(strings = {"Mlflow", "Teradata"})
  void preservesExistingCiphertextWithoutNeedingItsKey(final String type) {
    final String field = type.equals("Mlflow") ? "registryUri" : "logdata";
    final String original = stored(type, field, Fernet.getInstance().encrypt("stored-value"));
    Fernet.getInstance().setFernetKey((String) null);
    try {
      assertEquals(original, ConnectionSecretsEncryptionMigration.encrypted(original));
    } finally {
      configureFernet();
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"Mlflow", "Teradata"})
  void roundTripsLongValues(final String type) {
    final String field = type.equals("Mlflow") ? "registryUri" : "logdata";
    final String value = "λ/demo+value=".repeat(5000);
    final String encrypted =
        ConnectionSecretsEncryptionMigration.encrypted(stored(type, field, value));
    assertEquals(
        value,
        Fernet.getInstance()
            .decrypt(JsonUtils.readTree(encrypted).at("/connection/config/" + field).asText()));
  }

  @ParameterizedTest
  @ValueSource(strings = {"Mlflow", "Teradata"})
  void individualFieldEncryptionRequiresAKey(final String type) {
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

  private String stored(final String type, final String field, final String value) {
    return JsonUtils.pojoToJson(
        Map.of(
            "description",
            "description",
            "connection",
            Map.of("config", Map.of("type", type, field, value))));
  }
}

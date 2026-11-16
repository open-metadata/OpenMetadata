package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.exception.InvalidServiceConnectionException;

class SecretsUtilSslConfigTest {

  private static Object convert(String connectionType, Map<String, Object> config) {
    return SecretsUtil.convert(config, connectionType, "svc", ServiceType.DATABASE);
  }

  @Test
  void rejectsSslConfigFieldOutsideTheSchema() {
    Object mysql =
        convert(
            "Mysql",
            Map.of(
                "hostPort", "db:3306", "username", "u", "sslConfig", Map.of("sslMode", "require")));

    InvalidServiceConnectionException e =
        assertThrows(
            InvalidServiceConnectionException.class,
            () -> SecretsUtil.validateSslConfig(mysql, "Mysql"));
    assertEquals(
        "Invalid sslConfig for 'Mysql' connection: unrecognized field 'sslMode'. Supported fields"
            + " are caCertificate, sslCertificate and sslKey.",
        e.getMessage());
  }

  @Test
  void acceptsValidSslConfigTypedByTheConverter() {
    Object mysql =
        convert(
            "Mysql",
            Map.of(
                "hostPort",
                "db:3306",
                "username",
                "u",
                "sslConfig",
                Map.of("caCertificate", "pem")));

    assertDoesNotThrow(() -> SecretsUtil.validateSslConfig(mysql, "Mysql"));
  }

  @Test
  void checksSslConfigOfConnectionsWithoutAConverter() {
    Object valid =
        convert(
            "MongoDB", Map.of("hostPort", "db:27017", "sslConfig", Map.of("caCertificate", "pem")));
    Object invalid =
        convert("MongoDB", Map.of("hostPort", "db:27017", "sslConfig", Map.of("sslMode", "x")));

    assertDoesNotThrow(() -> SecretsUtil.validateSslConfig(valid, "MongoDB"));
    assertThrows(
        InvalidServiceConnectionException.class,
        () -> SecretsUtil.validateSslConfig(invalid, "MongoDB"));
  }

  @Test
  void ignoresConnectionsWithoutSslConfig() {
    Object snowflake =
        convert("Snowflake", Map.of("account", "acc", "username", "u", "warehouse", "wh"));

    assertDoesNotThrow(() -> SecretsUtil.validateSslConfig(snowflake, "Snowflake"));
  }
}

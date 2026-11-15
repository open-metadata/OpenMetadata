package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;

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

  @Test
  void rejectsMixedSslFieldsBeforeConversionDropsTheUnknownField() {
    Map<String, Object> config =
        Map.of("sslConfig", Map.of("sslKey", "key-pem", "sslMode", "require"));
    assertThrows(
        InvalidServiceConnectionException.class,
        () -> SecretsUtil.validateSslConfig(config, "Mysql", ServiceType.DATABASE));
  }

  @Test
  void rejectsMixedSslFieldsBeforeRestoringMaskedSecrets() {
    Map<String, Object> config =
        Map.of("sslConfig", Map.of("sslKey", PASSWORD_MASK, "sslMode", "require"));
    Map<String, Object> stored = Map.of("sslConfig", Map.of("sslKey", "key-pem"));
    assertThrows(
        InvalidServiceConnectionException.class,
        () ->
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(config, stored, "Mysql", ServiceType.DATABASE));
  }

  @Test
  void legacySslFieldsStayReadableAndDeclaredSecretsStayMasked() {
    MysqlConnection unknownOnly =
        (MysqlConnection)
            SecretsUtil.convert(
                Map.of("sslConfig", Map.of("sslMode", "require")),
                "Mysql",
                null,
                ServiceType.DATABASE);
    assertEquals(Map.of("sslMode", "require"), unknownOnly.getSslConfig());
    Object masked =
        EntityMaskerFactory.createEntityMasker()
            .maskServiceConnectionConfig(
                Map.of("sslConfig", Map.of("sslKey", "key-pem", "sslMode", "require")),
                "Mysql",
                ServiceType.DATABASE);
    MysqlConnection mysql = JsonUtils.convertValue(masked, MysqlConnection.class);
    assertEquals(
        PASSWORD_MASK,
        JsonUtils.convertValue(mysql.getSslConfig(), ValidateSSLClientConfig.class).getSslKey());
  }

  @ParameterizedTest
  @ValueSource(strings = {"ElasticSearch", "OpenSearch"})
  void preservesTheSearchConnectionsDifferentSslSchema(String connectionType) {
    assertDoesNotThrow(
        () ->
            SecretsUtil.validateSslConfig(
                Map.of("sslConfig", Map.of("certificates", Map.of("caCertPath", "/ca.pem"))),
                connectionType,
                ServiceType.SEARCH));
  }
}

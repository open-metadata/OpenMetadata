package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.services.ServiceType;
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
    MysqlConnection mysql = new MysqlConnection().withSslConfig(Map.of("sslMode", "require"));

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
  void checksSslConfigBeforeAndAfterConnectionConversion() {
    Object valid =
        convert(
            "MongoDB", Map.of("hostPort", "db:27017", "sslConfig", Map.of("caCertificate", "pem")));
    Map<String, Object> invalid =
        Map.of("hostPort", "db:27017", "sslConfig", Map.of("sslMode", "x"));

    assertDoesNotThrow(() -> SecretsUtil.validateSslConfig(valid, "MongoDB"));
    assertThrows(
        InvalidServiceConnectionException.class,
        () -> SecretsUtil.validateSslConfig(invalid, "MongoDB", ServiceType.DATABASE));
    assertThrows(InvalidServiceConnectionException.class, () -> convert("MongoDB", invalid));
  }

  @Test
  void ignoresConnectionsWithoutSslConfig() {
    Object snowflake =
        convert("Snowflake", Map.of("account", "acc", "username", "u", "warehouse", "wh"));

    assertDoesNotThrow(() -> SecretsUtil.validateSslConfig(snowflake, "Snowflake"));
  }

  @Test
  void rejectsMixedSslFieldsBeforeConversion() {
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
    Object unknownOnly =
        SecretsUtil.convertForRead(
            Map.of("sslConfig", Map.of("sslMode", "require")), "Mysql", ServiceType.DATABASE);
    assertEquals("require", JsonUtils.valueToTree(unknownOnly).at("/sslConfig/sslMode").asText());
    Object masked =
        EntityMaskerFactory.createEntityMasker()
            .maskServiceConnectionConfig(
                Map.of("sslConfig", Map.of("sslKey", "key-pem", "sslMode", "require")),
                "Mysql",
                ServiceType.DATABASE);
    assertEquals(PASSWORD_MASK, JsonUtils.valueToTree(masked).at("/sslConfig/sslKey").asText());
    assertEquals("require", JsonUtils.valueToTree(masked).at("/sslConfig/sslMode").asText());
    assertFalse(JsonUtils.pojoToJson(masked).contains("key-pem"));
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

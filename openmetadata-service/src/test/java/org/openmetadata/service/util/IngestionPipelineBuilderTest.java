/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.macasaet.fernet.Key;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.ServiceConnections;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtHttpConfig;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataS3Config;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.database.DatabricksConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.services.connections.database.databricks.PersonalAccessToken;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.DBSecretsManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

class IngestionPipelineBuilderTest {
  private static final String SECRET = "manifest-secret";
  private static final String DATABASE_PASSWORD = "suite-database-password";
  private static final String DATABRICKS_TOKEN = "suite-databricks-token";
  private static final String DBT_CA_CERTIFICATE = "dbt-ca-certificate";
  private static final String DBT_CLIENT_CERTIFICATE = "dbt-client-certificate";
  private static final String DBT_CLIENT_KEY = "dbt-client-key";
  private static final String FERNET_KEY = "mFNuF9gyyS4zNItmwvFq8wAf9TUFnNwj6m6pW1P5RjE=";

  private List<Key> originalFernetKeys;

  @BeforeEach
  void createMasker() {
    EntityMaskerFactory.setEntityMasker(null);
    EntityMaskerFactory.createEntityMasker();
    originalFernetKeys = Fernet.getInstance().getCachedKeys();
    Fernet.getInstance().setFernetKey(FERNET_KEY);
  }

  @AfterEach
  void resetMasker() {
    EntityMaskerFactory.setEntityMasker(null);
    Fernet.getInstance()
        .setFernetKey(
            originalFernetKeys == null
                ? null
                : originalFernetKeys.stream().map(Key::serialise).collect(Collectors.joining(",")));
  }

  /** A manifest source no source schema matches would keep its credentials out of reach. */
  @Test
  void aManifestMatchingNoSourceSchemaIsRefusedWhenWritten() {
    IngestionPipeline pipeline = storagePipeline(manifestSource(true));

    assertThrows(
        BadRequestException.class, () -> IngestionPipelineBuilder.addDefinedConfig(pipeline));
  }

  /** Stored before the check, such a source is left out of what is read rather than returned. */
  @Test
  void aStoredManifestMatchingNoSourceSchemaIsReadWithoutItsCredentials() {
    IngestionPipeline pipeline = storagePipeline(manifestSource(true));

    EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(pipeline);

    assertFalse(JsonUtils.pojoToJson(pipeline).contains(SECRET));
  }

  @Test
  void aManifestMatchingASourceSchemaIsTyped() {
    IngestionPipeline pipeline = storagePipeline(manifestSource(false));

    IngestionPipelineBuilder.addDefinedConfig(pipeline);

    StorageServiceMetadataPipeline config =
        assertInstanceOf(
            StorageServiceMetadataPipeline.class, pipeline.getSourceConfig().getConfig());
    assertInstanceOf(StorageMetadataS3Config.class, config.getStorageMetadataConfigSource());
  }

  /** Typed once by the resource and again by the repository, a config must stay typed. */
  @Test
  void testSuiteConnectionsAreTypedByTheirConnectionType() {
    IngestionPipeline pipeline = testSuitePipeline(mysqlConnection(), databricksConnection());

    IngestionPipelineBuilder.addDefinedConfig(pipeline);
    IngestionPipelineBuilder.addDefinedConfig(pipeline);

    TestSuitePipeline config =
        assertInstanceOf(TestSuitePipeline.class, pipeline.getSourceConfig().getConfig());
    MysqlConnection mysql =
        assertInstanceOf(
            MysqlConnection.class, connectionConfig(config.getServiceConnections().getFirst()));
    assertInstanceOf(basicAuth.class, mysql.getAuthType());
    DatabricksConnection databricks =
        assertInstanceOf(
            DatabricksConnection.class, connectionConfig(config.getServiceConnections().getLast()));
    assertInstanceOf(PersonalAccessToken.class, databricks.getAuthType());
  }

  @Test
  void testSuiteConnectionSecretsAreEncryptedMaskedAndDecrypted() {
    SecretsManager secretsManager = dbSecretsManager();
    IngestionPipeline pipeline = testSuitePipeline(mysqlConnection(), databricksConnection());

    secretsManager.encryptIngestionPipeline(pipeline);
    String stored = JsonUtils.pojoToJson(pipeline);
    IngestionPipeline masked = JsonUtils.readValue(stored, IngestionPipeline.class);
    EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(masked);
    IngestionPipeline decrypted = JsonUtils.readValue(stored, IngestionPipeline.class);
    secretsManager.decryptIngestionPipeline(decrypted);

    assertHoldsNoSecret(stored);
    assertTrue(stored.contains(Fernet.FERNET_PREFIX), stored);
    String maskedJson = JsonUtils.pojoToJson(masked);
    assertHoldsNoSecret(maskedJson);
    assertFalse(maskedJson.contains(Fernet.FERNET_PREFIX), maskedJson);
    assertTrue(maskedJson.contains(PasswordEntityMasker.PASSWORD_MASK), maskedJson);
    String decryptedJson = JsonUtils.pojoToJson(decrypted);
    assertTrue(decryptedJson.contains(DATABASE_PASSWORD), decryptedJson);
    assertTrue(decryptedJson.contains(DATABRICKS_TOKEN), decryptedJson);
  }

  /** Removing or reordering connections must restore each service's own secret by serviceName. */
  @Test
  void removingOrReorderingTestSuiteConnectionsRestoresEachServicesOwnSecret() {
    final SecretsManager secretsManager = dbSecretsManager();
    final IngestionPipeline pipeline = testSuitePipeline(mysqlConnection(), databricksConnection());
    secretsManager.encryptIngestionPipeline(pipeline);
    final String stored = JsonUtils.pojoToJson(pipeline);

    final IngestionPipeline trimmed = JsonUtils.readValue(stored, IngestionPipeline.class);
    EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(trimmed);
    final TestSuitePipeline trimmedConfig =
        (TestSuitePipeline) trimmed.getSourceConfig().getConfig();
    trimmedConfig.setServiceConnections(List.of(trimmedConfig.getServiceConnections().getLast()));
    EntityMaskerFactory.getEntityMasker()
        .unmaskIngestionPipeline(trimmed, JsonUtils.readValue(stored, IngestionPipeline.class));
    secretsManager.decryptIngestionPipeline(trimmed);

    final String trimmedJson = JsonUtils.pojoToJson(trimmed);
    assertFalse(trimmedJson.contains(DATABASE_PASSWORD), trimmedJson);
    assertTrue(trimmedJson.contains(DATABRICKS_TOKEN), trimmedJson);
  }

  @Test
  void aTestSuiteConnectionOfNoKnownTypeIsRefusedWhenWritten() {
    IngestionPipeline pipeline = testSuitePipeline(unknownConnection());

    assertThrows(
        BadRequestException.class, () -> IngestionPipelineBuilder.addDefinedConfig(pipeline));
  }

  @Test
  void aTestSuiteConnectionMatchingNoSchemaIsRefusedWhenWritten() {
    Map<String, Object> connection = mysqlConnection();
    configOf(connection).put("notInTheMysqlSchema", "x");
    IngestionPipeline pipeline = testSuitePipeline(connection);

    assertThrows(
        BadRequestException.class, () -> IngestionPipelineBuilder.addDefinedConfig(pipeline));
  }

  /** The refusal names the connection, never the value that was sent in its place. */
  @Test
  void aTestSuiteConnectionThatIsNotAnObjectIsRefusedWithoutQuotingIt() {
    Map<String, Object> connection = new HashMap<>();
    connection.put("serviceName", "plain_service");
    connection.put("serviceConnection", DATABASE_PASSWORD);
    IngestionPipeline pipeline = testSuitePipeline(connection);

    BadRequestException refused =
        assertThrows(
            BadRequestException.class, () -> IngestionPipelineBuilder.addDefinedConfig(pipeline));
    assertFalse(refused.getMessage().contains(DATABASE_PASSWORD), refused.getMessage());
  }

  /** Stored before the check, such connections are left out of what is read rather than returned. */
  @Test
  void aStoredTestSuiteConnectionOfNoKnownTypeIsReadWithoutItsConnections() {
    IngestionPipeline pipeline = testSuitePipeline(mysqlConnection(), unknownConnection());

    EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(pipeline);

    assertHoldsNoSecret(JsonUtils.pojoToJson(pipeline));
  }

  @Test
  void dbtHttpSslConfigIsTyped() {
    IngestionPipeline pipeline = dbtHttpPipeline();

    IngestionPipelineBuilder.addDefinedConfig(pipeline);

    DbtPipeline config =
        assertInstanceOf(DbtPipeline.class, pipeline.getSourceConfig().getConfig());
    DbtHttpConfig source = assertInstanceOf(DbtHttpConfig.class, config.getDbtConfigSource());
    assertInstanceOf(ValidateSSLClientConfig.class, source.getDbtSSLConfig());
  }

  @Test
  void dbtHttpSslSecretsAreEncryptedMaskedDecryptedAndRestored() {
    SecretsManager secretsManager = dbSecretsManager();
    IngestionPipeline pipeline = dbtHttpPipeline();

    secretsManager.encryptIngestionPipeline(pipeline);
    String stored = JsonUtils.pojoToJson(pipeline);
    IngestionPipeline masked = JsonUtils.readValue(stored, IngestionPipeline.class);
    EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(masked);
    String maskedJson = JsonUtils.pojoToJson(masked);
    IngestionPipeline decrypted = JsonUtils.readValue(stored, IngestionPipeline.class);
    secretsManager.decryptIngestionPipeline(decrypted);
    IngestionPipeline storedAgain = JsonUtils.readValue(stored, IngestionPipeline.class);
    EntityMaskerFactory.getEntityMasker().unmaskIngestionPipeline(masked, storedAgain);
    secretsManager.decryptIngestionPipeline(masked);

    assertHoldsNoDbtSslSecret(stored);
    assertTrue(stored.contains(Fernet.FERNET_PREFIX), stored);
    assertHoldsNoDbtSslSecret(maskedJson);
    assertFalse(maskedJson.contains(Fernet.FERNET_PREFIX), maskedJson);
    assertTrue(maskedJson.contains(PasswordEntityMasker.PASSWORD_MASK), maskedJson);
    assertEquals(dbtSslConfig(), dbtSslConfig(decrypted));
    assertEquals(dbtSslConfig(), dbtSslConfig(masked));
  }

  private static SecretsManager dbSecretsManager() {
    return DBSecretsManager.getInstance(
        SecretsManagerProvider.DB,
        new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
  }

  private static void assertHoldsNoDbtSslSecret(String json) {
    assertFalse(json.contains(DBT_CA_CERTIFICATE), json);
    assertFalse(json.contains(DBT_CLIENT_CERTIFICATE), json);
    assertFalse(json.contains(DBT_CLIENT_KEY), json);
  }

  private static IngestionPipeline dbtHttpPipeline() {
    Map<String, Object> source = new HashMap<>();
    source.put("dbtConfigType", "http");
    source.put("dbtManifestHttpPath", "https://dbt.example.com/manifest.json");
    source.put("dbtVerifySSL", "validate");
    source.put("dbtSSLConfig", dbtSslConfig());
    Map<String, Object> config = new HashMap<>();
    config.put("type", "DBT");
    config.put("dbtConfigSource", source);
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("dbt_http")
        .withPipelineType(PipelineType.DBT)
        .withSourceConfig(new SourceConfig().withConfig(config));
  }

  private static Map<String, Object> dbtSslConfig() {
    return Map.of(
        "caCertificate", DBT_CA_CERTIFICATE,
        "sslCertificate", DBT_CLIENT_CERTIFICATE,
        "sslKey", DBT_CLIENT_KEY);
  }

  private static Map<String, Object> dbtSslConfig(IngestionPipeline pipeline) {
    Map<String, Object> config = JsonUtils.getMap(pipeline.getSourceConfig().getConfig());
    Map<String, Object> source = JsonUtils.getMap(config.get("dbtConfigSource"));
    return JsonUtils.getMap(source.get("dbtSSLConfig"));
  }

  private static void assertHoldsNoSecret(String json) {
    assertFalse(json.contains(DATABASE_PASSWORD), json);
    assertFalse(json.contains(DATABRICKS_TOKEN), json);
  }

  private static Object connectionConfig(ServiceConnections serviceConnections) {
    return assertInstanceOf(DatabaseConnection.class, serviceConnections.getServiceConnection())
        .getConfig();
  }

  @SafeVarargs
  private static IngestionPipeline testSuitePipeline(Map<String, Object>... connections) {
    Map<String, Object> config = new HashMap<>();
    config.put("type", "TestSuite");
    config.put("serviceConnections", List.of(connections));
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("logical_suite")
        .withPipelineType(PipelineType.TEST_SUITE)
        .withSourceConfig(new SourceConfig().withConfig(config));
  }

  private static Map<String, Object> mysqlConnection() {
    Map<String, Object> connection = connectionOfType("Mysql");
    configOf(connection).put("username", "suite_user");
    configOf(connection).put("authType", Map.of("password", DATABASE_PASSWORD));
    return connection;
  }

  private static Map<String, Object> databricksConnection() {
    Map<String, Object> connection = connectionOfType("Databricks");
    configOf(connection).put("httpPath", "/sql/1.0/warehouses/suite");
    configOf(connection).put("authType", Map.of("token", DATABRICKS_TOKEN));
    return connection;
  }

  private static Map<String, Object> unknownConnection() {
    Map<String, Object> connection = connectionOfType("NotAConnectionType");
    configOf(connection).put("password", DATABASE_PASSWORD);
    return connection;
  }

  private static Map<String, Object> connectionOfType(String connectionType) {
    Map<String, Object> config = new HashMap<>();
    config.put("type", connectionType);
    config.put("hostPort", "localhost:3306");
    Map<String, Object> serviceConnection = new HashMap<>();
    serviceConnection.put("config", config);
    Map<String, Object> connection = new HashMap<>();
    connection.put("serviceName", connectionType.toLowerCase(Locale.ROOT) + "_service");
    connection.put("serviceConnection", serviceConnection);
    return connection;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> configOf(Map<String, Object> connection) {
    Map<String, Object> serviceConnection =
        (Map<String, Object>) connection.get("serviceConnection");
    return (Map<String, Object>) serviceConnection.get("config");
  }

  private static IngestionPipeline storagePipeline(Map<String, Object> manifestSource) {
    Map<String, Object> config = new HashMap<>();
    config.put("type", "StorageMetadata");
    config.put("storageMetadataConfigSource", manifestSource);
    return new IngestionPipeline()
        .withName("storage_manifest")
        .withPipelineType(PipelineType.METADATA)
        .withSourceConfig(new SourceConfig().withConfig(config));
  }

  private static Map<String, Object> manifestSource(boolean withPropertyNoSchemaHas) {
    Map<String, Object> source = new HashMap<>();
    source.put(
        "securityConfig",
        Map.of(
            "awsAccessKeyId", "manifest-key",
            "awsSecretAccessKey", SECRET,
            "awsRegion", "us-east-1"));
    source.put("prefixConfig", Map.of("containerName", "manifests", "objectPrefix", "om"));
    if (withPropertyNoSchemaHas) {
      source.put("notInAnySourceSchema", "x");
    }
    return source;
  }
}

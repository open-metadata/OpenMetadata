/*
 *  Copyright 2022 Collate
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
package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;
import static org.openmetadata.schema.api.services.CreateMlModelService.MlModelServiceType.Sklearn;
import static org.openmetadata.schema.entity.services.ServiceType.ML_MODEL;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.services.connections.drive.SftpConnection;
import org.openmetadata.schema.services.connections.drive.sftp.SftpBasicAuth;
import org.openmetadata.schema.services.connections.mlmodel.SklearnConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

@ExtendWith(MockitoExtension.class)
public class DBSecretsManagerTest {

  private static final String ENCRYPTED_VALUE = "fernet:abcdef";
  private static final String DECRYPTED_VALUE = "123456";
  private static DBSecretsManager secretsManager;

  @BeforeAll
  static void setUp() {
    secretsManager =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig(
                "openmetadata", "prefix", List.of("key:value", "key2:value2"), null));
    Fernet fernet = Mockito.mock(Fernet.class);
    lenient().when(fernet.decrypt(anyString())).thenReturn(DECRYPTED_VALUE);
    lenient().when(fernet.decryptIfApplies(anyString())).thenReturn(DECRYPTED_VALUE);
    lenient().when(fernet.encrypt(anyString())).thenReturn(ENCRYPTED_VALUE);
    secretsManager.setFernet(fernet);
  }

  @AfterAll
  static void teardown() {
    // At the end of the test, remove mocked fernet instance so other tests run fine
    secretsManager.setFernet(Fernet.getInstance());
  }

  @Test
  void testEncryptDatabaseServiceConnectionConfig() {
    testEncryptServiceConnection();
  }

  @Test
  void testDecryptDatabaseServiceConnectionConfig() {
    testDecryptServiceConnection();
  }

  /**
   * A secret behind a {@code oneOf} used to reach the database in the clear: the property is
   * generated as a bare {@code Object}, so the encryption walk skipped the map Jackson left there.
   */
  @Test
  void testEncryptSecretNestedInAOneOfProperty() {
    SftpConnection connection =
        new SftpConnection()
            .withHost("sftp.example.com")
            .withAuthType(
                new SftpBasicAuth().withUsername("sftp-user").withPassword(DECRYPTED_VALUE));

    SftpConnection encrypted =
        (SftpConnection)
            secretsManager.encryptServiceConnectionConfig(
                connection, "Sftp", "test", ServiceType.DRIVE);

    assertEquals(ENCRYPTED_VALUE, ((SftpBasicAuth) encrypted.getAuthType()).getPassword());
  }

  @Test
  void testEncryptServiceConnectionWithoutPassword() {
    SklearnConnection connection = new SklearnConnection();
    Object actualConfig =
        secretsManager.encryptServiceConnectionConfig(
            connection, Sklearn.value(), "test", ML_MODEL);
    assertNotSame(connection, actualConfig);
  }

  @Test
  void testDecryptServiceConnectionWithoutPassword() {
    SklearnConnection connection = new SklearnConnection();
    Object actualConfig =
        secretsManager.decryptServiceConnectionConfig(connection, Sklearn.value(), ML_MODEL);
    assertNotSame(connection, actualConfig);
  }

  @Test
  void testReturnsExpectedSecretManagerProvider() {
    assertEquals(SecretsManagerProvider.DB, secretsManager.getSecretsManagerProvider());
  }

  private void testEncryptServiceConnection() {
    MysqlConnection connection =
        new MysqlConnection().withAuthType(new basicAuth().withPassword(ENCRYPTED_VALUE));
    Object actualConfig =
        secretsManager.encryptServiceConnectionConfig(
            connection, Mysql.value(), "test", ServiceType.DATABASE);
    assertEquals(
        ENCRYPTED_VALUE,
        JsonUtils.convertValue(((MysqlConnection) actualConfig).getAuthType(), basicAuth.class)
            .getPassword());
    assertNotSame(connection, actualConfig);
  }

  private void testDecryptServiceConnection() {
    MysqlConnection mysqlConnection =
        new MysqlConnection().withAuthType(new basicAuth().withPassword(DECRYPTED_VALUE));
    Object actualConfig =
        secretsManager.decryptServiceConnectionConfig(
            mysqlConnection, Mysql.value(), ServiceType.DATABASE);
    assertEquals(
        DECRYPTED_VALUE,
        JsonUtils.convertValue(((MysqlConnection) actualConfig).getAuthType(), basicAuth.class)
            .getPassword());
    assertNotSame(mysqlConnection, actualConfig);
  }

  @Test
  void testEncryptPowerBiGcsPrivateKey() {
    Map<String, Object> connection =
        JsonUtils.readValue(
            """
            {"type":"PowerBI","clientId":"client","clientSecret":"secret-value","tenantId":"tenant",
             "pbitFilesSource":{"pbitFileConfigType":"gcs","securityConfig":{"gcpConfig":{"privateKey":"secret-value"}}}}
            """,
            Map.class);

    Object encrypted =
        secretsManager.encryptServiceConnectionConfig(
            connection, "PowerBI", "test", ServiceType.DASHBOARD);

    assertSecretIsEncrypted(JsonUtils.pojoToJson(encrypted));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("nestedSecretPipelines")
  void testEncryptNestedPipelineSecrets(String name, PipelineType pipelineType, String json) {
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("test")
            .withPipelineType(pipelineType)
            .withSourceConfig(new SourceConfig().withConfig(JsonUtils.readValue(json, Map.class)));

    secretsManager.encryptIngestionPipeline(pipeline);

    assertSecretIsEncrypted(JsonUtils.pojoToJson(pipeline.getSourceConfig().getConfig()));
  }

  private static Stream<Arguments> nestedSecretPipelines() {
    return Stream.of(
        Arguments.of(
            "Storage S3 manifest credentials",
            PipelineType.METADATA,
            """
            {"type":"StorageMetadata","storageMetadataConfigSource":{"prefixConfig":{"containerName":"bucket"},
             "securityConfig":{"awsAccessKeyId":"key","awsSecretAccessKey":"secret-value"}}}
            """),
        Arguments.of(
            "Storage GCS manifest credentials",
            PipelineType.METADATA,
            """
            {"type":"StorageMetadata","storageMetadataConfigSource":{"prefixConfig":{"containerName":"bucket"},
             "securityConfig":{"gcpConfig":{"privateKey":"secret-value"}}}}
            """),
        Arguments.of(
            "Application Slack tokens",
            PipelineType.APPLICATION,
            """
            {"type":"Application","appConfig":{"clientId":"client","clientSecret":"client-secret",
             "signingSecret":"signing-secret","botToken":"secret-value","userToken":"secret-value"}}
            """),
        Arguments.of(
            "Application private token",
            PipelineType.APPLICATION,
            """
            {"type":"Application","appPrivateConfig":{"waiiInstance":"https://waii.example.com",
             "collateURL":"https://collate.example.com","token":"secret-value","limits":{"actions":{}}}}
            """),
        Arguments.of(
            "Test suite service password",
            PipelineType.TEST_SUITE,
            """
            {"type":"TestSuite","serviceConnections":[{"serviceName":"mysql","serviceConnection":{"config":
             {"type":"Mysql","username":"user","authType":{"password":"secret-value"}}}}]}
            """),
        Arguments.of(
            "dbt HTTP TLS key",
            PipelineType.DBT,
            """
            {"type":"DBT","dbtConfigSource":{"dbtConfigType":"http","dbtManifestHttpPath":"https://example.com/manifest.json",
             "dbtSSLConfig":{"sslKey":"secret-value"}}}
            """));
  }

  private static void assertSecretIsEncrypted(String serialized) {
    assertFalse(serialized.contains("secret-value"), serialized);
    assertTrue(serialized.contains(ENCRYPTED_VALUE), serialized);
  }
}

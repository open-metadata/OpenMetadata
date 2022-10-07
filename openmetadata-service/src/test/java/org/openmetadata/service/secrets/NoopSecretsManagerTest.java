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
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.mlmodel.SklearnConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.fernet.Fernet;

@ExtendWith(MockitoExtension.class)
public class NoopSecretsManagerTest {

  private static final boolean ENCRYPT = true;
  private static final boolean DECRYPT = false;
  private static final String ENCRYPTED_VALUE = "fernet:abcdef";
  private static final String DECRYPTED_VALUE = "123456";
  private static NoopSecretsManager secretsManager;

  @BeforeAll
  static void setUp() {
    secretsManager = NoopSecretsManager.getInstance("openmetadata");
    Fernet fernet = Mockito.mock(Fernet.class);
    lenient().when(fernet.decrypt(anyString())).thenReturn(DECRYPTED_VALUE);
    lenient().when(fernet.encrypt(anyString())).thenReturn(ENCRYPTED_VALUE);
    secretsManager.setFernet(fernet);
  }

  @AfterAll
  static void teardown() {
    // At the end of the test, remove mocked fernet instance so other tests run fine
    secretsManager.setFernet(Fernet.getInstance());
  }

  @Test
  void testIsLocalSecretsManager() {
    assertTrue(secretsManager.isLocal());
  }

  @Test
  void testEncryptDatabaseServiceConnectionConfig() {
    testEncryptDecryptServiceConnection(DECRYPTED_VALUE, ENCRYPTED_VALUE, ENCRYPT);
  }

  @Test
  void testDecryptDatabaseServiceConnectionConfig() {
    testEncryptDecryptServiceConnection(ENCRYPTED_VALUE, DECRYPTED_VALUE, DECRYPT);
  }

  @Test
  void testEncryptTestServiceConnection() {
    TestServiceConnection testServiceConnection =
        new TestServiceConnection()
            .withConnection(new MysqlConnection())
            .withConnectionType(TestServiceConnection.ConnectionType.Database)
            .withSecretsManagerProvider(secretsManager.getSecretsManagerProvider());
    Object actualServiceConnection = secretsManager.storeTestConnectionObject(testServiceConnection);
    assertEquals(testServiceConnection.getConnection(), actualServiceConnection);
  }

  @Test
  void testEncryptServiceConnectionWithoutPassword() {
    testEncryptDecryptServiceConnectionWithoutPassword(ENCRYPT);
  }

  @Test
  void testEncryptDecryptServiceConnectionWithoutPassword() {
    testEncryptDecryptServiceConnectionWithoutPassword(DECRYPT);
  }

  @Test
  void testReturnsExpectedSecretManagerProvider() {
    assertEquals(SecretsManagerProvider.NOOP, secretsManager.getSecretsManagerProvider());
  }

  @ParameterizedTest
  @MethodSource(
      "org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceUnitTestParams#params")
  public void testEncryptAndDecryptDbtConfigSource(
      Object config,
      EntityReference service,
      Class<? extends EntityInterface> serviceClass,
      PipelineType pipelineType,
      boolean mustBeEncrypted) {
    SourceConfig sourceConfigMock = mock(SourceConfig.class);
    IngestionPipeline mockedIngestionPipeline = mock(IngestionPipeline.class);

    when(mockedIngestionPipeline.getService()).thenReturn(service);
    lenient().when(mockedIngestionPipeline.getPipelineType()).thenReturn(pipelineType);

    if (mustBeEncrypted) {
      when(mockedIngestionPipeline.getSourceConfig()).thenReturn(sourceConfigMock);
      when(sourceConfigMock.getConfig()).thenReturn(config);
    }

    secretsManager.encryptOrDecryptDbtConfigSource(mockedIngestionPipeline, true);

    secretsManager.encryptOrDecryptDbtConfigSource(mockedIngestionPipeline, false);

    if (!mustBeEncrypted) {
      verify(mockedIngestionPipeline, never()).setSourceConfig(any());
      verify(sourceConfigMock, never()).setConfig(any());
    } else {
      ArgumentCaptor<Object> configCaptor = ArgumentCaptor.forClass(Object.class);
      verify(mockedIngestionPipeline, times(4)).getSourceConfig();
      verify(sourceConfigMock, times(2)).setConfig(configCaptor.capture());
      assertEquals(configCaptor.getAllValues().get(0), config);
      assertEquals(configCaptor.getAllValues().get(1), config);
    }
  }

  private void testEncryptDecryptServiceConnectionWithoutPassword(boolean decrypt) {
    SklearnConnection sklearnConnection = new SklearnConnection();
    CreateMlModelService.MlModelServiceType databaseServiceType = CreateMlModelService.MlModelServiceType.Sklearn;
    String connectionName = "test";

    Object actualConfig =
        secretsManager.encryptOrDecryptServiceConnectionConfig(
            sklearnConnection, databaseServiceType.value(), connectionName, ServiceType.ML_MODEL, decrypt);

    assertNotSame(sklearnConnection, actualConfig);
  }

  private void testEncryptDecryptServiceConnection(String encryptedValue, String decryptedValue, boolean decrypt) {
    MysqlConnection mysqlConnection = new MysqlConnection();
    mysqlConnection.setPassword(encryptedValue);
    CreateDatabaseService.DatabaseServiceType databaseServiceType = CreateDatabaseService.DatabaseServiceType.Mysql;
    String connectionName = "test";

    Object actualConfig =
        secretsManager.encryptOrDecryptServiceConnectionConfig(
            mysqlConnection, databaseServiceType.value(), connectionName, ServiceType.DATABASE, decrypt);

    assertEquals(decryptedValue, ((MysqlConnection) actualConfig).getPassword());
    assertNotSame(mysqlConnection, actualConfig);
  }
}

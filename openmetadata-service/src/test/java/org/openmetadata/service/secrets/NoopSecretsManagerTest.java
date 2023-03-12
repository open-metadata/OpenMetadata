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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.mlmodel.SklearnConnection;
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
    secretsManager = NoopSecretsManager.getInstance("openmetadata", SecretsManagerProvider.NOOP);
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
    testEncryptDecryptServiceConnection(ENCRYPT);
  }

  @Test
  void testDecryptDatabaseServiceConnectionConfig() {
    testEncryptDecryptServiceConnection(DECRYPT);
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

  private void testEncryptDecryptServiceConnectionWithoutPassword(boolean decrypt) {
    SklearnConnection sklearnConnection = new SklearnConnection();
    CreateMlModelService.MlModelServiceType databaseServiceType = CreateMlModelService.MlModelServiceType.Sklearn;
    String connectionName = "test";

    Object actualConfig =
        secretsManager.encryptOrDecryptServiceConnectionConfig(
            sklearnConnection, databaseServiceType.value(), connectionName, ServiceType.ML_MODEL, decrypt);

    assertNotSame(sklearnConnection, actualConfig);
  }

  private void testEncryptDecryptServiceConnection(boolean encrypt) {
    MysqlConnection mysqlConnection = new MysqlConnection();
    mysqlConnection.setPassword(encrypt ? ENCRYPTED_VALUE : DECRYPTED_VALUE);
    CreateDatabaseService.DatabaseServiceType databaseServiceType = CreateDatabaseService.DatabaseServiceType.Mysql;
    String connectionName = "test";

    Object actualConfig =
        secretsManager.encryptOrDecryptServiceConnectionConfig(
            mysqlConnection, databaseServiceType.value(), connectionName, ServiceType.DATABASE, encrypt);

    assertEquals(encrypt ? ENCRYPTED_VALUE : DECRYPTED_VALUE, ((MysqlConnection) actualConfig).getPassword());
    assertNotSame(mysqlConnection, actualConfig);
  }
}

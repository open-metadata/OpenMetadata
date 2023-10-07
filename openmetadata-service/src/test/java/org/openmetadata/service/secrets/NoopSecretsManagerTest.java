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
import static org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;
import static org.openmetadata.schema.api.services.CreateMlModelService.MlModelServiceType.Sklearn;
import static org.openmetadata.schema.entity.services.ServiceType.ML_MODEL;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.services.connections.mlmodel.SklearnConnection;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.util.JsonUtils;

@ExtendWith(MockitoExtension.class)
public class NoopSecretsManagerTest {

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
    testEncryptServiceConnection();
  }

  @Test
  void testDecryptDatabaseServiceConnectionConfig() {
    testDecryptServiceConnection();
  }

  @Test
  void testEncryptServiceConnectionWithoutPassword() {
    SklearnConnection connection = new SklearnConnection();
    Object actualConfig = secretsManager.encryptServiceConnectionConfig(connection, Sklearn.value(), "test", ML_MODEL);
    assertNotSame(connection, actualConfig);
  }

  @Test
  void testDecryptServiceConnectionWithoutPassword() {
    SklearnConnection connection = new SklearnConnection();
    Object actualConfig = secretsManager.decryptServiceConnectionConfig(connection, Sklearn.value(), ML_MODEL);
    assertNotSame(connection, actualConfig);
  }

  @Test
  void testReturnsExpectedSecretManagerProvider() {
    assertEquals(SecretsManagerProvider.NOOP, secretsManager.getSecretsManagerProvider());
  }

  private void testEncryptServiceConnection() {
    MysqlConnection connection = new MysqlConnection().withAuthType(new basicAuth().withPassword(ENCRYPTED_VALUE));
    Object actualConfig =
        secretsManager.encryptServiceConnectionConfig(connection, Mysql.value(), "test", ServiceType.DATABASE);
    assertEquals(
        ENCRYPTED_VALUE,
        JsonUtils.convertValue(((MysqlConnection) actualConfig).getAuthType(), basicAuth.class).getPassword());
    assertNotSame(connection, actualConfig);
  }

  private void testDecryptServiceConnection() {
    MysqlConnection mysqlConnection = new MysqlConnection().withAuthType(new basicAuth().withPassword(DECRYPTED_VALUE));
    Object actualConfig =
        secretsManager.decryptServiceConnectionConfig(mysqlConnection, Mysql.value(), ServiceType.DATABASE);
    assertEquals(
        DECRYPTED_VALUE,
        JsonUtils.convertValue(((MysqlConnection) actualConfig).getAuthType(), basicAuth.class).getPassword());
    assertNotSame(mysqlConnection, actualConfig);
  }
}

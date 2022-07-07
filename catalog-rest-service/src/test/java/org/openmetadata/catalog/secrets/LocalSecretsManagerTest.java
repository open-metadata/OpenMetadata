package org.openmetadata.catalog.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateMlModelService;
import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.fernet.Fernet;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;
import org.openmetadata.catalog.services.connections.mlModel.SklearnConnection;
import org.openmetadata.catalog.type.MlModelConnection;

@ExtendWith(MockitoExtension.class)
public class LocalSecretsManagerTest {

  private static final boolean ENCRYPT = true;
  private static final boolean DECRYPT = false;
  private static final String ENCRYPTED_VALUE = "fernet:abcdef";
  private static final String DECRYPTED_VALUE = "123456";

  @Mock private Fernet fernet;

  private LocalSecretsManager secretsManager;

  @BeforeEach
  void setUp() {
    secretsManager = new LocalSecretsManager();
    lenient().when(fernet.decrypt(anyString())).thenReturn(DECRYPTED_VALUE);
    lenient().when(fernet.encrypt(anyString())).thenReturn(ENCRYPTED_VALUE);
    secretsManager.setFernet(fernet);
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
  void testEncryptServiceConnectionWithoutPassword() {
    testEncryptDecryptServiceConnectionWithoutPassword(ENCRYPT);
  }

  @Test
  void testEncryptDecryptServiceConnectionWithoutPassword() {
    testEncryptDecryptServiceConnectionWithoutPassword(DECRYPT);
  }

  private void testEncryptDecryptServiceConnectionWithoutPassword(boolean decrypt) {
    MlModelConnection mlModelConnection = new MlModelConnection();
    SklearnConnection sklearnConnection = new SklearnConnection();
    mlModelConnection.setConfig(sklearnConnection);
    CreateMlModelService.MlModelServiceType databaseServiceType = CreateMlModelService.MlModelServiceType.Sklearn;
    String connectionName = "test";

    secretsManager.encryptOrDecryptServiceConnection(
        mlModelConnection, databaseServiceType.value(), connectionName, decrypt);

    assertNotSame(sklearnConnection, mlModelConnection.getConfig());
  }

  private void testEncryptDecryptServiceConnection(String encryptedValue, String decryptedValue, boolean decrypt) {
    DatabaseConnection databaseConnection = new DatabaseConnection();
    MysqlConnection mysqlConnection = new MysqlConnection();
    mysqlConnection.setPassword(encryptedValue);
    databaseConnection.setConfig(mysqlConnection);
    CreateDatabaseService.DatabaseServiceType databaseServiceType = CreateDatabaseService.DatabaseServiceType.Mysql;
    String connectionName = "test";

    secretsManager.encryptOrDecryptServiceConnection(
        databaseConnection, databaseServiceType.value(), connectionName, decrypt);

    assertEquals(decryptedValue, ((MysqlConnection) databaseConnection.getConfig()).getPassword());
    assertNotSame(mysqlConnection, databaseConnection.getConfig());
  }
}

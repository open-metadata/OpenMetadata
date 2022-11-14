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

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.client.OktaSSOClientConfig;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider;
import org.openmetadata.service.fernet.Fernet;

@ExtendWith(MockitoExtension.class)
public abstract class ExternalSecretsManagerTest {

  static final boolean DECRYPT = false;
  static final boolean ENCRYPT = true;

  AWSBasedSecretsManager secretsManager;

  @BeforeEach
  void setUp() {
    Fernet fernet = Fernet.getInstance();
    fernet.setFernetKey("jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=");
    Map<String, String> parameters = new HashMap<>();
    parameters.put("region", "eu-west-1");
    parameters.put("accessKeyId", "123456");
    parameters.put("secretAccessKey", "654321");
    SecretsManagerConfiguration config = new SecretsManagerConfiguration();
    config.setParameters(parameters);
    setUpSpecific(config);
  }

  @Test
  void testDecryptDatabaseServiceConnectionConfig() {
    testEncryptDecryptServiceConnection(DECRYPT);
  }

  @Test
  void testEncryptDatabaseServiceConnectionConfig() {
    testEncryptDecryptServiceConnection(ENCRYPT);
  }

  @Test
  void testDecryptSSOConfig() {
    testEncryptDecryptSSOConfig(DECRYPT);
  }

  @Test
  void testEncryptSSSOConfig() {
    testEncryptDecryptSSOConfig(ENCRYPT);
  }

  @Test
  void testReturnsExpectedSecretManagerProvider() {
    assertEquals(expectedSecretManagerProvider(), secretsManager.getSecretsManagerProvider());
  }

  abstract void setUpSpecific(SecretsManagerConfiguration config);

  void testEncryptDecryptServiceConnection(boolean decrypt) {
    MysqlConnection mysqlConnection = new MysqlConnection();
    mysqlConnection.setPassword("openmetadata-test");
    CreateDatabaseService.DatabaseServiceType databaseServiceType = CreateDatabaseService.DatabaseServiceType.Mysql;
    String connectionName = "test";

    MysqlConnection actualConfig =
        (MysqlConnection)
            secretsManager.encryptOrDecryptServiceConnectionConfig(
                mysqlConnection, databaseServiceType.value(), connectionName, ServiceType.DATABASE, decrypt);

    if (decrypt) {
      mysqlConnection.setPassword("secret:/openmetadata/database/test/password");
      actualConfig.setPassword(Fernet.getInstance().decrypt(actualConfig.getPassword()));
    }

    assertEquals(mysqlConnection, actualConfig);
  }

  void testEncryptDecryptSSOConfig(boolean decrypt) {
    OktaSSOClientConfig config = new OktaSSOClientConfig();
    config.setPrivateKey("this-is-a-test");
    AuthenticationMechanism authenticationMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.SSO)
            .withConfig(
                new SSOAuthMechanism().withAuthConfig(config).withSsoServiceType(SSOAuthMechanism.SsoServiceType.OKTA));

    AuthenticationMechanism actualAuthenticationMechanism =
        secretsManager.encryptOrDecryptAuthenticationMechanism("bot", authenticationMechanism, decrypt);

    assertEquals(authenticationMechanism, actualAuthenticationMechanism);
  }

  abstract SecretsManagerProvider expectedSecretManagerProvider();
}

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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;

import java.util.Map;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.schema.security.client.GoogleSSOClientConfig;
import org.openmetadata.schema.security.client.OktaSSOClientConfig;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.util.JsonUtils;

@ExtendWith(MockitoExtension.class)
public abstract class ExternalSecretsManagerTest {
  AWSBasedSecretsManager secretsManager;

  @BeforeEach
  void setUp() {
    Fernet fernet = Fernet.getInstance();
    fernet.setFernetKey("jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=");
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("region", "eu-west-1");
    parameters.setAdditionalProperty("accessKeyId", "123456");
    parameters.setAdditionalProperty("secretAccessKey", "654321");
    SecretsManagerConfiguration config = new SecretsManagerConfiguration();
    config.setParameters(parameters);
    setUpSpecific(config);
  }

  @Test
  void testEncryptDecryptDatabaseServiceConnectionConfig() {
    String password = "openmetadata-test";
    MysqlConnection expectedConnection = new MysqlConnection().withAuthType(new basicAuth().withPassword(password));
    Map<String, Map<String, String>> mysqlConnection = Map.of("authType", Map.of("password", password));

    // Ensure encrypted service connection config encrypts the password
    MysqlConnection actualConnection =
        (MysqlConnection)
            secretsManager.encryptServiceConnectionConfig(mysqlConnection, Mysql.value(), "test", ServiceType.DATABASE);
    assertNotEquals(password, JsonUtils.convertValue(actualConnection.getAuthType(), basicAuth.class).getPassword());

    // Decrypt the encrypted password and validate
    actualConnection =
        (MysqlConnection)
            secretsManager.decryptServiceConnectionConfig(mysqlConnection, Mysql.value(), ServiceType.DATABASE);
    assertEquals(password, JsonUtils.convertValue(actualConnection.getAuthType(), basicAuth.class).getPassword());
    assertEquals(expectedConnection, actualConnection);
  }

  @Test
  void testEncryptDecryptSSSOConfig() {
    String privateKey = "secret:/openmetadata/bot/bot/config/authconfig/privatekey";
    OktaSSOClientConfig config = new OktaSSOClientConfig().withPrivateKey(privateKey);
    AuthenticationMechanism expectedAuthMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.SSO)
            .withConfig(
                new SSOAuthMechanism().withAuthConfig(config).withSsoServiceType(SSOAuthMechanism.SsoServiceType.OKTA));

    AuthenticationMechanism actualAuthMechanism =
        JsonUtils.convertValue(expectedAuthMechanism, AuthenticationMechanism.class);

    // Encrypt private key and ensure it is indeed encrypted
    secretsManager.encryptAuthenticationMechanism("bot", actualAuthMechanism);
    assertNotEquals(privateKey, getPrivateKey(actualAuthMechanism));
    System.out.println("XXX privateKey encrypted is " + getPrivateKey(actualAuthMechanism));

    // Decrypt private key and ensure it is decrypted
    secretsManager.decryptAuthenticationMechanism("bot", actualAuthMechanism);
    System.out.println("XXX privateKey decrypted is " + getPrivateKey(actualAuthMechanism));
    assertEquals(privateKey, getPrivateKey(actualAuthMechanism));
  }

  @Test
  void testEncryptDecryptIngestionPipelineDBTConfig() {
    String secretKey =
        "secret:/openmetadata/pipeline/my-pipeline/sourceconfig/config/dbtconfigsource"
            + "/dbtsecurityconfig/awssecretaccesskey";
    AWSCredentials credentials = new AWSCredentials().withAwsSecretAccessKey(secretKey).withAwsRegion("eu-west-1");
    DbtS3Config config = new DbtS3Config().withDbtSecurityConfig(credentials);
    DbtPipeline dbtPipeline = new DbtPipeline().withDbtConfigSource(config);
    SourceConfig sourceConfig = new SourceConfig().withConfig(dbtPipeline);
    IngestionPipeline expectedIngestionPipeline =
        new IngestionPipeline()
            .withName("my-pipeline")
            .withPipelineType(PipelineType.DBT)
            .withService(new DatabaseService().getEntityReference().withType(Entity.DATABASE_SERVICE))
            .withSourceConfig(sourceConfig);

    IngestionPipeline actualIngestionPipeline =
        JsonUtils.convertValue(expectedIngestionPipeline, IngestionPipeline.class);

    // Encrypt the pipeline and make sure it is secret key encrypted
    secretsManager.encryptIngestionPipeline(actualIngestionPipeline);
    System.out.println("XXX encrypted aws secret access key is " + getAwsSecretAccessKey(actualIngestionPipeline));
    assertNotEquals(secretKey, getAwsSecretAccessKey(actualIngestionPipeline));

    // Decrypt the pipeline and make sure the secret key is decrypted
    secretsManager.decryptIngestionPipeline(actualIngestionPipeline);
    System.out.println("XXX decrypted aws secret access key is " + getAwsSecretAccessKey(actualIngestionPipeline));
    assertEquals(secretKey, getAwsSecretAccessKey(actualIngestionPipeline));
    assertEquals(expectedIngestionPipeline, actualIngestionPipeline);
  }

  @Test
  void testEncryptDecryptWorkflow() {
    String password = "secret:/openmetadata/workflow/my-workflow/request/connection/config/password";
    String secretKey = "secret:/openmetadata/serverconnection/securityconfig/secretkey";
    OpenMetadataConnection connection =
        new OpenMetadataConnection().withSecurityConfig(new GoogleSSOClientConfig().withSecretKey(secretKey));
    DatabaseConnection dbConnection =
        new DatabaseConnection().withConfig(new MysqlConnection().withAuthType(new basicAuth().withPassword(password)));
    TestServiceConnectionRequest testRequest =
        new TestServiceConnectionRequest()
            .withConnection(dbConnection)
            .withServiceType(ServiceType.DATABASE)
            .withConnectionType("Mysql");
    Workflow expectedWorkflow =
        new Workflow().withName("my-workflow").withOpenMetadataServerConnection(connection).withRequest(testRequest);
    Workflow actualWorkflow = JsonUtils.convertValue(expectedWorkflow, Workflow.class);

    // Encrypt the workflow and ensure password and secrete key are encrypted
    actualWorkflow = secretsManager.encryptWorkflow(actualWorkflow);
    assertNotEquals(password, getPassword(actualWorkflow));
    assertNotEquals(secretKey, getSecretKey(actualWorkflow));

    // Decrypt the workflow and ensure password and secrete key are decrypted
    actualWorkflow = secretsManager.decryptWorkflow(actualWorkflow);
    assertEquals(password, getPassword(actualWorkflow));
    assertEquals(secretKey, getSecretKey(actualWorkflow));
    assertEquals(expectedWorkflow, actualWorkflow);
  }

  @Test
  void testExceptionConnection() {
    Map<String, Object> mysqlConnection =
        Map.of("username1", "openmetadata-test", "authType", Map.of("password", "test"));
    InvalidServiceConnectionException thrown =
        Assertions.assertThrows(
            InvalidServiceConnectionException.class,
            () ->
                secretsManager.encryptServiceConnectionConfig(
                    mysqlConnection, Mysql.value(), "test", ServiceType.DATABASE));

    Assertions.assertEquals(
        "Failed to encrypt 'Mysql' connection stored in DB due to an unrecognized field: 'username1'",
        thrown.getMessage());
    thrown =
        Assertions.assertThrows(
            InvalidServiceConnectionException.class,
            () -> secretsManager.decryptServiceConnectionConfig(mysqlConnection, Mysql.value(), ServiceType.DATABASE));

    Assertions.assertEquals(
        "Failed to decrypt 'Mysql' connection stored in DB due to an unrecognized field: 'username1'",
        thrown.getMessage());
  }

  @Test
  void testReturnsExpectedSecretManagerProvider() {
    assertEquals(expectedSecretManagerProvider(), secretsManager.getSecretsManagerProvider());
  }

  abstract void setUpSpecific(SecretsManagerConfiguration config);

  protected abstract SecretsManagerProvider expectedSecretManagerProvider();

  private String getPrivateKey(AuthenticationMechanism authMechanism) {
    return ((OktaSSOClientConfig) ((SSOAuthMechanism) authMechanism.getConfig()).getAuthConfig()).getPrivateKey();
  }

  private String getAwsSecretAccessKey(IngestionPipeline ingestionPipeline) {
    DbtPipeline expectedDbtPipeline = ((DbtPipeline) ingestionPipeline.getSourceConfig().getConfig());
    return ((DbtS3Config) expectedDbtPipeline.getDbtConfigSource()).getDbtSecurityConfig().getAwsSecretAccessKey();
  }

  private String getPassword(Workflow workflow) {
    return String.valueOf(
        JsonUtils.convertValue(
                ((MysqlConnection)
                        ((DatabaseConnection) ((TestServiceConnectionRequest) workflow.getRequest()).getConnection())
                            .getConfig())
                    .getAuthType(),
                basicAuth.class)
            .getPassword());
  }

  private String getSecretKey(Workflow expectedWorkflow) {
    return ((GoogleSSOClientConfig) (expectedWorkflow.getOpenMetadataServerConnection()).getSecurityConfig())
        .getSecretKey();
  }
}

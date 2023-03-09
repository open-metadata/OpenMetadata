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

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
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
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.util.JsonUtils;

@ExtendWith(MockitoExtension.class)
public abstract class ExternalSecretsManagerTest {

  static final boolean DECRYPT = false;
  static final boolean ENCRYPT = true;

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
  void testDecryptIngestionPipelineDBTConfig() {
    testEncryptDecryptDBTConfig(DECRYPT);
  }

  @Test
  void testEncryptIngestionPipelineDBTConfig() {
    testEncryptDecryptDBTConfig(ENCRYPT);
  }

  @Test
  void testDecryptWorkflow() {
    testEncryptWorkflowObject(DECRYPT);
  }

  @Test
  void testEncryptWorkflow() {
    testEncryptWorkflowObject(ENCRYPT);
  }

  @Test
  void testReturnsExpectedSecretManagerProvider() {
    assertEquals(expectedSecretManagerProvider(), secretsManager.getSecretsManagerProvider());
  }

  abstract void setUpSpecific(SecretsManagerConfiguration config);

  void testEncryptDecryptServiceConnection(boolean decrypt) {
    MysqlConnection expectedMysqlConnection = new MysqlConnection();
    expectedMysqlConnection.setPassword("openmetadata-test");
    CreateDatabaseService.DatabaseServiceType databaseServiceType = CreateDatabaseService.DatabaseServiceType.Mysql;
    String connectionName = "test";

    Map<String, String> mysqlConnection = Map.of("password", "openmetadata-test");

    MysqlConnection actualMysqlConnection =
        (MysqlConnection)
            secretsManager.encryptOrDecryptServiceConnectionConfig(
                mysqlConnection, databaseServiceType.value(), connectionName, ServiceType.DATABASE, decrypt);

    if (decrypt) {
      expectedMysqlConnection.setPassword("secret:/openmetadata/database/test/password");
      actualMysqlConnection.setPassword(Fernet.getInstance().decrypt(actualMysqlConnection.getPassword()));
    }

    assertEquals(expectedMysqlConnection, actualMysqlConnection);
  }

  void testEncryptDecryptSSOConfig(boolean decrypt) {
    OktaSSOClientConfig config = new OktaSSOClientConfig();
    config.setPrivateKey(decrypt ? "secret:/openmetadata/bot/bot/config/authconfig/privatekey" : "this-is-a-test");
    AuthenticationMechanism expectedAuthenticationMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.SSO)
            .withConfig(
                new SSOAuthMechanism().withAuthConfig(config).withSsoServiceType(SSOAuthMechanism.SsoServiceType.OKTA));

    AuthenticationMechanism actualAuthenticationMechanism =
        JsonUtils.convertValue(expectedAuthenticationMechanism, AuthenticationMechanism.class);

    secretsManager.encryptOrDecryptAuthenticationMechanism("bot", actualAuthenticationMechanism, decrypt);

    if (decrypt) {
      String privateKey =
          ((OktaSSOClientConfig) ((SSOAuthMechanism) actualAuthenticationMechanism.getConfig()).getAuthConfig())
              .getPrivateKey();
      ((OktaSSOClientConfig) ((SSOAuthMechanism) actualAuthenticationMechanism.getConfig()).getAuthConfig())
          .setPrivateKey(Fernet.getInstance().decrypt(privateKey));
    }

    assertEquals(expectedAuthenticationMechanism, actualAuthenticationMechanism);
  }

  void testEncryptDecryptDBTConfig(boolean decrypt) {
    IngestionPipeline expectedIngestionPipeline =
        new IngestionPipeline()
            .withName("my-pipeline")
            .withPipelineType(PipelineType.DBT)
            .withService(new DatabaseService().getEntityReference().withType(Entity.DATABASE_SERVICE))
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new DbtPipeline()
                            .withDbtConfigSource(
                                new DbtS3Config()
                                    .withDbtSecurityConfig(
                                        new AWSCredentials()
                                            .withAwsSecretAccessKey("secret-password")
                                            .withAwsRegion("eu-west-1")))));

    IngestionPipeline actualIngestionPipeline =
        JsonUtils.convertValue(expectedIngestionPipeline, IngestionPipeline.class);

    secretsManager.encryptOrDecryptIngestionPipeline(actualIngestionPipeline, decrypt);

    if (decrypt) {
      DbtPipeline expectedDbtPipeline = ((DbtPipeline) expectedIngestionPipeline.getSourceConfig().getConfig());
      DbtPipeline actualDbtPipeline = ((DbtPipeline) actualIngestionPipeline.getSourceConfig().getConfig());
      ((DbtS3Config) expectedDbtPipeline.getDbtConfigSource())
          .getDbtSecurityConfig()
          .setAwsSecretAccessKey(
              "secret:/openmetadata/pipeline/my-pipeline/sourceconfig/config/dbtconfigsource/dbtsecurityconfig/awssecretaccesskey");
      ((DbtS3Config) actualDbtPipeline.getDbtConfigSource())
          .getDbtSecurityConfig()
          .setAwsSecretAccessKey(
              Fernet.getInstance()
                  .decrypt(
                      ((DbtS3Config) actualDbtPipeline.getDbtConfigSource())
                          .getDbtSecurityConfig()
                          .getAwsSecretAccessKey()));
    }

    assertEquals(expectedIngestionPipeline, actualIngestionPipeline);
  }

  void testEncryptWorkflowObject(boolean encrypt) {
    Workflow expectedWorkflow =
        new Workflow()
            .withName("my-workflow")
            .withOpenMetadataServerConnection(
                new OpenMetadataConnection()
                    .withSecretsManagerCredentials(new AWSCredentials().withAwsSecretAccessKey("aws-secret"))
                    .withSecurityConfig(new GoogleSSOClientConfig().withSecretKey("google-secret")))
            .withRequest(
                new TestServiceConnectionRequest()
                    .withConnection(
                        new DatabaseConnection().withConfig(new MysqlConnection().withPassword("openmetadata-test")))
                    .withServiceType(ServiceType.DATABASE)
                    .withConnectionType("Mysql"));

    Workflow workflow = JsonUtils.convertValue(expectedWorkflow, Workflow.class);

    Workflow actualWorkflow = secretsManager.encryptOrDecryptWorkflow(workflow, encrypt);

    if (encrypt) {
      ((MysqlConnection)
              ((DatabaseConnection) ((TestServiceConnectionRequest) expectedWorkflow.getRequest()).getConnection())
                  .getConfig())
          .setPassword("secret:/openmetadata/workflow/my-workflow/request/connection/config/password");
      MysqlConnection mysqlConnection =
          (MysqlConnection)
              ((DatabaseConnection) ((TestServiceConnectionRequest) actualWorkflow.getRequest()).getConnection())
                  .getConfig();
      mysqlConnection.setPassword(Fernet.getInstance().decrypt(mysqlConnection.getPassword()));
      ((GoogleSSOClientConfig) (expectedWorkflow.getOpenMetadataServerConnection()).getSecurityConfig())
          .setSecretKey("secret:/openmetadata/serverconnection/securityconfig/secretkey");
      GoogleSSOClientConfig googleSSOClientConfig =
          ((GoogleSSOClientConfig) (actualWorkflow.getOpenMetadataServerConnection()).getSecurityConfig());
      googleSSOClientConfig.setSecretKey(Fernet.getInstance().decrypt(googleSSOClientConfig.getSecretKey()));
      ((AWSCredentials) (expectedWorkflow.getOpenMetadataServerConnection()).getSecretsManagerCredentials())
          .setAwsSecretAccessKey("secret:/openmetadata/serverconnection/secretsmanagercredentials/awssecretaccesskey");
      AWSCredentials awsCredentials =
          ((AWSCredentials) (actualWorkflow.getOpenMetadataServerConnection()).getSecretsManagerCredentials());
      awsCredentials.setAwsSecretAccessKey(Fernet.getInstance().decrypt(awsCredentials.getAwsSecretAccessKey()));
    }

    assertEquals(expectedWorkflow, actualWorkflow);
  }

  protected abstract SecretsManagerProvider expectedSecretManagerProvider();
}

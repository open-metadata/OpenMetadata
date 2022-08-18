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
package org.openmetadata.catalog.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.AuthProvider.AUTH_0;
import static org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.AuthProvider.AZURE;
import static org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.AuthProvider.CUSTOM_OIDC;
import static org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.AuthProvider.GOOGLE;
import static org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.AuthProvider.NO_AUTH;
import static org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.AuthProvider.OKTA;
import static org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.AuthProvider.OPENMETADATA;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.catalog.fixtures.ConfigurationFixtures;
import org.openmetadata.catalog.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.catalog.metadataIngestion.SourceConfig;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.catalog.type.EntityReference;

@ExtendWith(MockitoExtension.class)
public abstract class ExternalSecretsManagerTest {

  static final boolean ENCRYPT = true;
  static final String AUTH_PROVIDER_SECRET_ID_SUFFIX = "auth-provider";
  static final boolean DECRYPT = false;
  static final String EXPECTED_CONNECTION_JSON =
      "{\"type\":\"Mysql\",\"scheme\":\"mysql+pymysql\",\"password\":\"openmetadata-test\",\"supportsMetadataExtraction\":true,\"supportsProfiler\":true}";
  static final String EXPECTED_SECRET_ID = "/openmetadata/service/database/mysql/test";

  AWSBasedSecretsManager secretsManager;

  @BeforeEach
  void setUp() {
    Map<String, String> parameters = new HashMap<>();
    parameters.put("region", "eu-west-1");
    parameters.put("accessKeyId", "123456");
    parameters.put("secretAccessKey", "654321");
    SecretsManagerConfiguration config = new SecretsManagerConfiguration();
    config.setParameters(parameters);
    setUpSpecific(config);
  }

  @Test
  void testIsNotLocalSecretsManager() {
    assertFalse(secretsManager.isLocal());
  }

  @Test
  void testDecryptDatabaseServiceConnectionConfig() {
    mockClientGetValue(EXPECTED_CONNECTION_JSON);
    testEncryptDecryptServiceConnection(DECRYPT);
  }

  @Test
  void testDecryptServerConnection() {
    AirflowConfiguration airflowConfiguration =
        ConfigurationFixtures.buildAirflowConfig(OpenMetadataServerConnection.AuthProvider.GOOGLE);
    airflowConfiguration.setAuthConfig(ConfigurationFixtures.buildGoogleAuthConfig());
    OpenMetadataServerConnection expectedServerConnection =
        new OpenMetadataServerConnection()
            .withAuthProvider(OpenMetadataServerConnection.AuthProvider.GOOGLE)
            .withHostPort(airflowConfiguration.getMetadataApiEndpoint())
            .withSecurityConfig(null);
    OpenMetadataServerConnection actualServerConnection = secretsManager.decryptServerConnection(airflowConfiguration);
    assertEquals(expectedServerConnection, actualServerConnection);
  }

  @ParameterizedTest
  @MethodSource("testEncryptAirflowConnectionParams")
  void testEncryptAirflowConnection(
      Object expectedAuthProviderConfig,
      OpenMetadataServerConnection.AuthProvider authProvider,
      AuthConfiguration authConfig)
      throws JsonProcessingException {
    String expectedSecretId = String.format("/openmetadata/%s/%s", AUTH_PROVIDER_SECRET_ID_SUFFIX, authProvider);
    AirflowConfiguration airflowConfiguration = ConfigurationFixtures.buildAirflowConfig(authProvider);
    airflowConfiguration.setAuthConfig(authConfig);
    AirflowConfiguration expectedAirflowConfiguration = ConfigurationFixtures.buildAirflowConfig(authProvider);

    AirflowConfiguration actualAirflowConfiguration = secretsManager.encryptAirflowConnection(airflowConfiguration);

    assertEquals(expectedAirflowConfiguration, actualAirflowConfiguration);
    verifyClientCalls(expectedAuthProviderConfig, expectedSecretId);
  }

  @Test
  void testDecryptAuthProviderConfig() {
    assertNull(
        secretsManager.decryptAuthProviderConfig(
            mock(OpenMetadataServerConnection.AuthProvider.class), mock(AuthConfiguration.class)));
  }

  @Test
  void testReturnsExpectedSecretManagerProvider() {
    assertEquals(expectedSecretManagerProvider(), secretsManager.getSecretsManagerProvider());
  }

  @ParameterizedTest
  @MethodSource(
      "org.openmetadata.catalog.resources.services.ingestionpipelines.IngestionPipelineResourceUnitTestParams#params")
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
      when(mockedIngestionPipeline.getName()).thenReturn("test-pipeline");
      mockClientGetValue("{}");
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
      assertNull(((DatabaseServiceMetadataPipeline) configCaptor.getAllValues().get(0)).getDbtConfigSource());
      assertEquals(configCaptor.getAllValues().get(1), config);
      assertNotSame(configCaptor.getAllValues().get(1), config);
    }
  }

  abstract void setUpSpecific(SecretsManagerConfiguration config);

  abstract void mockClientGetValue(String value);

  abstract void verifyClientCalls(Object expectedAuthProviderConfig, String expectedSecretId)
      throws JsonProcessingException;

  void testEncryptDecryptServiceConnection(boolean decrypt) {
    MysqlConnection mysqlConnection = new MysqlConnection();
    mysqlConnection.setPassword("openmetadata-test");
    CreateDatabaseService.DatabaseServiceType databaseServiceType = CreateDatabaseService.DatabaseServiceType.Mysql;
    String connectionName = "test";

    Object actualConfig =
        secretsManager.encryptOrDecryptServiceConnectionConfig(
            mysqlConnection, databaseServiceType.value(), connectionName, ServiceType.DATABASE, decrypt);

    if (decrypt) {
      assertNull(actualConfig);
    } else {
      assertEquals(mysqlConnection, actualConfig);
      assertNotSame(mysqlConnection, actualConfig);
    }
  }

  private static Stream<Arguments> testEncryptAirflowConnectionParams() {
    return Stream.of(
        Arguments.of(null, NO_AUTH, null),
        Arguments.of(
            ConfigurationFixtures.buildAuth0SSOClientConfig(), AUTH_0, ConfigurationFixtures.buildAuth0Config()),
        Arguments.of(
            ConfigurationFixtures.buildGoogleSSOClientConfig(), GOOGLE, ConfigurationFixtures.buildGoogleAuthConfig()),
        Arguments.of(
            ConfigurationFixtures.buildOktaSSOClientConfig(), OKTA, ConfigurationFixtures.buildOktaAuthConfig()),
        Arguments.of(
            ConfigurationFixtures.buildOpenMetadataJWTClientConfig(),
            OPENMETADATA,
            ConfigurationFixtures.buildOpenmetadataAuthConfig()),
        Arguments.of(
            ConfigurationFixtures.buildCustomOIDCSSOClientConfig(),
            CUSTOM_OIDC,
            ConfigurationFixtures.buildCustomOIDCConfig()),
        Arguments.of(
            ConfigurationFixtures.buildAzureClientConfig(), AZURE, ConfigurationFixtures.buildAzureAuthConfig()));
  }

  abstract OpenMetadataServerConnection.SecretsManagerProvider expectedSecretManagerProvider();
}

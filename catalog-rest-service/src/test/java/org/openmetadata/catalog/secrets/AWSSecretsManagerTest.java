package org.openmetadata.catalog.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
import java.util.Objects;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.fixtures.ConfigurationFixtures;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.catalog.util.JsonUtils;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.CreateSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import software.amazon.awssdk.services.secretsmanager.model.UpdateSecretRequest;

@ExtendWith(MockitoExtension.class)
public class AWSSecretsManagerTest {

  private static final String AUTH_PROVIDER_SECRET_ID_SUFFIX = "auth-provider";

  private static final boolean ENCRYPT = true;
  private static final boolean DECRYPT = false;
  private static final String EXPECTED_CONNECTION_JSON =
      "{\"type\":\"Mysql\",\"scheme\":\"mysql+pymysql\",\"password\":\"openmetadata-test\",\"supportsMetadataExtraction\":true,\"supportsProfiler\":true}";
  private static final String EXPECTED_SECRET_ID = "openmetadata-database-mysql-test";

  @Mock private SecretsManagerClient secretsManagerClient;

  private AWSSecretsManager secretsManager;

  @BeforeEach
  void setUp() {
    Map<String, String> parameters = new HashMap<>();
    parameters.put("region", "eu-west-1");
    parameters.put("accessKeyId", "123456");
    parameters.put("secretAccessKey", "654321");
    SecretsManagerConfiguration config = new SecretsManagerConfiguration();
    config.setParameters(parameters);
    secretsManager = AWSSecretsManager.getInstance(config);
    secretsManager.setSecretsClient(secretsManagerClient);
    reset(secretsManagerClient);
  }

  @Test
  void testIsNotLocalSecretsManager() {
    assertFalse(secretsManager.isLocal());
  }

  @Test
  void testEncryptDatabaseServiceConnectionConfig() {
    when(secretsManagerClient.getSecretValue(any(GetSecretValueRequest.class)))
        .thenReturn(GetSecretValueResponse.builder().build());
    testEncryptDecryptServiceConnection(ENCRYPT);
    ArgumentCaptor<GetSecretValueRequest> getSecretCaptor = ArgumentCaptor.forClass(GetSecretValueRequest.class);
    ArgumentCaptor<CreateSecretRequest> createSecretCaptor = ArgumentCaptor.forClass(CreateSecretRequest.class);
    verify(secretsManagerClient).getSecretValue(getSecretCaptor.capture());
    verify(secretsManagerClient).createSecret(createSecretCaptor.capture());
    assertEquals(EXPECTED_SECRET_ID, getSecretCaptor.getValue().secretId());
    assertEquals(EXPECTED_SECRET_ID, createSecretCaptor.getValue().name());
    assertEquals(EXPECTED_CONNECTION_JSON, createSecretCaptor.getValue().secretString());
  }

  @Test
  void testEncryptDatabaseServiceConnectionConfigWhenAlreadyExist() {
    when(secretsManagerClient.getSecretValue(any(GetSecretValueRequest.class)))
        .thenReturn(GetSecretValueResponse.builder().secretString(EXPECTED_CONNECTION_JSON).build());
    testEncryptDecryptServiceConnection(ENCRYPT);
    ArgumentCaptor<GetSecretValueRequest> getSecretCaptor = ArgumentCaptor.forClass(GetSecretValueRequest.class);
    ArgumentCaptor<UpdateSecretRequest> updateSecretCaptor = ArgumentCaptor.forClass(UpdateSecretRequest.class);
    verify(secretsManagerClient).getSecretValue(getSecretCaptor.capture());
    verify(secretsManagerClient).updateSecret(updateSecretCaptor.capture());
    assertEquals(EXPECTED_SECRET_ID, getSecretCaptor.getValue().secretId());
    assertEquals(EXPECTED_SECRET_ID, updateSecretCaptor.getValue().secretId());
    assertEquals(EXPECTED_CONNECTION_JSON, updateSecretCaptor.getValue().secretString());
  }

  @Test
  void testDecryptDatabaseServiceConnectionConfig() {
    when(secretsManagerClient.getSecretValue(any(GetSecretValueRequest.class)))
        .thenReturn(GetSecretValueResponse.builder().secretString(EXPECTED_CONNECTION_JSON).build());
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
    String expectedSecretId = String.format("openmetadata-%s-%s", AUTH_PROVIDER_SECRET_ID_SUFFIX, authProvider);
    AirflowConfiguration airflowConfiguration = ConfigurationFixtures.buildAirflowConfig(authProvider);
    airflowConfiguration.setAuthConfig(authConfig);
    AirflowConfiguration expectedAirflowConfiguration = ConfigurationFixtures.buildAirflowConfig(authProvider);
    AirflowConfiguration actualAirflowConfiguration = secretsManager.encryptAirflowConnection(airflowConfiguration);
    ArgumentCaptor<CreateSecretRequest> createSecretCaptor = ArgumentCaptor.forClass(CreateSecretRequest.class);

    assertEquals(expectedAirflowConfiguration, actualAirflowConfiguration);

    if (Objects.isNull(expectedAuthProviderConfig)) {
      verifyNoInteractions(secretsManagerClient);
    } else {
      verify(secretsManagerClient).createSecret(createSecretCaptor.capture());
      assertEquals(expectedSecretId, createSecretCaptor.getValue().name());
      assertNotNull(createSecretCaptor.getValue().secretString());
      assertEquals(JsonUtils.pojoToJson(expectedAuthProviderConfig), createSecretCaptor.getValue().secretString());
    }
  }

  @Test
  void testDecryptAuthProviderConfig() {
    assertNull(
        secretsManager.decryptAuthProviderConfig(
            mock(OpenMetadataServerConnection.AuthProvider.class), mock(AuthConfiguration.class)));
  }

  @Test
  void testReturnsExpectedSecretManagerProvider() {
    assertEquals(OpenMetadataServerConnection.SecretsManagerProvider.AWS, secretsManager.getSecretsManagerProvider());
  }

  private void testEncryptDecryptServiceConnection(boolean decrypt) {
    DatabaseConnection databaseConnection = new DatabaseConnection();
    MysqlConnection mysqlConnection = new MysqlConnection();
    mysqlConnection.setPassword("openmetadata-test");
    databaseConnection.setConfig(mysqlConnection);
    CreateDatabaseService.DatabaseServiceType databaseServiceType = CreateDatabaseService.DatabaseServiceType.Mysql;
    String connectionName = "test";

    secretsManager.encryptOrDecryptServiceConnection(
        databaseConnection, databaseServiceType.value(), connectionName, decrypt);

    if (decrypt) {
      assertNull(databaseConnection.getConfig());
      assertNotSame(mysqlConnection, databaseConnection.getConfig());
    } else {
      assertEquals(mysqlConnection, databaseConnection.getConfig());
      assertNotSame(mysqlConnection, databaseConnection.getConfig());
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
}

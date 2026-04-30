package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerClientLoader;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.secrets.SecretsManager;

class OpenMetadataConnectionBuilderTest {

  @Test
  void buildUsesJwtBotConfigurationAndSslSettings() {
    BotRepository botRepository = mock(BotRepository.class);
    UserRepository userRepository = mock(UserRepository.class);
    SecretsManager secretsManager = mock(SecretsManager.class);
    OpenMetadataApplicationConfig appConfig =
        createApplicationConfig(VerifySSL.VALIDATE, Map.of("caCertificate", "/tmp/ca.pem"));
    User botUser = jwtBotUser("jwt-token");

    when(secretsManager.getSecretsManagerProvider()).thenReturn(SecretsManagerProvider.AWS);
    when(botRepository.getByName(isNull(), eq(Entity.INGESTION_BOT_NAME), any()))
        .thenReturn(botWithUser("ingestion-bot"));
    when(userRepository.getByName(isNull(), eq("ingestion-bot"), any())).thenReturn(botUser);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<org.openmetadata.service.secrets.SecretsManagerFactory> mockedFactory =
            mockStatic(org.openmetadata.service.secrets.SecretsManagerFactory.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedFactory
          .when(org.openmetadata.service.secrets.SecretsManagerFactory::getSecretsManager)
          .thenReturn(secretsManager);

      OpenMetadataConnection connection = new OpenMetadataConnectionBuilder(appConfig).build();

      assertEquals(AuthProvider.OPENMETADATA, connection.getAuthProvider());
      assertEquals("https://metadata.example/api", connection.getHostPort());
      assertEquals(VerifySSL.VALIDATE, connection.getVerifySSL());
      assertEquals("cluster-west", connection.getClusterName());
      assertEquals(SecretsManagerProvider.AWS, connection.getSecretsManagerProvider());
      assertEquals(SecretsManagerClientLoader.AIRFLOW, connection.getSecretsManagerLoader());
      assertInstanceOf(OpenMetadataJWTClientConfig.class, connection.getSecurityConfig());
      assertEquals("jwt-token", connection.getSecurityConfig().getJwtToken());
      assertInstanceOf(ValidateSSLClientConfig.class, connection.getSslConfig());
      assertEquals(
          "/tmp/ca.pem", ((ValidateSSLClientConfig) connection.getSslConfig()).getCaCertificate());
      verify(secretsManager).decryptJWTAuthMechanism(any(JWTAuthMechanism.class));
    }
  }

  @Test
  void pipelineConstructorFallsBackToDefaultIngestionBot() {
    BotRepository botRepository = mock(BotRepository.class);
    UserRepository userRepository = mock(UserRepository.class);
    SecretsManager secretsManager = mock(SecretsManager.class);
    OpenMetadataApplicationConfig appConfig = createApplicationConfig(VerifySSL.NO_SSL, null);
    IngestionPipeline pipeline =
        new IngestionPipeline().withPipelineType(PipelineType.AUTO_CLASSIFICATION);

    when(secretsManager.getSecretsManagerProvider()).thenReturn(SecretsManagerProvider.IN_MEMORY);
    when(botRepository.getByName(isNull(), eq("autoClassification-bot"), any()))
        .thenThrow(new EntityNotFoundException("bot"));
    when(botRepository.getByName(isNull(), eq(Entity.INGESTION_BOT_NAME), any()))
        .thenReturn(botWithUser("ingestion-bot"));
    when(userRepository.getByName(isNull(), eq("ingestion-bot"), any()))
        .thenReturn(jwtBotUser("fallback-token"));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<org.openmetadata.service.secrets.SecretsManagerFactory> mockedFactory =
            mockStatic(org.openmetadata.service.secrets.SecretsManagerFactory.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedFactory
          .when(org.openmetadata.service.secrets.SecretsManagerFactory::getSecretsManager)
          .thenReturn(secretsManager);

      OpenMetadataConnection connection =
          new OpenMetadataConnectionBuilder(appConfig, pipeline).build();

      assertEquals("fallback-token", connection.getSecurityConfig().getJwtToken());
      assertNull(connection.getSslConfig());
    }
  }

  @Test
  void explicitBotConstructorThrowsWhenBotIsMissing() {
    BotRepository botRepository = mock(BotRepository.class);
    UserRepository userRepository = mock(UserRepository.class);
    SecretsManager secretsManager = mock(SecretsManager.class);

    when(secretsManager.getSecretsManagerProvider()).thenReturn(SecretsManagerProvider.IN_MEMORY);
    when(botRepository.getByName(isNull(), eq("missing-bot"), any()))
        .thenThrow(new EntityNotFoundException("bot"));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<org.openmetadata.service.secrets.SecretsManagerFactory> mockedFactory =
            mockStatic(org.openmetadata.service.secrets.SecretsManagerFactory.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedFactory
          .when(org.openmetadata.service.secrets.SecretsManagerFactory::getSecretsManager)
          .thenReturn(secretsManager);

      IllegalArgumentException exception =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  new OpenMetadataConnectionBuilder(
                      createApplicationConfig(VerifySSL.IGNORE, null), "missing-bot"));

      assertEquals("Please, verify that the bot [missing-bot] is present.", exception.getMessage());
    }
  }

  @Test
  void helperMethodsMapPipelineTypesAndSslModes() throws Exception {
    BotRepository botRepository = mock(BotRepository.class);
    UserRepository userRepository = mock(UserRepository.class);
    SecretsManager secretsManager = mock(SecretsManager.class);
    OpenMetadataApplicationConfig appConfig = createApplicationConfig(VerifySSL.IGNORE, null);

    when(secretsManager.getSecretsManagerProvider()).thenReturn(SecretsManagerProvider.IN_MEMORY);
    when(botRepository.getByName(isNull(), eq(Entity.INGESTION_BOT_NAME), any()))
        .thenReturn(botWithUser("ingestion-bot"));
    when(userRepository.getByName(isNull(), eq("ingestion-bot"), any()))
        .thenReturn(jwtBotUser("helper-token"));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<org.openmetadata.service.secrets.SecretsManagerFactory> mockedFactory =
            mockStatic(org.openmetadata.service.secrets.SecretsManagerFactory.class);
        MockedStatic<IngestionPipelineRepository> mockedPipelineRepository =
            mockStatic(IngestionPipelineRepository.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedFactory
          .when(org.openmetadata.service.secrets.SecretsManagerFactory::getSecretsManager)
          .thenReturn(secretsManager);

      OpenMetadataConnectionBuilder builder = new OpenMetadataConnectionBuilder(appConfig);

      assertNull(builder.getOMSSLConfigFromPipelineServiceClient(VerifySSL.NO_SSL, Map.of()));
      assertNull(builder.getOMSSLConfigFromPipelineServiceClient(VerifySSL.IGNORE, Map.of()));
      ValidateSSLClientConfig sslConfig =
          (ValidateSSLClientConfig)
              builder.getOMSSLConfigFromPipelineServiceClient(
                  VerifySSL.VALIDATE, Map.of("caCertificate", "/tmp/helper.pem"));
      assertEquals("/tmp/helper.pem", sslConfig.getCaCertificate());

      Method method =
          OpenMetadataConnectionBuilder.class.getDeclaredMethod(
              "getBotFromPipeline", IngestionPipeline.class);
      method.setAccessible(true);

      assertEquals(
          Entity.INGESTION_BOT_NAME,
          method.invoke(builder, new IngestionPipeline().withPipelineType(PipelineType.METADATA)));
      assertEquals(
          "usage-bot",
          method.invoke(builder, new IngestionPipeline().withPipelineType(PipelineType.USAGE)));
      assertEquals(
          "autoClassification-bot",
          method.invoke(
              builder, new IngestionPipeline().withPipelineType(PipelineType.AUTO_CLASSIFICATION)));

      IngestionPipeline applicationPipeline =
          new IngestionPipeline().withPipelineType(PipelineType.APPLICATION);
      mockedPipelineRepository
          .when(() -> IngestionPipelineRepository.getPipelineWorkflowType(applicationPipeline))
          .thenReturn("searchIndex");

      assertEquals("searchIndexApplicationBot", method.invoke(builder, applicationPipeline));
    }
  }

  @Test
  void extractAuthProviderMapsSsoMechanisms() throws Exception {
    BotRepository botRepository = mock(BotRepository.class);
    UserRepository userRepository = mock(UserRepository.class);
    SecretsManager secretsManager = mock(SecretsManager.class);
    when(secretsManager.getSecretsManagerProvider()).thenReturn(SecretsManagerProvider.IN_MEMORY);
    when(botRepository.getByName(isNull(), eq(Entity.INGESTION_BOT_NAME), any()))
        .thenReturn(botWithUser("ingestion-bot"));
    when(userRepository.getByName(isNull(), eq("ingestion-bot"), any()))
        .thenReturn(jwtBotUser("helper-token"));

    User ssoUser =
        new User()
            .withAuthenticationMechanism(
                new AuthenticationMechanism()
                    .withAuthType(AuthenticationMechanism.AuthType.SSO)
                    .withConfig(
                        new SSOAuthMechanism()
                            .withSsoServiceType(SSOAuthMechanism.SsoServiceType.GOOGLE)));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<org.openmetadata.service.secrets.SecretsManagerFactory> mockedFactory =
            mockStatic(org.openmetadata.service.secrets.SecretsManagerFactory.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedFactory
          .when(org.openmetadata.service.secrets.SecretsManagerFactory::getSecretsManager)
          .thenReturn(secretsManager);

      OpenMetadataConnectionBuilder builder =
          new OpenMetadataConnectionBuilder(createApplicationConfig(VerifySSL.IGNORE, null));

      Method method =
          OpenMetadataConnectionBuilder.class.getDeclaredMethod("extractAuthProvider", User.class);
      method.setAccessible(true);

      assertEquals(AuthProvider.GOOGLE, method.invoke(builder, ssoUser));
    }
  }

  private OpenMetadataApplicationConfig createApplicationConfig(
      VerifySSL verifySSL, Object sslConfig) {
    PipelineServiceClientConfiguration pipelineConfig = new PipelineServiceClientConfiguration();
    pipelineConfig.setMetadataApiEndpoint("https://metadata.example/api");
    pipelineConfig.setVerifySSL(verifySSL);
    pipelineConfig.setSslConfig(sslConfig);
    pipelineConfig.setSecretsManagerLoader(SecretsManagerClientLoader.AIRFLOW);

    OpenMetadataApplicationConfig appConfig = new OpenMetadataApplicationConfig();
    appConfig.setPipelineServiceClientConfiguration(pipelineConfig);
    appConfig.setClusterName("cluster-west");
    return appConfig;
  }

  private Bot botWithUser(String fullyQualifiedName) {
    return new Bot()
        .withName(fullyQualifiedName)
        .withBotUser(new EntityReference().withFullyQualifiedName(fullyQualifiedName));
  }

  private User jwtBotUser(String token) {
    return new User()
        .withName("ingestion-bot")
        .withFullyQualifiedName("ingestion-bot")
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.JWT)
                .withConfig(new JWTAuthMechanism().withJWTToken(token)));
  }
}

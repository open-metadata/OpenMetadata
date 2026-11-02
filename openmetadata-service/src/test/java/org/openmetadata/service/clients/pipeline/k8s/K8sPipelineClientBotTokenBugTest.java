package org.openmetadata.service.clients.pipeline.k8s;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Namespace;
import io.kubernetes.client.util.Config;
import java.lang.reflect.Method;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.security.ssl.VerifySSL;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.EntityUtil;

class K8sPipelineClientBotTokenBugTest {

  @Test
  void getIngestionBotTokenResolvesTokenFromJsonDeserialisedBotUser() throws Exception {
    String userJson =
        "{\"name\":\"ingestion-bot\",\"isBot\":true,\"authenticationMechanism\":"
            + "{\"authType\":\"JWT\",\"config\":{\"JWTToken\":\"ingestion-token\"}}}";
    User botUser = JsonUtils.readValue(userJson, User.class);

    Bot bot = new Bot();
    bot.setBotUser(new EntityReference().withFullyQualifiedName("ingestion-bot"));

    BotRepository botRepository = mock(BotRepository.class);
    UserRepository userRepository = mock(UserRepository.class);
    when(botRepository.getByName(
            eq(null), eq(Entity.INGESTION_BOT_NAME), any(EntityUtil.Fields.class)))
        .thenReturn(bot);
    when(userRepository.getByName(eq(null), eq("ingestion-bot"), any(EntityUtil.Fields.class)))
        .thenReturn(botUser);

    K8sPipelineClient client = newClient(skipInit(true));

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);

      String token = invokePrivate(client, "getIngestionBotToken", new Class<?>[0]);
      assertEquals("ingestion-token", token);
    }
  }

  @ParameterizedTest
  @EnumSource(VerifySSL.class)
  void createDefaultServerConnectionPreservesConfiguredTls(VerifySSL verifySSL) throws Exception {
    String userJson =
        "{\"name\":\"ingestion-bot\",\"isBot\":true,\"authenticationMechanism\":"
            + "{\"authType\":\"JWT\",\"config\":{\"JWTToken\":\"ingestion-token\","
            + "\"JWTTokenExpiry\":\"Unlimited\"}}}";
    User botUser = JsonUtils.readValue(userJson, User.class);

    Bot bot = new Bot();
    bot.setBotUser(new EntityReference().withFullyQualifiedName("ingestion-bot"));

    BotRepository botRepository = mock(BotRepository.class);
    UserRepository userRepository = mock(UserRepository.class);
    when(botRepository.getByName(
            eq(null), eq(Entity.INGESTION_BOT_NAME), any(EntityUtil.Fields.class)))
        .thenReturn(bot);
    when(userRepository.getByName(eq(null), eq("ingestion-bot"), any(EntityUtil.Fields.class)))
        .thenReturn(botUser);

    PipelineServiceClientConfiguration config =
        new PipelineServiceClientConfiguration()
            .withEnabled(true)
            .withMetadataApiEndpoint("https://localhost:8585/api")
            .withParameters(skipInit(true))
            .withVerifySSL(verifySSL)
            .withSslConfig(Map.of("caCertificate", "/tmp/ca.pem"));
    K8sPipelineClient client = new K8sPipelineClient(config);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);

      OpenMetadataConnection connection =
          invokePrivate(client, "createDefaultServerConnection", new Class<?>[0]);
      assertNotNull(connection);
      OpenMetadataJWTClientConfig securityConfig = connection.getSecurityConfig();
      assertNotNull(securityConfig);
      assertEquals("ingestion-token", securityConfig.getJwtToken());
      OpenMetadataConnection serialized =
          JsonUtils.readValue(JsonUtils.pojoToJson(connection), OpenMetadataConnection.class);
      assertEquals(verifySSL, serialized.getVerifySSL());
      if (verifySSL == VerifySSL.VALIDATE) {
        assertEquals(
            "/tmp/ca.pem",
            JsonUtils.convertValue(serialized.getSslConfig(), ValidateSSLClientConfig.class)
                .getCaCertificate());
      } else {
        assertNull(serialized.getSslConfig());
      }
    }
  }

  @Test
  void existingServerConnectionRetainsItsTlsConfiguration() throws Exception {
    try (MockedStatic<Config> config = Mockito.mockStatic(Config.class);
        MockedStatic<Configuration> configuration = Mockito.mockStatic(Configuration.class);
        MockedConstruction<CoreV1Api> coreApi =
            Mockito.mockConstruction(
                CoreV1Api.class,
                (api, context) -> {
                  CoreV1Api.APIreadNamespaceRequest request =
                      mock(CoreV1Api.APIreadNamespaceRequest.class);
                  when(api.readNamespace("openmetadata-pipelines")).thenReturn(request);
                  when(request.execute()).thenReturn(new V1Namespace());
                })) {
      config.when(Config::defaultClient).thenReturn(new ApiClient());
      K8sPipelineClient client = newClient(skipInit(false));
      OpenMetadataConnection connection =
          new OpenMetadataConnection()
              .withVerifySSL(VerifySSL.VALIDATE)
              .withSslConfig(
                  new ValidateSSLClientConfig().withCaCertificate("/tmp/pipeline-ca.pem"))
              .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken("test-token"));
      IngestionPipeline pipeline =
          new IngestionPipeline().withOpenMetadataServerConnection(connection);

      invokePrivate(
          client,
          "ensureServerConnectionConfigured",
          new Class<?>[] {IngestionPipeline.class},
          pipeline);

      assertSame(connection, pipeline.getOpenMetadataServerConnection());
      assertEquals(VerifySSL.VALIDATE, pipeline.getOpenMetadataServerConnection().getVerifySSL());
      assertEquals(
          "/tmp/pipeline-ca.pem",
          ((ValidateSSLClientConfig) pipeline.getOpenMetadataServerConnection().getSslConfig())
              .getCaCertificate());
    }
  }

  private static K8sPipelineClient newClient(Parameters params) {
    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setMetadataApiEndpoint("http://localhost:8585/api");
    config.setParameters(params);
    return new K8sPipelineClient(config);
  }

  private static Parameters skipInit(boolean v) {
    Parameters params = new Parameters();
    params.setAdditionalProperty("namespace", "openmetadata-pipelines");
    params.setAdditionalProperty("inCluster", "false");
    params.setAdditionalProperty("skipInit", Boolean.toString(v));
    params.setAdditionalProperty("ingestionImage", "openmetadata/ingestion:test");
    params.setAdditionalProperty("serviceAccountName", "test-sa");
    return params;
  }

  private static <T> T invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = K8sPipelineClient.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    try {
      @SuppressWarnings("unchecked")
      T result = (T) method.invoke(target, args);
      return result;
    } catch (java.lang.reflect.InvocationTargetException e) {
      if (e.getCause() instanceof Exception exception) throw exception;
      if (e.getCause() instanceof Error error) throw error;
      throw new RuntimeException(e.getCause());
    }
  }
}

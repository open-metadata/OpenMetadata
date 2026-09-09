package org.openmetadata.service.clients.pipeline.k8s;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.User;
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

    K8sPipelineClient client = newClient(skipInit(false));

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);

      String token = invokePrivate(client, "getIngestionBotToken", new Class<?>[0]);
      assertEquals("ingestion-token", token);
    }
  }

  @Test
  void createDefaultServerConnectionResolvesJwtFromJsonDeserialisedBotUser() throws Exception {
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

    K8sPipelineClient client = newClient(skipInit(false));

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);

      Object connection = invokePrivate(client, "createDefaultServerConnection", new Class<?>[0]);
      assertNotNull(connection);
      Object securityConfig =
          ((org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection)
                  connection)
              .getSecurityConfig();
      assertNotNull(securityConfig);
      assertEquals(
          "ingestion-token",
          ((org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig) securityConfig)
              .getJwtToken());
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

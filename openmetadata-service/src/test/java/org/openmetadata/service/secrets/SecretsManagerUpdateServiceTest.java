package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.SecretsManagerUpdateException;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.slf4j.LoggerFactory;

class SecretsManagerUpdateServiceTest {
  private static final SecretsManager.SecretsConfig CONFIG =
      new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null);

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  @SuppressWarnings("unchecked")
  void pipelineRetrievalFailureCannotReportSuccessfulMigration(boolean individualFallback) {
    UserRepository users = mock(UserRepository.class);
    EntityDAO<User> userDao = mock(EntityDAO.class);
    when(users.getDao()).thenReturn(userDao);
    when(users.listAfter(isNull(), any(), any(), anyInt(), isNull()))
        .thenReturn(new ResultList<>(List.of()));
    IngestionPipelineRepository pipelines = mock(IngestionPipelineRepository.class);
    EntityDAO<IngestionPipeline> pipelineDao = mock(EntityDAO.class);
    when(pipelines.getDao()).thenReturn(pipelineDao);
    RuntimeException failure =
        individualFallback
            ? new UnhandledServerException("does not have expected relationship contains")
            : new IllegalStateException("credential-bearing diagnostic");
    when(pipelines.listAfter(isNull(), any(), any(), anyInt(), isNull())).thenThrow(failure);
    when(pipelineDao.listAfter(any(), anyInt(), anyInt()))
        .thenThrow(new IllegalStateException("credential-bearing diagnostic"));
    InMemorySecretsManager manager = new InMemorySecretsManager(CONFIG);
    SecretsManagerUpdateService update =
        new SecretsManagerUpdateService(
            manager,
            manager,
            new SecretsManagerUpdateService.Repositories(Map.of(), users, pipelines, null));
    SecretsManagerUpdateException error =
        assertThrows(SecretsManagerUpdateException.class, update::updateEntities);
    assertTrue(error.getMessage().contains("Cannot retrieve"));
    assertFalse(error.getMessage().contains("credential-bearing diagnostic"));
    assertTrue(manager.getSecretsMap().isEmpty());
  }

  @Test
  @SuppressWarnings("unchecked")
  void invalidStoredRowsStayUnchangedWhileValidRowsMigrateAndReportIncomplete() {
    Fernet.getInstance().setFernetKey("GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=");
    InMemorySecretsManager destination = new InMemorySecretsManager(CONFIG);
    DBSecretsManager source = DBSecretsManager.getInstance(SecretsManagerProvider.DB, CONFIG);
    source.setFernet(Fernet.getInstance());
    DatabaseService invalidService = service("invalid", true);
    DatabaseService validService = service("valid", false);
    IngestionPipeline invalidPipeline = pipeline("invalid", true);
    IngestionPipeline validPipeline = pipeline("valid", false);
    Map<UUID, String> serviceRows = new LinkedHashMap<>();
    Map<UUID, String> pipelineRows = new LinkedHashMap<>();
    List.of(invalidService, validService)
        .forEach(row -> serviceRows.put(row.getId(), JsonUtils.pojoToJson(row)));
    List.of(invalidPipeline, validPipeline)
        .forEach(row -> pipelineRows.put(row.getId(), JsonUtils.pojoToJson(row)));
    String originalService = serviceRows.get(invalidService.getId());
    String originalPipeline = pipelineRows.get(invalidPipeline.getId());
    EntityDAO<DatabaseService> serviceDao = mock(EntityDAO.class);
    EntityDAO<IngestionPipeline> pipelineDao = mock(EntityDAO.class);
    DatabaseServiceRepository services = mock(DatabaseServiceRepository.class);
    IngestionPipelineRepository pipelines = mock(IngestionPipelineRepository.class);
    UserRepository users = mock(UserRepository.class);
    EntityDAO<User> userDao = mock(EntityDAO.class);
    when(services.getDao()).thenReturn(serviceDao);
    when(services.getServiceType()).thenReturn(ServiceType.DATABASE);
    when(pipelines.getDao()).thenReturn(pipelineDao);
    when(users.getDao()).thenReturn(userDao);
    when(services.listAfter(isNull(), any(), any(), anyInt(), isNull()))
        .thenReturn(new ResultList<>(List.of(invalidService, validService)));
    when(pipelines.listAfter(isNull(), any(), any(), anyInt(), isNull()))
        .thenReturn(new ResultList<>(List.of(invalidPipeline, validPipeline)));
    when(users.listAfter(isNull(), any(), any(), anyInt(), isNull()))
        .thenReturn(new ResultList<>(List.of()));
    when(serviceDao.findEntityById(any(UUID.class)))
        .thenAnswer(
            call ->
                JsonUtils.readValue(serviceRows.get(call.getArgument(0)), DatabaseService.class));
    when(pipelineDao.findEntityById(any(UUID.class)))
        .thenAnswer(
            call ->
                JsonUtils.readValue(
                    pipelineRows.get(call.getArgument(0)), IngestionPipeline.class));
    doAnswer(
            call -> {
              DatabaseService row = call.getArgument(0);
              serviceRows.put(row.getId(), JsonUtils.pojoToJson(row));
              return null;
            })
        .when(serviceDao)
        .update(any(DatabaseService.class));
    doAnswer(
            call -> {
              IngestionPipeline row = call.getArgument(0);
              pipelineRows.put(row.getId(), JsonUtils.pojoToJson(row));
              return null;
            })
        .when(pipelineDao)
        .update(any(IngestionPipeline.class));
    SecretsManagerUpdateService update =
        new SecretsManagerUpdateService(
            destination,
            source,
            new SecretsManagerUpdateService.Repositories(
                Map.of(DatabaseConnection.class, services), users, pipelines, null));
    Logger logger = (Logger) LoggerFactory.getLogger(SecretsManagerUpdateService.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      SecretsManagerUpdateException incomplete =
          assertThrows(SecretsManagerUpdateException.class, update::updateEntities);
      assertTrue(incomplete.getMessage().contains(invalidService.getId().toString()));
      assertTrue(incomplete.getMessage().contains(invalidPipeline.getId().toString()));
      assertEquals(originalService, serviceRows.get(invalidService.getId()));
      assertEquals(originalPipeline, pipelineRows.get(invalidPipeline.getId()));
      assertTrue(serviceRows.get(validService.getId()).contains("fernet:"));
      assertTrue(pipelineRows.get(validPipeline.getId()).contains("fernet:"));
      assertEquals(2, destination.getSecretsMap().size());
      assertTrue(destination.getSecretsMap().containsValue("service-secret"));
      assertTrue(destination.getSecretsMap().containsValue("pipeline-secret"));
      String logs =
          appender.list.stream()
              .map(ILoggingEvent::getFormattedMessage)
              .reduce("", (left, right) -> left + "\n" + right);
      assertTrue(logs.contains(invalidService.getId().toString()));
      assertTrue(logs.contains(invalidPipeline.getId().toString()));
      assertTrue(logs.contains("legacy"), logs);
      assertFalse(logs.contains("service-secret"));
      assertFalse(logs.contains("pipeline-secret"));
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  private static DatabaseService service(String name, boolean invalid) {
    Map<String, Object> config =
        new HashMap<>(
            Map.of(
                "type",
                "Mysql",
                "username",
                "user",
                "hostPort",
                "localhost:3306",
                "authType",
                Map.of("password", Fernet.getInstance().encrypt("service-secret"))));
    if (invalid) {
      config.put("legacy", Map.of("retained", true));
    }
    return new DatabaseService()
        .withId(UUID.randomUUID())
        .withName(name)
        .withServiceType(DatabaseServiceType.Mysql)
        .withConnection(new DatabaseConnection().withConfig(config));
  }

  private static IngestionPipeline pipeline(String name, boolean invalid) {
    Map<String, Object> config =
        new HashMap<>(
            Map.of(
                "type",
                "DBT",
                "dbtConfigSource",
                Map.of(
                    "dbtConfigType",
                    "cloud",
                    "dbtCloudAccountId",
                    "1",
                    "dbtCloudUrl",
                    "https://cloud.getdbt.com",
                    "dbtCloudAuthToken",
                    Fernet.getInstance().encrypt("pipeline-secret"))));
    if (invalid) {
      config.put("legacy", Map.of("retained", true));
    }
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName(name)
        .withPipelineType(PipelineType.DBT)
        .withSourceConfig(new SourceConfig().withConfig(config));
  }
}

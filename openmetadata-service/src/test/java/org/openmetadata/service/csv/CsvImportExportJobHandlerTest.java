package org.openmetadata.service.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;

class CsvImportExportJobHandlerTest {
  @AfterEach
  void clearContext() {
    ImpersonationContext.clear();
  }

  @Test
  void unfilteredSchemaExportsKeepTheLegacyArgumentsShape() {
    Map<String, Object> legacy = schemaExportArgs();
    CsvAsyncJobArgs read = JsonUtils.convertValue(legacy, CsvAsyncJobArgs.class);

    assertEquals(CsvAsyncJob.Operation.EXPORT, read.getOperation());
    assertNull(read.getDatabaseSchemaEntityTypes());
    assertFalse(JsonUtils.readTree(JsonUtils.pojoToJson(read)).has("databaseSchemaEntityTypes"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"[\"column\"]", "null", "[null]", "\"table\""})
  void malformedSchemaScopeCannotTurnIntoAnUnfilteredJob(String selector) {
    Map<String, Object> rawArgs = schemaExportArgs();
    rawArgs.put("databaseSchemaEntityTypes", JsonUtils.readTree(selector));
    BackgroundJob job =
        new BackgroundJob().withId(1L).withCreatedBy("requester").withJobArgs(rawArgs);
    CsvAsyncJobManager jobs = mock(CsvAsyncJobManager.class);

    assertThrows(
        IllegalArgumentException.class, () -> new CsvImportExportJobHandler(jobs).runJob(job));
    verifyNoInteractions(jobs);
  }

  @Test
  void schemaExportRechecksAuthorizationAsTheSavedRequester() {
    CsvAsyncJobManager jobs = mock(CsvAsyncJobManager.class);
    DatabaseSchemaRepository repository = mock(DatabaseSchemaRepository.class);
    Authorizer authorizer = mock(Authorizer.class);
    CollectionDAO dao = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    when(dao.userDAO().findEntityByName(anyString()))
        .thenThrow(new EntityNotFoundException("No websocket recipient"));
    doAnswer(
            invocation -> {
              SecurityContext context = invocation.getArgument(0);
              assertEquals("requester", context.getUserPrincipal().getName());
              assertEquals("bot", ImpersonationContext.getImpersonatedBy());
              throw new AuthorizationException("Schema access was revoked");
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    Map<String, Object> rawArgs = schemaExportArgs();
    rawArgs.put("databaseSchemaEntityTypes", List.of("storedProcedure"));
    rawArgs.put("impersonatedBy", "bot");
    BackgroundJob job =
        new BackgroundJob().withId(1L).withCreatedBy("requester").withJobArgs(rawArgs);

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(Entity::getCollectionDAO).thenReturn(dao);
      entities.when(Entity::getAuthorizer).thenReturn(authorizer);
      entities
          .when(() -> Entity.getEntityRepository(Entity.DATABASE_SCHEMA))
          .thenReturn(repository);
      ImpersonationContext.setImpersonatedBy("earlier-job");

      assertThrows(
          BackgroundJobException.class, () -> new CsvImportExportJobHandler(jobs).runJob(job));
      assertNull(ImpersonationContext.getImpersonatedBy());
      verifyNoInteractions(repository);
      verify(jobs).failJob("1", "Schema access was revoked");
    }
  }

  private static Map<String, Object> schemaExportArgs() {
    return new HashMap<>(
        Map.of(
            "operation",
            "EXPORT",
            "entityType",
            Entity.DATABASE_SCHEMA,
            "targetFqn",
            "service.database.schema",
            "recursive",
            true));
  }

  static Stream<Arguments> importActors() {
    return Stream.of(
        Arguments.of("bot", false),
        Arguments.of("bot", true),
        Arguments.of(null, false),
        Arguments.of(null, true));
  }

  @ParameterizedTest
  @MethodSource("importActors")
  void importReplacesWorkerAttributionAndClearsItOnEveryExit(String bot, boolean fails)
      throws IOException {
    CsvAsyncJobManager jobs = mock(CsvAsyncJobManager.class);
    CollectionDAO dao = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    when(dao.userDAO().findEntityByName(anyString()))
        .thenThrow(new EntityNotFoundException("No websocket recipient"));
    @SuppressWarnings("unchecked")
    EntityRepository<Metric> repository = mock(EntityRepository.class);
    when(repository.importFromCsv(
            anyString(),
            anyString(),
            anyBoolean(),
            anyString(),
            anyBoolean(),
            any(CsvImportProgressCallback.class)))
        .thenAnswer(
            invocation -> {
              assertEquals(bot, ImpersonationContext.getImpersonatedBy());
              if (fails) {
                throw new IOException("Import failed");
              }
              return new CsvImportResult().withNumberOfRowsProcessed(1);
            });
    Map<String, Object> args = new HashMap<>();
    args.put("operation", "IMPORT");
    args.put("entityType", Entity.METRIC);
    args.put("targetFqn", "anchor");
    args.put("csv", "name*\nmetric\n");
    args.put("impersonatedBy", bot);
    BackgroundJob job = new BackgroundJob().withId(1L).withCreatedBy("editor").withJobArgs(args);
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(Entity::getCollectionDAO).thenReturn(dao);
      entities.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      ImpersonationContext.setImpersonatedBy("previous-job");
      CsvImportExportJobHandler handler = new CsvImportExportJobHandler(jobs);
      if (fails) {
        assertThrows(BackgroundJobException.class, () -> handler.runJob(job));
      } else {
        handler.runJob(job);
      }
      assertNull(ImpersonationContext.getImpersonatedBy());
    }
  }
}

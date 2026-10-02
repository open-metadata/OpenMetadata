package org.openmetadata.service.migration.utils.v159;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.result.ResultIterable;
import org.jdbi.v3.core.statement.Query;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.AppExtensionTimeSeries;

class MigrationUtilTest {

  private Handle handle;
  private Query query;
  private ResultIterable<Map<String, Object>> iterable;
  private CollectionDAO collectionDAO;
  private AppExtensionTimeSeries appExtensionTimeSeriesDao;
  private AppRepository appRepository;
  private Update update;

  @BeforeEach
  void setUp() {
    handle = mock(Handle.class);
    query = mock(Query.class);
    @SuppressWarnings("unchecked")
    ResultIterable<Map<String, Object>> mockedIterable = mock(ResultIterable.class);
    iterable = mockedIterable;
    collectionDAO = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    appExtensionTimeSeriesDao = collectionDAO.appExtensionTimeSeriesDao();
    appRepository = mock(AppRepository.class);
    update = mock(Update.class);

    when(handle.createQuery(anyString())).thenReturn(query);
    when(query.mapToMap()).thenReturn(iterable);
    when(update.bind(anyString(), anyString())).thenReturn(update);
    when(update.execute()).thenReturn(1);
    when(handle.createUpdate(anyString())).thenReturn(update);
  }

  @SuppressWarnings("unchecked")
  private void emitRows(List<Map<String, Object>> rows) {
    doAnswer(
            invocation -> {
              Consumer<Map<String, Object>> consumer = invocation.getArgument(0);
              rows.forEach(consumer::accept);
              return null;
            })
        .when(iterable)
        .forEach(any(Consumer.class));
  }

  /**
   * The core fix: a non-{@link EntityNotFoundException} from {@code appRepository.find(...)} (e.g. a
   * transient DB error rethrown by the cached find path) must propagate so the migration step is
   * recorded as FAILED and the workflow stops before the post-DDL
   * {@code ALTER ... appName ... GENERATED ... NOT NULL}, which would otherwise fail for a row left
   * without {@code appName}. The thrown exception must carry the offending appId.
   */
  @Test
  void addAppExtensionNamePropagatesNonEntityNotFoundExceptionFromFind() {
    UUID appId = UUID.randomUUID();
    emitRows(List.of(Map.of("appid", appId.toString(), "json", "{\"foo\":\"bar\"}")));
    when(appRepository.find(eq(appId), eq(Include.ALL)))
        .thenThrow(new RuntimeException("transient DB error during find"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.APPLICATION)).thenReturn(appRepository);
      RuntimeException ex =
          assertThrows(
              RuntimeException.class,
              () -> MigrationUtil.addAppExtensionName(handle, collectionDAO, null, false));
      assertTrue(ex.getMessage().contains(appId.toString()));
      assertInstanceOf(RuntimeException.class, ex.getCause());
    }

    verify(appRepository).find(eq(appId), eq(Include.ALL));
    verify(update, never()).execute();
    verify(appExtensionTimeSeriesDao, never())
        .delete(anyString(), eq(AppExtension.ExtensionType.STATUS.toString()));
  }

  /**
   * The one non-happy path that must NOT change: a row whose app was deleted triggers orphan cleanup
   * via {@code delete(appId, "status")} and the step completes normally.
   */
  @Test
  void addAppExtensionNameDeletesOrphanWhenEntityNotFound() {
    UUID appId = UUID.randomUUID();
    emitRows(List.of(Map.of("appid", appId.toString(), "json", "{\"foo\":\"bar\"}")));
    when(appRepository.find(eq(appId), eq(Include.ALL)))
        .thenThrow(EntityNotFoundException.byName("App " + appId + " not found"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.APPLICATION)).thenReturn(appRepository);
      assertDoesNotThrow(
          () -> MigrationUtil.addAppExtensionName(handle, collectionDAO, null, true));
    }

    verify(appRepository).find(eq(appId), eq(Include.ALL));
    verify(appExtensionTimeSeriesDao)
        .delete(eq(appId.toString()), eq(AppExtension.ExtensionType.STATUS.toString()));
    verify(update, never()).execute();
  }

  /** Happy path on postgres: an installed app's row gets {@code appName} written via {@code jsonb_set}. */
  @Test
  void addAppExtensionNameBackfillsExistingAppOnPostgres() {
    UUID appId = UUID.randomUUID();
    App app = new App().withId(appId).withName("MyApp");
    emitRows(List.of(Map.of("appid", appId.toString(), "json", "{\"status\":\"running\"}")));
    when(appRepository.find(eq(appId), eq(Include.ALL))).thenReturn(app);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.APPLICATION)).thenReturn(appRepository);
      assertDoesNotThrow(
          () -> MigrationUtil.addAppExtensionName(handle, collectionDAO, null, true));
    }

    ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
    verify(handle).createUpdate(sql.capture());
    assertTrue(sql.getValue().contains("jsonb_set"));
    assertTrue(sql.getValue().contains("to_jsonb(:appName)"));
    verify(update).bind("appId", appId.toString());
    verify(update).bind("appName", "MyApp");
    verify(update).execute();
    verify(appExtensionTimeSeriesDao, never())
        .delete(anyString(), eq(AppExtension.ExtensionType.STATUS.toString()));
  }

  /** Happy path on mysql: an installed app's row gets {@code appName} written via {@code JSON_SET}. */
  @Test
  void addAppExtensionNameBackfillsExistingAppOnMysql() {
    UUID appId = UUID.randomUUID();
    App app = new App().withId(appId).withName("MyApp");
    emitRows(List.of(Map.of("appid", appId.toString(), "json", "{\"status\":\"running\"}")));
    when(appRepository.find(eq(appId), eq(Include.ALL))).thenReturn(app);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.APPLICATION)).thenReturn(appRepository);
      assertDoesNotThrow(
          () -> MigrationUtil.addAppExtensionName(handle, collectionDAO, null, false));
    }

    ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
    verify(handle).createUpdate(sql.capture());
    assertTrue(sql.getValue().contains("JSON_SET"));
    assertTrue(sql.getValue().contains("$.appName"));
    verify(update).bind("appId", appId.toString());
    verify(update).bind("appName", "MyApp");
    verify(update).execute();
    verify(appExtensionTimeSeriesDao, never())
        .delete(anyString(), eq(AppExtension.ExtensionType.STATUS.toString()));
  }

  /** A row whose JSON already has {@code appName} is a no-op: no find, no update, no delete. */
  @Test
  void addAppExtensionNameSkipsAlreadyMigratedRow() {
    UUID appId = UUID.randomUUID();
    emitRows(
        List.of(
            Map.of(
                "appid",
                appId.toString(),
                "json",
                "{\"appName\":\"MyApp\",\"status\":\"running\"}")));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.APPLICATION)).thenReturn(appRepository);
      assertDoesNotThrow(
          () -> MigrationUtil.addAppExtensionName(handle, collectionDAO, null, true));
    }

    verify(appRepository, never()).find(any(UUID.class), any(Include.class));
    verify(update, never()).execute();
    verify(appExtensionTimeSeriesDao, never())
        .delete(anyString(), eq(AppExtension.ExtensionType.STATUS.toString()));
  }

  /**
   * A failure from {@code update.execute(...)} (e.g. deadlock, lock-timeout, connection loss) must
   * propagate with the offending appId instead of leaving the row un-updated.
   */
  @Test
  void addAppExtensionNamePropagatesUpdateFailure() {
    UUID appId = UUID.randomUUID();
    App app = new App().withId(appId).withName("MyApp");
    emitRows(List.of(Map.of("appid", appId.toString(), "json", "{\"status\":\"running\"}")));
    when(appRepository.find(eq(appId), eq(Include.ALL))).thenReturn(app);
    when(update.execute()).thenThrow(new RuntimeException("deadlock during update"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.APPLICATION)).thenReturn(appRepository);
      RuntimeException ex =
          assertThrows(
              RuntimeException.class,
              () -> MigrationUtil.addAppExtensionName(handle, collectionDAO, null, true));
      assertTrue(ex.getMessage().contains(appId.toString()));
    }

    verify(appRepository).find(eq(appId), eq(Include.ALL));
    verify(update).execute();
    verify(appExtensionTimeSeriesDao, never())
        .delete(anyString(), eq(AppExtension.ExtensionType.STATUS.toString()));
  }

  /**
   * A mid-loop failure of the iteration itself (e.g. a ResultSet error on
   * {@code createQuery(...).mapToMap().forEach(...)}) must propagate via the outer catch, instead of
   * being swallowed while the step is reported as SUCCESS.
   */
  @Test
  void addAppExtensionNamePropagatesIterationLevelError() {
    doThrow(new RuntimeException("connection reset mid-stream"))
        .when(iterable)
        .forEach(any(Consumer.class));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.APPLICATION)).thenReturn(appRepository);
      RuntimeException ex =
          assertThrows(
              RuntimeException.class,
              () -> MigrationUtil.addAppExtensionName(handle, collectionDAO, null, true));
      assertTrue(ex.getMessage().contains("connection reset mid-stream"));
    }

    verify(appRepository, never()).find(any(UUID.class), any(Include.class));
    verify(update, never()).execute();
  }
}

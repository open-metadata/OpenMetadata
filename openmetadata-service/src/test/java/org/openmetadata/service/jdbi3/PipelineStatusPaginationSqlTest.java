package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class PipelineStatusPaginationSqlTest {
  private static final String DATABASE = "pipeline_history_test";
  private static final String PASSWORD = "pipeline-history-test";
  private static final String FQN = "pipeline_service.demo_pipeline";
  private static final String TASK_NAME = "target_%!\\'Ö";

  @Test
  void filteredPagesOnMysql() {
    try (GenericContainer<?> database =
        new GenericContainer<>("mysql:8.3.0")
            .withEnv("MYSQL_DATABASE", DATABASE)
            .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
            .withEnv("MYSQL_ROOT_HOST", "%")
            .withExposedPorts(3306)
            .waitingFor(
                Wait.forSuccessfulCommand(
                    "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                        + PASSWORD
                        + " --execute='SELECT 1'"))) {
      database.start();
      checkPages(
          "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
              .formatted(database.getHost(), database.getMappedPort(3306), DATABASE),
          true);
    }
  }

  @Test
  void filteredPagesOnPostgres() {
    try (GenericContainer<?> database =
        new GenericContainer<>("postgres:15")
            .withEnv("POSTGRES_DB", DATABASE)
            .withEnv("POSTGRES_PASSWORD", PASSWORD)
            .withExposedPorts(5432)
            .waitingFor(
                Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2))) {
      database.start();
      checkPages(
          "jdbc:postgresql://%s:%d/%s"
              .formatted(database.getHost(), database.getMappedPort(5432), DATABASE),
          false);
    }
  }

  private void checkPages(String url, boolean mysql) {
    AtomicInteger jsonRowsRead = new AtomicInteger();
    Jdbi jdbi =
        Jdbi.create(
                () ->
                    trackJsonRows(
                        Connection.class,
                        DriverManager.getConnection(url, mysql ? "root" : "postgres", PASSWORD),
                        jsonRowsRead))
            .installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                mysql ? "com.mysql.cj.jdbc.Driver" : "org.postgresql.Driver"));
    try (Handle handle = jdbi.open();
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      seed(handle, mysql);
      CollectionDAO collection = mock(CollectionDAO.class);
      when(collection.entityExtensionTimeSeriesDao())
          .thenReturn(handle.attach(CollectionDAO.EntityExtensionTimeSeriesDAO.class));
      entities.when(Entity::getCollectionDAO).thenReturn(collection);
      entities
          .when(() -> Entity.registerEntity(any(), any(), any(PipelineRepository.class)))
          .thenAnswer(call -> null);
      PipelineRepository repository = new PipelineRepository();

      ResultList<PipelineStatus> first =
          page(repository, 2, null, null, "Failed, Successful", "TARGET", 40L, 50L);
      assertPage(first, List.of(700L, 600L), 3);
      assertEquals(
          List.of(TASK_NAME),
          first.getData().getFirst().getTaskStatus().stream().map(Status::getName).toList());
      ResultList<PipelineStatus> next =
          page(
              repository,
              2,
              null,
              first.getPaging().getAfter(),
              "Failed, Successful",
              "TARGET",
              40L,
              50L);
      assertPage(next, List.of(300L), 3);
      assertPage(
          page(
              repository,
              2,
              next.getPaging().getBefore(),
              null,
              "Failed, Successful",
              "TARGET",
              40L,
              50L),
          List.of(700L, 600L),
          3);
      assertPage(
          page(repository, 1, cursor(100), null, null, "target", 40L, 50L), List.of(700L), 3);
      assertPage(
          page(repository, 2, cursor(600), "invalid-ignored-after", null, "target", 40L, 50L),
          List.of(700L),
          3);
      ResultList<PipelineStatus> empty =
          page(repository, 2, null, cursor(100), null, "target", 40L, 50L);
      assertPage(empty, List.of(), 3);
      assertNull(empty.getPaging().getBefore());
      assertNull(empty.getPaging().getAfter());

      assertPage(page(repository, 2, null, null, null, null, null, null), List.of(900L, 800L), 9);
      assertPage(page(repository, 2, null, null, "failed", null, null, null), List.of(), 0);
      assertPage(page(repository, 2, null, null, ",", null, null, null), List.of(), 0);
      assertPage(page(repository, 2, null, null, null, "%!\\'ö", null, null), List.of(700L), 1);
      assertPage(page(repository, 2, null, null, null, " ", null, null), List.of(), 0);
      assertPage(page(repository, 2, null, null, null, "target", 0L, 0L), List.of(100L), 1);
      assertPage(
          repository.getPipelineStatuses(FQN, 700L, 700L, 2, null, null, null, null, null, null),
          List.of(700L),
          1);
      assertPage(
          repository.getPipelineStatuses(FQN, 901L, 1000L, 2, null, null, null, null, null, null),
          List.of(),
          0);

      for (String search : new String[] {null, "target", "ö", "%", "_", "!", "\\", "'", "absent"}) {
        for (Long minimum : new Long[] {null, 0L, 40L}) {
          List<PipelineStatus> original =
              page(repository, null, null, null, null, search, minimum, null).getData();
          ResultList<PipelineStatus> optimized =
              page(repository, 100, null, null, null, search, minimum, null);
          assertEquals(original, optimized.getData(), "search=" + search + ", min=" + minimum);
          assertEquals(original.size(), optimized.getPaging().getTotal());
        }
      }
      assertEquals(9, page(repository, 0, null, null, null, null, null, null).getData().size());
      assertEquals(9, page(repository, -1, null, null, null, null, null, null).getData().size());
      for (Integer limit : new Integer[] {null, 0, -1}) {
        ResultList<PipelineStatus> older =
            page(repository, limit, null, cursor(600), null, null, null, null);
        assertEquals(
            List.of(500L, 400L, 300L, 200L, 100L),
            older.getData().stream().map(PipelineStatus::getTimestamp).toList());
        assertEquals(9, older.getPaging().getTotal());
        if (limit == null) {
          assertNull(older.getPaging().getBefore());
          assertNull(older.getPaging().getAfter());
        } else {
          assertEquals(cursor(500), older.getPaging().getBefore());
          assertEquals(cursor(100), older.getPaging().getAfter());
        }
      }
      checkLargeHistory(handle, repository, mysql, jsonRowsRead);
    }
  }

  private void checkLargeHistory(
      Handle handle, PipelineRepository repository, boolean mysql, AtomicInteger jsonRowsRead) {
    List<Status> tasks =
        IntStream.range(0, 12)
            .mapToObj(i -> task(i == 0 ? "target" : "other_" + i, 10L, 50L))
            .toList();
    var batch =
        handle.prepareBatch(
            "INSERT INTO entity_extension_time_series VALUES (:fqn, :extension, :timestamp, "
                + (mysql ? "CAST(:json AS JSON)" : "CAST(:json AS JSONB)")
                + ")");
    for (long timestamp = 2000; timestamp < 7000; timestamp++) {
      batch
          .bind("fqn", FullyQualifiedName.buildHash(FQN))
          .bind("extension", PipelineRepository.PIPELINE_STATUS_EXTENSION)
          .bind("timestamp", timestamp)
          .bind("json", JsonUtils.pojoToJson(status(timestamp, StatusType.Successful, tasks)))
          .add();
    }
    batch.execute();
    jsonRowsRead.set(0);
    ResultList<PipelineStatus> full =
        repository.getPipelineStatuses(
            FQN, 2000L, 6999L, null, null, null, null, "target", 40L, 40L);
    assertEquals(
        5000, jsonRowsRead.get(), "The counter must observe the complete-range JSON reads");
    jsonRowsRead.set(0);
    ResultList<PipelineStatus> page =
        repository.getPipelineStatuses(FQN, 2000L, 6999L, 20, null, null, null, "target", 40L, 40L);
    assertEquals(
        20, jsonRowsRead.get(), "Limited requests must consume only the selected JSON rows");
    assertEquals(5000, full.getData().size());
    assertEquals(5000, page.getPaging().getTotal());
    assertEquals(20, page.getData().size());
    assertEquals(6999L, page.getData().getFirst().getTimestamp());
    assertEquals(6980L, page.getData().getLast().getTimestamp());
    assertEquals(full.getData().subList(0, 20), page.getData());
  }

  private static <T> T trackJsonRows(Class<T> type, T target, AtomicInteger jsonRowsRead) {
    AtomicBoolean rowCounted = new AtomicBoolean();
    return type.cast(
        Proxy.newProxyInstance(
            type.getClassLoader(),
            new Class<?>[] {type},
            (proxy, method, arguments) -> {
              Object result;
              try {
                result = method.invoke(target, arguments);
              } catch (InvocationTargetException e) {
                throw e.getCause();
              }
              if (result instanceof PreparedStatement statement) {
                return trackJsonRows(PreparedStatement.class, statement, jsonRowsRead);
              }
              if (result instanceof ResultSet resultSet) {
                return trackJsonRows(ResultSet.class, resultSet, jsonRowsRead);
              }
              if (target instanceof ResultSet resultSet) {
                if ("next".equals(method.getName())) {
                  rowCounted.set(false);
                } else if ("getString".equals(method.getName())
                    && isJsonColumn(resultSet, arguments[0])
                    && rowCounted.compareAndSet(false, true)) {
                  jsonRowsRead.incrementAndGet();
                }
              }
              return result;
            }));
  }

  private static boolean isJsonColumn(ResultSet resultSet, Object column) throws SQLException {
    String label =
        column instanceof Integer index
            ? resultSet.getMetaData().getColumnLabel(index)
            : (String) column;
    return "json".equalsIgnoreCase(label);
  }

  private void seed(Handle handle, boolean mysql) {
    handle.execute(
        "CREATE TABLE entity_extension_time_series (entityFQNHash VARCHAR(256), extension VARCHAR(256), timestamp BIGINT, json "
            + (mysql ? "JSON" : "JSONB")
            + ", PRIMARY KEY(entityFQNHash, extension, timestamp))");
    List<PipelineStatus> statuses =
        List.of(
            status(900, StatusType.Failed, List.of(task("target", 10L, 40L))),
            status(800, StatusType.Successful, List.of(task("other", 10L, 50L))),
            status(
                700,
                StatusType.Failed,
                List.of(task("other", 0L, 10000L), task(TASK_NAME, 10L, 50L))),
            status(600, StatusType.Successful, List.of(task("TARGET", 20L, 70L))),
            status(500, StatusType.Failed, List.of(task("target", 10L, null))).withEndTime(900L),
            status(400, StatusType.Successful, List.of(task("target", 100L, 90L))),
            status(
                300,
                StatusType.Failed,
                List.of(task("target_start", 20L, null), task("target_end", null, 70L))),
            status(200, StatusType.Successful, null),
            status(100, StatusType.Successful, List.of(task("target", 5L, 5L))));
    String sql =
        "INSERT INTO entity_extension_time_series VALUES (:fqn, :extension, :timestamp, "
            + (mysql ? "CAST(:json AS JSON)" : "CAST(:json AS JSONB)")
            + ")";
    for (PipelineStatus status : statuses) {
      handle
          .createUpdate(sql)
          .bind("fqn", FullyQualifiedName.buildHash(FQN))
          .bind("extension", PipelineRepository.PIPELINE_STATUS_EXTENSION)
          .bind("timestamp", status.getTimestamp())
          .bind("json", JsonUtils.pojoToJson(status))
          .execute();
    }
    handle
        .createUpdate(sql)
        .bind("fqn", FullyQualifiedName.buildHash("other_pipeline"))
        .bind("extension", PipelineRepository.PIPELINE_STATUS_EXTENSION)
        .bind("timestamp", 1000L)
        .bind(
            "json",
            JsonUtils.pojoToJson(status(1000, StatusType.Failed, List.of(task("target", 0L, 40L)))))
        .execute();
    handle
        .createUpdate(sql)
        .bind("fqn", FullyQualifiedName.buildHash(FQN))
        .bind("extension", "other.extension")
        .bind("timestamp", 1100L)
        .bind(
            "json",
            JsonUtils.pojoToJson(status(1100, StatusType.Failed, List.of(task("target", 0L, 40L)))))
        .execute();
  }

  private static PipelineStatus status(long timestamp, StatusType type, List<Status> tasks) {
    return new PipelineStatus()
        .withTimestamp(timestamp)
        .withExecutionStatus(type)
        .withTaskStatus(tasks);
  }

  private static Status task(String name, Long start, Long end) {
    return new Status().withName(name).withStartTime(start).withEndTime(end);
  }

  private static String cursor(long timestamp) {
    return RestUtil.encodeCursor(Long.toString(timestamp));
  }

  private static ResultList<PipelineStatus> page(
      PipelineRepository repository,
      Integer limit,
      String before,
      String after,
      String status,
      String search,
      Long min,
      Long max) {
    return repository.getPipelineStatuses(
        FQN, 100L, 900L, limit, before, after, status, search, min, max);
  }

  private static void assertPage(
      ResultList<PipelineStatus> page, List<Long> timestamps, int total) {
    assertEquals(timestamps, page.getData().stream().map(PipelineStatus::getTimestamp).toList());
    assertEquals(total, page.getPaging().getTotal());
    if (!timestamps.isEmpty()) {
      assertEquals(cursor(timestamps.getFirst()), page.getPaging().getBefore());
      assertEquals(cursor(timestamps.getLast()), page.getPaging().getAfter());
    }
  }
}

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
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.PipelineRuntimeTrend;
import org.openmetadata.schema.type.PipelineRuntimeTrendList;
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
  private static final String OTHER_FQN = "other_pipeline";
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

      checkFiltersMatchTaskLevelTimings(repository);
      ResultList<PipelineStatus> totalOnly =
          page(repository, 0, null, null, null, null, null, null);
      assertPage(totalOnly, List.of(), 9);
      assertNull(totalOnly.getPaging().getBefore());
      assertNull(totalOnly.getPaging().getAfter());
      assertPage(
          page(repository, 10, null, cursor(600), null, null, null, null),
          List.of(500L, 400L, 300L, 200L, 100L),
          9);
      checkLargeHistory(handle, repository, mysql, jsonRowsRead);
      checkStoredStatusLookup(repository, jsonRowsRead);
      checkAverageAndTrendShareOneRuntime(handle, repository, mysql, jsonRowsRead);
    }
  }

  /**
   * Search keeps a status when one of its task names contains the text, and narrows its tasks to
   * those; a duration runs from the earliest task start to the latest task end of what remains.
   */
  private void checkFiltersMatchTaskLevelTimings(PipelineRepository repository) {
    for (Long minimum : new Long[] {null, 0L, 40L}) {
      for (String onlyInTaskName : new String[] {"ö", "%", "!", "\\", "'"}) {
        assertPage(
            page(repository, 100, null, null, null, onlyInTaskName, minimum, null),
            List.of(700L),
            1);
      }
      assertPage(
          page(repository, 100, null, null, null, "_", minimum, null), List.of(700L, 300L), 2);
      assertPage(page(repository, 100, null, null, null, "absent", minimum, null), List.of(), 0);
    }
    assertPage(
        page(repository, 100, null, null, null, null, null, null),
        List.of(900L, 800L, 700L, 600L, 500L, 400L, 300L, 200L, 100L),
        9);
    assertPage(
        page(repository, 100, null, null, null, null, 0L, null),
        List.of(900L, 800L, 700L, 600L, 300L, 100L),
        6);
    assertPage(
        page(repository, 100, null, null, null, null, 40L, null),
        List.of(800L, 700L, 600L, 300L),
        4);
    assertPage(
        page(repository, 100, null, null, null, "target", null, null),
        List.of(900L, 700L, 600L, 500L, 400L, 300L, 100L),
        7);
    assertPage(
        page(repository, 100, null, null, null, "target", 0L, null),
        List.of(900L, 700L, 600L, 300L, 100L),
        5);
    assertPage(
        page(repository, 100, null, null, null, "target", 40L, null), List.of(700L, 600L, 300L), 3);
  }

  private void checkStoredStatusLookup(PipelineRepository repository, AtomicInteger jsonRowsRead) {
    jsonRowsRead.set(0);
    Map<Long, PipelineStatus> stored =
        repository.loadStoredStatuses(
            new Pipeline().withFullyQualifiedName(FQN),
            List.of(
                status(2000, StatusType.Failed, null),
                status(6999, StatusType.Failed, null),
                status(9999, StatusType.Failed, null)));
    assertEquals(Set.of(2000L, 6999L), stored.keySet());
    assertEquals(2, jsonRowsRead.get(), "A bulk write must read only the rows it can overwrite");
  }

  /**
   * The 30-day average and the runtime trend measure a run the same way, in SQL: the span of the
   * tasks that have both times, else the run's own end, counted only when positive.
   */
  private void checkAverageAndTrendShareOneRuntime(
      Handle handle, PipelineRepository repository, boolean mysql, AtomicInteger jsonRowsRead) {
    handle.execute(
        "CREATE TABLE pipeline_entity (id VARCHAR(36), fqnHash VARCHAR(256), deleted BOOLEAN, json "
            + (mysql ? "JSON" : "JSONB")
            + ")");
    for (String fqn : List.of(FQN, OTHER_FQN)) {
      handle
          .createUpdate(
              "INSERT INTO pipeline_entity VALUES (:id, :fqnHash, FALSE, "
                  + (mysql ? "CAST(:json AS JSON)" : "CAST(:json AS JSONB)")
                  + ")")
          .bind("id", UUID.randomUUID().toString())
          .bind("fqnHash", FullyQualifiedName.buildHash(fqn))
          .bind("json", "{}")
          .execute();
    }
    // Within ten seconds of 12:07:30 UTC two days ago: inside the 30-day window, and on one trend
    // date in any session time zone, since every UTC offset is a whole number of quarter hours.
    long day =
        Instant.now()
            .truncatedTo(ChronoUnit.DAYS)
            .minus(Duration.ofDays(2))
            .plus(Duration.parse("PT12H7M30S"))
            .toEpochMilli();
    String extension = PipelineRepository.PIPELINE_STATUS_EXTENSION;
    insert(
        handle,
        mysql,
        FQN,
        extension,
        status(
            day,
            StatusType.Successful,
            List.of(task("a", 10L, 110L), task("b", -1000L, null), task("c", null, 9000L))));
    insert(
        handle,
        mysql,
        FQN,
        extension,
        status(day + 1000, StatusType.Failed, List.of(task("a", 20L, null), task("b", null, 70L)))
            .withEndTime(day + 1060));
    insert(
        handle,
        mysql,
        FQN,
        extension,
        status(day + 2000, StatusType.Successful, null).withEndTime(day + 2040));
    insert(
        handle,
        mysql,
        FQN,
        extension,
        status(day + 3000, StatusType.Successful, null).withEndTime(day + 3000));
    insert(
        handle,
        mysql,
        FQN,
        extension,
        status(day + 4000, StatusType.Successful, null).withEndTime(day + 3000));
    insert(
        handle,
        mysql,
        FQN,
        extension,
        status(day + 5000, StatusType.Failed, List.of(task("a", 100L, 90L)))
            .withEndTime(day + 5500));
    insert(
        handle,
        mysql,
        FQN,
        extension,
        status(day + 6000, StatusType.Successful, List.of(task("a", 5L, 5L)))
            .withEndTime(day + 6700));
    insert(handle, mysql, FQN, extension, status(day + 7000, StatusType.Successful, null));
    insert(
        handle,
        mysql,
        FQN,
        extension,
        status(day - Duration.ofDays(29).toMillis(), StatusType.Successful, null)
            .withEndTime(day + 100_000));
    insert(
        handle,
        mysql,
        OTHER_FQN,
        extension,
        status(day + 500, StatusType.Successful, null).withEndTime(day + 100_000));
    insert(
        handle,
        mysql,
        FQN,
        "other.extension",
        status(day + 600, StatusType.Successful, null).withEndTime(day + 100_000));

    jsonRowsRead.set(0);
    double average = (100 + 60 + 40) / 3.0;
    assertEquals(average, repository.calculateAverageRuntime(FQN), 1e-9);
    PipelineRuntimeTrendList trend =
        repository.getPipelineRuntimeTrend(
            day - 1000, day + 10_000, FQN, null, null, null, null, null, null, null, null);
    assertEquals(1, trend.getData().size(), String.valueOf(trend.getErrorMessage()));
    PipelineRuntimeTrend runs = trend.getData().getFirst();
    assertEquals(average, runs.getAvgRuntime(), 1e-9);
    assertEquals(40.0, runs.getMinRuntime(), 1e-9);
    assertEquals(100.0, runs.getMaxRuntime(), 1e-9);
    assertEquals(0, jsonRowsRead.get(), "Runtimes are aggregated in the database");
  }

  private static void insert(
      Handle handle, boolean mysql, String fqn, String extension, PipelineStatus status) {
    handle
        .createUpdate(insertStatusSql(mysql))
        .bind("fqn", FullyQualifiedName.buildHash(fqn))
        .bind("extension", extension)
        .bind("timestamp", status.getTimestamp())
        .bind("json", JsonUtils.pojoToJson(status))
        .execute();
  }

  private void checkLargeHistory(
      Handle handle, PipelineRepository repository, boolean mysql, AtomicInteger jsonRowsRead) {
    List<Status> tasks =
        IntStream.range(0, 12)
            .mapToObj(i -> task(i == 0 ? "target" : "other_" + i, 10L, 50L))
            .toList();
    var batch = handle.prepareBatch(insertStatusSql(mysql));
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
    int largestPage = PipelineRepository.MAX_PIPELINE_STATUS_PAGE_SIZE;
    ResultList<PipelineStatus> largest =
        repository.getPipelineStatuses(
            FQN, 2000L, 6999L, largestPage, null, null, null, "target", 40L, 40L);
    assertEquals(
        largestPage, jsonRowsRead.get(), "The largest page must read only its own JSON rows");
    jsonRowsRead.set(0);
    ResultList<PipelineStatus> page =
        repository.getPipelineStatuses(FQN, 2000L, 6999L, 20, null, null, null, "target", 40L, 40L);
    assertEquals(
        20, jsonRowsRead.get(), "Limited requests must consume only the selected JSON rows");
    assertEquals(largestPage, largest.getData().size());
    assertEquals(5000, largest.getPaging().getTotal());
    assertEquals(5000, page.getPaging().getTotal());
    assertEquals(20, page.getData().size());
    assertEquals(6999L, page.getData().getFirst().getTimestamp());
    assertEquals(6980L, page.getData().getLast().getTimestamp());
    assertEquals(largest.getData().subList(0, 20), page.getData());
  }

  private static String insertStatusSql(boolean mysql) {
    return "INSERT INTO entity_extension_time_series VALUES (:fqn, :extension, :timestamp, "
        + (mysql ? "CAST(:json AS JSON)" : "CAST(:json AS JSONB)")
        + ")";
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
    // timestamp is unsigned on MySQL, as in production, so arithmetic on it follows MySQL's
    // unsigned
    // rules here too.
    handle.execute(
        "CREATE TABLE entity_extension_time_series (entityFQNHash VARCHAR(256), extension VARCHAR(256), timestamp "
            + (mysql ? "BIGINT UNSIGNED, json JSON" : "BIGINT, json JSONB")
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
    String sql = insertStatusSql(mysql);
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
        .bind("fqn", FullyQualifiedName.buildHash(OTHER_FQN))
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
      int limit,
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

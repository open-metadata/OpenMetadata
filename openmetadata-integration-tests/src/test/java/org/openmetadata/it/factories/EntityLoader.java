package org.openmetadata.it.factories;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.fluent.Tables;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Bulk-creates OM entities for tests that need a populated server (search-index reindex,
 * scale, perf scenarios). Mirrors {@code perf-test.sh}'s shape but in Java so it works
 * inside JUnit setup without shelling out.
 *
 * <p>Per kind: builds shared parent infrastructure once (one DatabaseService → Database →
 * Schema for all tables, one MessagingService for all topics, etc.), then dispatches N
 * entity-creates across an {@link ExecutorService} sized by {@code parallelWorkers}.
 *
 * <p>Each kind produces a deterministic name pattern ({@code <ns-prefix>_<kind>_<index>})
 * so a re-run inside the same {@link TestNamespace} would conflict — assume a fresh
 * namespace per test method.
 */
public final class EntityLoader {

  private static final Logger LOG = LoggerFactory.getLogger(EntityLoader.class);
  private static final long FUTURE_TIMEOUT_SECONDS = 600;

  private EntityLoader() {}

  public static EntityLoadSummary load(EntityLoadSpec spec, TestNamespace ns) {
    LOG.info(
        "EntityLoader starting: total={} parallelWorkers={}", spec.total(), spec.parallelWorkers());
    Instant start = Instant.now();
    EntityLoadSummary.Builder summary = new EntityLoadSummary.Builder();
    ExecutorService executor = Executors.newFixedThreadPool(spec.parallelWorkers());
    try {
      runIfRequested(EntityKind.TABLE, spec, summary, () -> loadTables(spec, ns, executor, summary));
      runIfRequested(EntityKind.TOPIC, spec, summary, () -> loadTopics(spec, ns, executor, summary));
      runIfRequested(
          EntityKind.DASHBOARD, spec, summary, () -> loadDashboards(spec, ns, executor, summary));
      runIfRequested(
          EntityKind.PIPELINE, spec, summary, () -> loadPipelines(spec, ns, executor, summary));
    } finally {
      shutdown(executor);
    }
    EntityLoadSummary built = summary.build(Duration.between(start, Instant.now()));
    LOG.info(
        "EntityLoader done: created={} columns={} duration={}",
        built.totalEntities(),
        built.totalColumns(),
        built.totalDuration());
    return built;
  }

  private static void runIfRequested(
      EntityKind kind,
      EntityLoadSpec spec,
      EntityLoadSummary.Builder summary,
      Runnable loader) {
    int requested = spec.countOf(kind);
    if (requested <= 0) {
      return;
    }
    Instant start = Instant.now();
    LOG.info("Loading {} {}", requested, kind);
    loader.run();
    summary.recordKindDuration(kind, Duration.between(start, Instant.now()));
  }

  private static void loadTables(
      EntityLoadSpec spec,
      TestNamespace ns,
      ExecutorService executor,
      EntityLoadSummary.Builder summary) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    String schemaFqn = schema.getFullyQualifiedName();
    int count = spec.countOf(EntityKind.TABLE);
    int columns = spec.columnsPerTable();
    String namePrefix = ns.prefix("table") + "_";

    List<Future<Void>> futures = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      final int index = i;
      futures.add(
          executor.submit(
              () -> {
                Tables.create()
                    .name(namePrefix + index)
                    .inSchema(schemaFqn)
                    .withColumns(buildColumns(columns))
                    .execute();
                return null;
              }));
    }
    awaitAll(futures, EntityKind.TABLE);
    summary.recordCreated(EntityKind.TABLE, count);
    summary.recordColumns(count * columns);
  }

  private static void loadTopics(
      EntityLoadSpec spec,
      TestNamespace ns,
      ExecutorService executor,
      EntityLoadSummary.Builder summary) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    String serviceFqn = service.getFullyQualifiedName();
    int count = spec.countOf(EntityKind.TOPIC);
    String namePrefix = ns.prefix("topic") + "_";

    List<Future<Void>> futures = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      final int index = i;
      futures.add(
          executor.submit(
              () -> {
                CreateTopic request =
                    new CreateTopic()
                        .withName(namePrefix + index)
                        .withService(serviceFqn)
                        .withPartitions(1);
                SdkClients.adminClient().topics().create(request);
                return null;
              }));
    }
    awaitAll(futures, EntityKind.TOPIC);
    summary.recordCreated(EntityKind.TOPIC, count);
  }

  private static void loadDashboards(
      EntityLoadSpec spec,
      TestNamespace ns,
      ExecutorService executor,
      EntityLoadSummary.Builder summary) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    String serviceFqn = service.getFullyQualifiedName();
    int count = spec.countOf(EntityKind.DASHBOARD);
    String namePrefix = ns.prefix("dashboard") + "_";

    List<Future<Void>> futures = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      final int index = i;
      futures.add(
          executor.submit(
              () -> {
                CreateDashboard request =
                    new CreateDashboard().withName(namePrefix + index).withService(serviceFqn);
                SdkClients.adminClient().dashboards().create(request);
                return null;
              }));
    }
    awaitAll(futures, EntityKind.DASHBOARD);
    summary.recordCreated(EntityKind.DASHBOARD, count);
  }

  private static void loadPipelines(
      EntityLoadSpec spec,
      TestNamespace ns,
      ExecutorService executor,
      EntityLoadSummary.Builder summary) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    String serviceFqn = service.getFullyQualifiedName();
    int count = spec.countOf(EntityKind.PIPELINE);
    String namePrefix = ns.prefix("pipeline") + "_";

    List<Future<Void>> futures = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      final int index = i;
      futures.add(
          executor.submit(
              () -> {
                CreatePipeline request =
                    new CreatePipeline().withName(namePrefix + index).withService(serviceFqn);
                SdkClients.adminClient().pipelines().create(request);
                return null;
              }));
    }
    awaitAll(futures, EntityKind.PIPELINE);
    summary.recordCreated(EntityKind.PIPELINE, count);
  }

  private static List<Column> buildColumns(int n) {
    List<Column> columns = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      columns.add(new Column().withName("col_" + i).withDataType(ColumnDataType.STRING));
    }
    return columns;
  }

  private static void awaitAll(List<Future<Void>> futures, EntityKind kind) {
    for (Future<Void> f : futures) {
      try {
        f.get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Interrupted while loading " + kind, e);
      } catch (ExecutionException e) {
        throw new IllegalStateException("Failed to load " + kind, e.getCause());
      } catch (java.util.concurrent.TimeoutException e) {
        throw new IllegalStateException("Timed out loading " + kind, e);
      }
    }
  }

  private static void shutdown(ExecutorService executor) {
    executor.shutdown();
    try {
      if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
        executor.shutdownNow();
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      executor.shutdownNow();
    }
  }
}

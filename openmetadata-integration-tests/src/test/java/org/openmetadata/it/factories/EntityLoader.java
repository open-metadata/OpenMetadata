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

  public static EntityLoadSummary load(final EntityLoadSpec spec, final TestNamespace ns) {
    LOG.info(
        "EntityLoader starting: total={} parallelWorkers={}", spec.total(), spec.parallelWorkers());
    final Instant start = Instant.now();
    final EntityLoadSummary.Builder summary = new EntityLoadSummary.Builder();
    final ExecutorService executor = Executors.newFixedThreadPool(spec.parallelWorkers());
    try {
      runIfRequested(
          EntityKind.TABLE, spec, summary, () -> loadTables(spec, ns, executor, summary));
      runIfRequested(
          EntityKind.TOPIC, spec, summary, () -> loadTopics(spec, ns, executor, summary));
      runIfRequested(
          EntityKind.DASHBOARD, spec, summary, () -> loadDashboards(spec, ns, executor, summary));
      runIfRequested(
          EntityKind.PIPELINE, spec, summary, () -> loadPipelines(spec, ns, executor, summary));
    } finally {
      shutdown(executor);
    }
    final EntityLoadSummary built = summary.build(Duration.between(start, Instant.now()));
    LOG.info(
        "EntityLoader done: created={} columns={} duration={}",
        built.totalEntities(),
        built.totalColumns(),
        built.totalDuration());
    return built;
  }

  private static void runIfRequested(
      final EntityKind kind,
      final EntityLoadSpec spec,
      final EntityLoadSummary.Builder summary,
      final Runnable loader) {
    final int requested = spec.countOf(kind);
    if (requested <= 0) {
      return;
    }
    final Instant start = Instant.now();
    LOG.info("Loading {} {}", requested, kind);
    loader.run();
    summary.recordKindDuration(kind, Duration.between(start, Instant.now()));
  }

  private static void loadTables(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    final String schemaFqn = schema.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.TABLE);
    final int columns = spec.columnsPerTable();
    final String namePrefix = ns.prefix("table") + "_";

    final List<Future<Void>> futures = new ArrayList<>(count);
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
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.TOPIC);
    final String namePrefix = ns.prefix("topic") + "_";

    final List<Future<Void>> futures = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      final int index = i;
      futures.add(
          executor.submit(
              () -> {
                final CreateTopic request =
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
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.DASHBOARD);
    final String namePrefix = ns.prefix("dashboard") + "_";

    final List<Future<Void>> futures = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      final int index = i;
      futures.add(
          executor.submit(
              () -> {
                final CreateDashboard request =
                    new CreateDashboard().withName(namePrefix + index).withService(serviceFqn);
                SdkClients.adminClient().dashboards().create(request);
                return null;
              }));
    }
    awaitAll(futures, EntityKind.DASHBOARD);
    summary.recordCreated(EntityKind.DASHBOARD, count);
  }

  private static void loadPipelines(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.PIPELINE);
    final String namePrefix = ns.prefix("pipeline") + "_";

    final List<Future<Void>> futures = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      final int index = i;
      futures.add(
          executor.submit(
              () -> {
                final CreatePipeline request =
                    new CreatePipeline().withName(namePrefix + index).withService(serviceFqn);
                SdkClients.adminClient().pipelines().create(request);
                return null;
              }));
    }
    awaitAll(futures, EntityKind.PIPELINE);
    summary.recordCreated(EntityKind.PIPELINE, count);
  }

  private static List<Column> buildColumns(final int n) {
    final List<Column> columns = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      columns.add(new Column().withName("col_" + i).withDataType(ColumnDataType.STRING));
    }
    return columns;
  }

  private static void awaitAll(final List<Future<Void>> futures, final EntityKind kind) {
    for (final Future<Void> f : futures) {
      try {
        f.get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
      } catch (final InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Interrupted while loading " + kind, e);
      } catch (final ExecutionException e) {
        throw new IllegalStateException("Failed to load " + kind, e.getCause());
      } catch (final java.util.concurrent.TimeoutException e) {
        throw new IllegalStateException("Timed out loading " + kind, e);
      }
    }
  }

  private static void shutdown(final ExecutorService executor) {
    executor.shutdown();
    try {
      if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
        executor.shutdownNow();
      }
    } catch (final InterruptedException e) {
      Thread.currentThread().interrupt();
      executor.shutdownNow();
    }
  }
}

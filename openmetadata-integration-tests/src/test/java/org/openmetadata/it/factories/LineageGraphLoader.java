/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.factories;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import org.openmetadata.it.factories.LineageEdgePlanner.PlannedEdge;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Tables;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Seeds the hierarchy-shaped lineage graph the scene benchmark measures against: many database
 * services, each with databases and schemas, tables spread across every schema, and a layered DAG
 * of lineage edges over them.
 *
 * <p>See {@link LineageGraphSpec} for why this exists alongside {@link EntityLoader} rather than
 * inside it. Only the database services are tracked on the namespace — everything below cascades
 * when they are recursively hard-deleted.
 */
public final class LineageGraphLoader {

  private static final Logger LOG = LoggerFactory.getLogger(LineageGraphLoader.class);

  /** Shared with {@link EntityLoader}: CI caps create concurrency against a proxied cluster. */
  private static final String MAX_WORKERS_PROPERTY = "jpw.loader.maxWorkers";

  private static final long TASK_TIMEOUT_SECONDS = 900;
  private static final String LINEAGE_KEY_COLUMN = "lineage_key";
  private static final String PAYLOAD_COLUMN_PREFIX = "col_";
  private static final String NAME_PREFIX = "lnbench";

  private LineageGraphLoader() {}

  public static LineageGraphSummary load(final LineageGraphSpec spec, final TestNamespace ns) {
    final int workers = effectiveWorkers(spec.parallelWorkers());
    LOG.info(
        "LineageGraphLoader starting: tables={} edges={} schemas={} depth={} workers={}",
        spec.tables(),
        spec.edges(),
        spec.schemas(),
        spec.depth(),
        workers);
    final ExecutorService executor = Executors.newFixedThreadPool(workers);
    try {
      final Timed<List<String>> schemas = timed(() -> createHierarchy(spec, ns, executor));
      final Timed<List<LineageTableNode>> tables =
          timed(() -> createTables(spec, schemas.value(), executor));
      final Timed<List<PlannedEdge>> edges =
          timed(() -> createEdges(spec, tables.value(), executor));
      return summarize(spec, schemas, tables, edges);
    } finally {
      shutdown(executor);
    }
  }

  // ---------------- hierarchy ----------------

  private static List<String> createHierarchy(
      final LineageGraphSpec spec, final TestNamespace ns, final ExecutorService executor) {
    final List<String> serviceFqns = createServices(spec, ns);
    final List<String> databaseFqns = createDatabases(spec, serviceFqns, executor);
    return createSchemas(spec, databaseFqns, executor);
  }

  /**
   * Serial by design: services are the only tracked roots, and creating them one at a time keeps
   * {@link TestNamespace#trackRoot} ordering deterministic for cleanup. There are {@code services}
   * of them (20 by default), so this is seconds, not minutes.
   */
  private static List<String> createServices(final LineageGraphSpec spec, final TestNamespace ns) {
    final List<String> fqns = new ArrayList<>(spec.services());
    for (int index = 0; index < spec.services(); index++) {
      final String name = NAME_PREFIX + "_" + ns.shortPrefix() + "_s" + index;
      final DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName(name, ns);
      fqns.add(service.getFullyQualifiedName());
    }
    return List.copyOf(fqns);
  }

  private static List<String> createDatabases(
      final LineageGraphSpec spec, final List<String> serviceFqns, final ExecutorService executor) {
    final ConcurrentLinkedQueue<String> fqns = new ConcurrentLinkedQueue<>();
    submitAll(
        executor,
        spec.databases(),
        "database",
        index ->
            fqns.add(
                Databases.create()
                    .name("db" + (index % spec.databasesPerService()))
                    .in(serviceFqns.get(index / spec.databasesPerService()))
                    .execute()
                    .getFullyQualifiedName()));
    return List.copyOf(fqns);
  }

  private static List<String> createSchemas(
      final LineageGraphSpec spec,
      final List<String> databaseFqns,
      final ExecutorService executor) {
    final ConcurrentLinkedQueue<String> fqns = new ConcurrentLinkedQueue<>();
    submitAll(
        executor,
        spec.schemas(),
        "schema",
        index ->
            fqns.add(
                DatabaseSchemas.create()
                    .name("sc" + (index % spec.schemasPerDatabase()))
                    .in(databaseFqns.get(index / spec.schemasPerDatabase()))
                    .execute()
                    .getFullyQualifiedName()));
    return List.copyOf(fqns);
  }

  // ---------------- tables ----------------

  /**
   * Tables are spread round-robin over every schema rather than filled schema-by-schema, so a
   * partial load still covers the whole hierarchy and the service/database/schema lenses stay
   * meaningful.
   */
  private static List<LineageTableNode> createTables(
      final LineageGraphSpec spec, final List<String> schemaFqns, final ExecutorService executor) {
    final ConcurrentLinkedQueue<LineageTableNode> nodes = new ConcurrentLinkedQueue<>();
    final List<Column> columns = buildColumns(spec.columnsPerTable());
    submitAll(
        executor,
        spec.tables(),
        "table",
        index -> {
          final Table table =
              Tables.create()
                  .name("t" + index)
                  .inSchema(schemaFqns.get(index % schemaFqns.size()))
                  .withColumns(columns)
                  .execute();
          nodes.add(new LineageTableNode(table.getId(), table.getFullyQualifiedName()));
        });
    return sortedById(nodes);
  }

  /**
   * The planner's layering is positional, so the node order must not depend on which worker thread
   * finished first — otherwise two runs of the same seed traverse different graphs.
   */
  private static List<LineageTableNode> sortedById(
      final ConcurrentLinkedQueue<LineageTableNode> nodes) {
    final List<LineageTableNode> sorted = new ArrayList<>(nodes);
    sorted.sort((left, right) -> left.id().compareTo(right.id()));
    return List.copyOf(sorted);
  }

  private static List<Column> buildColumns(final int count) {
    final List<Column> columns = new ArrayList<>(count);
    columns.add(new Column().withName(LINEAGE_KEY_COLUMN).withDataType(ColumnDataType.BIGINT));
    for (int index = 1; index < count; index++) {
      columns.add(
          new Column()
              .withName(PAYLOAD_COLUMN_PREFIX + index)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(64));
    }
    return List.copyOf(columns);
  }

  // ---------------- edges ----------------

  private static List<PlannedEdge> createEdges(
      final LineageGraphSpec spec,
      final List<LineageTableNode> tables,
      final ExecutorService executor) {
    final List<PlannedEdge> planned = LineageEdgePlanner.plan(spec, tables);
    LOG.info("LineageGraphLoader planned {} edges (requested {})", planned.size(), spec.edges());
    submitAll(executor, planned.size(), "lineageEdge", index -> addEdge(planned.get(index)));
    return planned;
  }

  private static void addEdge(final PlannedEdge edge) {
    final EntitiesEdge entitiesEdge =
        new EntitiesEdge()
            .withFromEntity(edge.from().reference())
            .withToEntity(edge.to().reference());
    if (edge.withColumnLineage()) {
      entitiesEdge.withLineageDetails(columnLineage(edge));
    }
    SdkClients.adminClient().lineage().addLineage(new AddLineage().withEdge(entitiesEdge));
  }

  private static LineageDetails columnLineage(final PlannedEdge edge) {
    return new LineageDetails()
        .withSource(LineageDetails.Source.MANUAL)
        .withColumnsLineage(
            List.of(
                new ColumnLineage()
                    .withFromColumns(List.of(edge.from().columnFqn(LINEAGE_KEY_COLUMN)))
                    .withToColumn(edge.to().columnFqn(LINEAGE_KEY_COLUMN))));
  }

  // ---------------- summary ----------------

  private static LineageGraphSummary summarize(
      final LineageGraphSpec spec,
      final Timed<List<String>> schemas,
      final Timed<List<LineageTableNode>> tables,
      final Timed<List<PlannedEdge>> edges) {
    final LineageGraphSummary summary =
        new LineageGraphSummary(
            spec.services(),
            spec.databases(),
            schemas.value().size(),
            tables.value().size(),
            edges.value().size(),
            (int) edges.value().stream().filter(PlannedEdge::withColumnLineage).count(),
            schemas.duration(),
            tables.duration(),
            edges.duration(),
            focusPoints(schemas.value(), tables.value()));
    LOG.info(
        "LineageGraphLoader done: {} tables in {} ({} tables/s), {} edges in {} ({} edges/s)",
        summary.tables(),
        summary.tableDuration(),
        String.format("%.1f", summary.tablesPerSecond()),
        summary.edges(),
        summary.edgeDuration(),
        String.format("%.1f", summary.edgesPerSecond()));
    return summary;
  }

  /**
   * The hub is the first node of the first layer, which {@link LineageEdgePlanner} gives the widest
   * fan-out; the leaf is the last node overall, which sits in the deepest layer.
   */
  static LineageFocusPoints focusPoints(
      final List<String> schemaFqns, final List<LineageTableNode> tables) {
    final LineageTableNode hub = tables.getFirst();
    final String schemaFqn = schemaFqns.getFirst();
    return new LineageFocusPoints(
        parentFqn(schemaFqn, 2),
        parentFqn(schemaFqn, 1),
        schemaFqn,
        hub.fullyQualifiedName(),
        tables.getLast().fullyQualifiedName(),
        hub.columnFqn(LINEAGE_KEY_COLUMN));
  }

  /** Drops {@code levels} trailing dot-separated segments off an FQN. */
  private static String parentFqn(final String fqn, final int levels) {
    String parent = fqn;
    for (int level = 0; level < levels; level++) {
      parent = parent.substring(0, parent.lastIndexOf('.'));
    }
    return parent;
  }

  // ---------------- concurrency ----------------

  @FunctionalInterface
  private interface IndexedAction {
    void run(int index) throws Exception;
  }

  private record Timed<T>(T value, Duration duration) {}

  private static <T> Timed<T> timed(final Supplier<T> phase) {
    final Instant startedAt = Instant.now();
    final T value = phase.get();
    return new Timed<>(value, Duration.between(startedAt, Instant.now()));
  }

  private static int effectiveWorkers(final int requested) {
    final Integer cap = Integer.getInteger(MAX_WORKERS_PROPERTY);
    return (cap != null && cap > 0) ? Math.min(requested, cap) : requested;
  }

  private static void submitAll(
      final ExecutorService executor,
      final int count,
      final String what,
      final IndexedAction action) {
    final List<Future<Void>> futures = new ArrayList<>(count);
    for (int index = 0; index < count; index++) {
      final int current = index;
      futures.add(
          executor.submit(
              () -> {
                action.run(current);
                return null;
              }));
    }
    awaitAll(futures, what);
  }

  /**
   * Tolerates individual failures the way {@link EntityLoader} does — at these cohort sizes a
   * handful of gateway timeouts is normal and must not throw away an hour of seeding — but fails
   * loudly if nothing at all succeeded.
   */
  private static void awaitAll(final List<Future<Void>> futures, final String what) {
    int failed = 0;
    Throwable firstFailure = null;
    for (final Future<Void> future : futures) {
      try {
        future.get(TASK_TIMEOUT_SECONDS, TimeUnit.SECONDS);
      } catch (final InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Interrupted while creating " + what, e);
      } catch (final ExecutionException | TimeoutException e) {
        failed++;
        firstFailure = (firstFailure == null) ? e : firstFailure;
      }
    }
    reportFailures(futures.size(), failed, what, firstFailure);
  }

  private static void reportFailures(
      final int total, final int failed, final String what, final Throwable firstFailure) {
    if (failed == 0) {
      return;
    }
    if (failed == total) {
      throw new IllegalStateException("Failed to create any " + what, firstFailure);
    }
    LOG.warn("{}: created {}/{} ({} failed)", what, total - failed, total, failed, firstFailure);
  }

  private static void shutdown(final ExecutorService executor) {
    executor.shutdown();
    try {
      if (!executor.awaitTermination(TASK_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
        executor.shutdownNow();
      }
    } catch (final InterruptedException e) {
      executor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }
}

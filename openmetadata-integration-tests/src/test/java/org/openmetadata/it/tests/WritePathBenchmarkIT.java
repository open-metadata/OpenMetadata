/*
 *  Copyright 2024 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Single-threaded write-path latency benchmark with TAIL ATTRIBUTION. Inert unless {@code
 * -Dbenchmark.run=true}; run with {@code -DdbDurable=true} (PostgreSQL fsync=on). Version-neutral
 * (SDK + raw JDBI only).
 *
 * <p>For every UPDATE it records, alongside the OM update latency: a raw single-row DB COMMIT probe
 * (same JVM, durable Postgres — a spike here means an INFRA stall: checkpoint fsync or GC), the GC
 * collection count/time that elapsed DURING the update (a non-zero delta means a GC pause hit it),
 * and the PostgreSQL checkpoint count over the whole phase. The slowest updates are dumped with
 * these readings so each tail outlier is attributable to GC vs checkpoint vs OM-server processing.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class WritePathBenchmarkIT {

  private static final Logger LOG = LoggerFactory.getLogger(WritePathBenchmarkIT.class);
  private static final int WARMUP = 50;
  private static final int ITERATIONS = 2000;
  private static final int SLOWEST_TO_DUMP = 20;

  private record UpdateSample(
      double elapsedMs, double updateMs, double rawCommitMs, long gcCount, double gcTimeMs) {}

  @Test
  void benchmarkSingleThreadWrites(TestNamespace ns) throws IOException {
    assumeTrue(
        Boolean.parseBoolean(System.getProperty("benchmark.run", "false")),
        "write-path benchmark runs only with -Dbenchmark.run=true");

    OpenMetadataClient client = SdkClients.adminClient();
    String schemaFqn = createParentSchema(ns);
    ensureProbeTable();

    List<Long> createNanos = new ArrayList<>(ITERATIONS);
    List<Table> created = runCreates(client, ns, schemaFqn, createNanos);

    long ckptBefore = checkpointCount();
    long[] gcBeforePhase = gcTotals();
    List<UpdateSample> updates = runInstrumentedUpdates(client, created);
    long[] gcAfterPhase = gcTotals();
    long ckptAfter = checkpointCount();

    String report =
        buildReport(
            createNanos,
            updates,
            ckptAfter - ckptBefore,
            gcAfterPhase[0] - gcBeforePhase[0],
            (gcAfterPhase[1] - gcBeforePhase[1]));
    LOG.info("\n{}", report);
    writeReport(report);
  }

  private List<Table> runCreates(
      OpenMetadataClient client, TestNamespace ns, String schemaFqn, List<Long> latencyNanos) {
    List<Table> tables = new ArrayList<>(ITERATIONS);
    for (int i = 0; i < WARMUP + ITERATIONS; i++) {
      CreateTable request = tableRequest(ns, schemaFqn, i);
      long start = System.nanoTime();
      Table table = client.tables().create(request);
      long elapsed = System.nanoTime() - start;
      if (i >= WARMUP) {
        latencyNanos.add(elapsed);
        tables.add(table);
      }
    }
    return tables;
  }

  private List<UpdateSample> runInstrumentedUpdates(OpenMetadataClient client, List<Table> tables) {
    List<UpdateSample> samples = new ArrayList<>(tables.size());
    long phaseStart = System.nanoTime();
    for (int i = 0; i < tables.size(); i++) {
      Table table = tables.get(i);
      table.setDescription("benchmark update " + i + " " + UUID.randomUUID());

      long[] gcPre = gcTotals();
      long t0 = System.nanoTime();
      client.tables().update(table.getId().toString(), table);
      long updateNs = System.nanoTime() - t0;
      long[] gcPost = gcTotals();

      long r0 = System.nanoTime();
      rawCommit();
      long rawNs = System.nanoTime() - r0;

      samples.add(
          new UpdateSample(
              (t0 - phaseStart) / 1_000_000.0,
              updateNs / 1_000_000.0,
              rawNs / 1_000_000.0,
              gcPost[0] - gcPre[0],
              (gcPost[1] - gcPre[1])));
    }
    return samples;
  }

  private CreateTable tableRequest(TestNamespace ns, String schemaFqn, int i) {
    CreateTable request = new CreateTable();
    request.setName(ns.prefix("bench_tbl_" + i));
    request.setDatabaseSchema(schemaFqn);
    request.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(64)));
    return request;
  }

  private String createParentSchema(TestNamespace ns) {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServices.builder()
            .name("bench_svc_" + shortId)
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .description("write-path benchmark service")
            .create();

    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("bench_db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("bench_schema_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);
    return schema.getFullyQualifiedName();
  }

  private void ensureProbeTable() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "CREATE TABLE IF NOT EXISTS bench_commit_probe (id bigserial primary key, v text)"));
  }

  private void rawCommit() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(handle -> handle.execute("INSERT INTO bench_commit_probe(v) VALUES ('p')"));
  }

  private long[] gcTotals() {
    long count = 0;
    long timeMs = 0;
    for (GarbageCollectorMXBean bean : ManagementFactory.getGarbageCollectorMXBeans()) {
      count += Math.max(0, bean.getCollectionCount());
      timeMs += Math.max(0, bean.getCollectionTime());
    }
    return new long[] {count, timeMs};
  }

  private long checkpointCount() {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT checkpoints_timed + checkpoints_req FROM pg_stat_bgwriter")
                    .mapTo(Long.class)
                    .one());
  }

  private String buildReport(
      List<Long> createNanos,
      List<UpdateSample> updates,
      long checkpoints,
      long gcCount,
      long gcTimeMs) {
    String label = System.getProperty("benchmark.label", "unlabeled");
    List<Double> updateMs = updates.stream().map(UpdateSample::updateMs).sorted().toList();
    List<Double> rawMs = updates.stream().map(UpdateSample::rawCommitMs).sorted().toList();
    List<Double> createMs = createNanos.stream().map(n -> n / 1_000_000.0).sorted().toList();

    StringBuilder sb = new StringBuilder();
    sb.append("=== WRITE-PATH BENCHMARK [").append(label).append("] ===\n");
    sb.append(
        String.format(
            "durable=%s  iterations=%d  (single-thread)%n",
            System.getProperty("dbDurable", "false"), ITERATIONS));
    sb.append(formatStats("CREATE", createMs));
    sb.append(formatStats("UPDATE", updateMs));
    sb.append(formatStats("RAW-COMMIT-PROBE", rawMs));
    sb.append(
        String.format(
            "UPDATE phase: checkpoints=%d  gcCount=%d  gcTime=%dms%n",
            checkpoints, gcCount, gcTimeMs));
    sb.append("--- slowest ").append(SLOWEST_TO_DUMP).append(" UPDATEs (attribution) ---\n");
    sb.append(
        String.format(
            "%10s %10s %12s %8s %8s   verdict%n",
            "at(ms)", "update(ms)", "rawCommit(ms)", "gcHits", "gc(ms)"));
    updates.stream()
        .sorted(Comparator.comparingDouble(UpdateSample::updateMs).reversed())
        .limit(SLOWEST_TO_DUMP)
        .forEach(s -> sb.append(formatSample(s)));
    return sb.toString();
  }

  private String formatSample(UpdateSample s) {
    String verdict;
    if (s.gcTimeMs() > 5) {
      verdict = "GC pause";
    } else if (s.rawCommitMs() > 20) {
      verdict = "infra (DB checkpoint/fsync)";
    } else {
      verdict = "OM-server processing";
    }
    return String.format(
        Locale.ROOT,
        "%10.0f %10.1f %12.1f %8d %8.0f   %s%n",
        s.elapsedMs(),
        s.updateMs(),
        s.rawCommitMs(),
        s.gcCount(),
        s.gcTimeMs(),
        verdict);
  }

  private String formatStats(String op, List<Double> sortedMs) {
    double mean = sortedMs.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    return String.format(
        Locale.ROOT,
        "%-17s p50=%.1fms  p99=%.1fms  p99.9=%.1fms  mean=%.1fms  max=%.1fms%n",
        op,
        percentile(sortedMs, 50),
        percentile(sortedMs, 99),
        percentile(sortedMs, 99.9),
        mean,
        sortedMs.get(sortedMs.size() - 1));
  }

  private double percentile(List<Double> sorted, double pct) {
    int index = (int) Math.ceil(pct / 100.0 * sorted.size()) - 1;
    int clamped = Math.max(0, Math.min(sorted.size() - 1, index));
    return sorted.get(clamped);
  }

  private void writeReport(String report) throws IOException {
    String label = System.getProperty("benchmark.label", "unlabeled");
    Path out =
        Path.of(System.getProperty("user.dir"))
            .resolve("../.context/benchmark-" + label + ".txt")
            .normalize();
    Files.writeString(out, report);
    LOG.info("Benchmark report written to {}", out.toAbsolutePath());
  }
}

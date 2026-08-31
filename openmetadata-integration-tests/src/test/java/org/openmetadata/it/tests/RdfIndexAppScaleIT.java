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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Runs the real RdfIndexApp end to end over a seeded catalog and reports the throughput the app
 * itself records. Unlike the write-path harness this exercises everything a production run does:
 * partition workers reading through keyset pagination, the single-writer sink, relationship and
 * lineage writes, and the run-record stats operators actually see.
 *
 * <p>Opt-in — it seeds thousands of entities. Enable with {@code -DrdfScale=true}, size it with
 * {@code -DrdfScaleTables=5000} and {@code -DrdfScaleWideEvery=100}.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfIndexAppScaleIT {

  private static final String APP_NAME = "RdfIndexApp";

  @Test
  void reindexSeededCatalogAndReportThroughput(TestNamespace namespace) throws Exception {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "RDF is disabled; run with -DenableRdf=true");
    assumeTrue(Boolean.getBoolean("rdfScale"), "Scale run is opt-in; enable with -DrdfScale=true");
    assumeFalse(TestSuiteBootstrap.isK8sEnabled(), "App trigger is not compatible with K8s");

    int tableCount = Integer.getInteger("rdfScaleTables", 2000);
    int wideEvery = Integer.getInteger("rdfScaleWideEvery", 100);
    int wideColumns = Integer.getInteger("rdfScaleWideColumns", 500);

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);

    long seedStart = System.nanoTime();
    int created = seedTables(namespace, schema, tableCount, wideEvery, wideColumns);
    double seedSeconds = (System.nanoTime() - seedStart) / 1e9;
    System.out.printf(
        "seeded %d tables in %.1fs (%.0f/s)%n", created, seedSeconds, created / seedSeconds);

    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    Long previousStart = latestRunStart(httpClient);

    long runStart = System.nanoTime();
    trigger(httpClient);
    AppRunRecord run = awaitCompletion(httpClient, previousStart);
    double runSeconds = (System.nanoTime() - runStart) / 1e9;

    Map<String, Object> jobStats = jobStats(run);
    long total = asLong(jobStats.get("totalRecords"));
    long success = asLong(jobStats.get("successRecords"));
    long failed = asLong(jobStats.get("failedRecords"));

    System.out.println("---- RdfIndexApp end-to-end ----");
    System.out.printf(
        "seeded tables   : %d (every %dth wide with %d columns)%n",
        created, wideEvery, wideColumns);
    System.out.printf("status          : %s%n", run.getStatus());
    System.out.printf("app wall clock  : %.1f s%n", runSeconds);
    System.out.printf("records         : total=%d success=%d failed=%d%n", total, success, failed);
    System.out.printf("throughput      : %.0f records/s%n", success / Math.max(runSeconds, 1e-9));
    if (run.getStartTime() != null && run.getEndTime() != null) {
      System.out.printf(
          "app-reported    : %.1f s%n", (run.getEndTime() - run.getStartTime()) / 1000.0);
    }

    System.out.printf(
        "app timings    : total=%dms reader=%dms process=%dms sink=%dms%n",
        asLong(jobStats.get("totalTimeMs")),
        asLong(jobStats.get("readerTimeMs")),
        asLong(jobStats.get("processTimeMs")),
        asLong(jobStats.get("sinkTimeMs")));

    assertTrue(success > 0, "the run must index something");
    assertTrue(
        failed == 0, () -> "no record should fail a healthy run, saw " + failed + ": " + run);
  }

  private int seedTables(
      TestNamespace namespace, DatabaseSchema schema, int count, int wideEvery, int wideColumns)
      throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(8);
    AtomicInteger created = new AtomicInteger();
    try {
      List<Future<?>> futures = new ArrayList<>();
      for (int i = 0; i < count; i++) {
        final int index = i;
        futures.add(
            pool.submit(
                () -> {
                  int columns = wideEvery > 0 && index % wideEvery == 0 ? wideColumns : 7;
                  Tables.create(
                      new CreateTable()
                          .withName(namespace.prefix("scale_" + index))
                          .withDatabaseSchema(schema.getFullyQualifiedName())
                          .withDescription("RDF scale fixture " + index)
                          .withColumns(columns(columns)));
                  created.incrementAndGet();
                }));
      }
      for (Future<?> future : futures) {
        future.get();
      }
    } finally {
      pool.shutdown();
      pool.awaitTermination(5, TimeUnit.MINUTES);
    }
    return created.get();
  }

  private static List<Column> columns(int count) {
    List<Column> columns = new ArrayList<>(count);
    for (int c = 0; c < count; c++) {
      columns.add(
          new Column()
              .withName("col_" + c)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255)
              .withDescription("Scale fixture column " + c));
    }
    return columns;
  }

  private static void trigger(HttpClient httpClient) {
    Map<String, Object> config = new HashMap<>();
    config.put("entities", List.of("table"));
    config.put("recreateIndex", true);
    config.put("batchSize", 100);
    config.put("producerThreads", 2);
    config.put("consumerThreads", 3);
    config.put("queueSize", 5000);
    config.put("useDistributedIndexing", Boolean.getBoolean("rdfScaleDistributed"));
    config.put("partitionSize", 10000);
    Awaitility.await("Trigger " + APP_NAME)
        .atMost(Duration.ofMinutes(3))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptionsMatching(
            error -> error.getMessage() != null && error.getMessage().contains("already running"))
        .until(
            () -> {
              httpClient.execute(
                  HttpMethod.POST, "/v1/apps/trigger/" + APP_NAME, config, Void.class);
              return true;
            });
  }

  private static AppRunRecord awaitCompletion(HttpClient httpClient, Long previousStart) {
    AppRunRecord[] completed = new AppRunRecord[1];
    Awaitility.await("RDF scale reindex completion")
        .atMost(Duration.ofMinutes(60))
        .pollDelay(Duration.ofSeconds(2))
        .pollInterval(Duration.ofSeconds(10))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              AppRunRecord run =
                  httpClient.execute(
                      HttpMethod.GET,
                      "/v1/apps/name/" + APP_NAME + "/runs/latest",
                      null,
                      AppRunRecord.class);
              assertNotNull(run);
              assertNotNull(run.getStatus());
              if (previousStart != null
                  && run.getStartTime() != null
                  && run.getStartTime() <= previousStart) {
                throw new AssertionError("waiting for the newly triggered run");
              }
              String status = run.getStatus().value();
              assertTrue(
                  List.of("completed", "success", "failed", "activeError", "stopped")
                      .contains(status),
                  "run still in progress: " + status);
              completed[0] = run;
            });
    return completed[0];
  }

  private static Long latestRunStart(HttpClient httpClient) {
    try {
      AppRunRecord run =
          httpClient.execute(
              HttpMethod.GET,
              "/v1/apps/name/" + APP_NAME + "/runs/latest",
              null,
              AppRunRecord.class);
      return run == null ? null : run.getStartTime();
    } catch (Exception e) {
      return null;
    }
  }

  /** stats is a declared field on the context, not an additional property, so read the JSON. */
  private static Map<String, Object> jobStats(AppRunRecord run) {
    try {
      com.fasterxml.jackson.databind.JsonNode root =
          org.openmetadata.schema.utils.JsonUtils.readTree(
              org.openmetadata.schema.utils.JsonUtils.pojoToJson(run));
      for (String context : List.of("successContext", "failureContext")) {
        com.fasterxml.jackson.databind.JsonNode job =
            root.path(context).path("stats").path("jobStats");
        if (!job.isMissingNode() && job.has("totalRecords")) {
          Map<String, Object> stats = new HashMap<>();
          job.fields()
              .forEachRemaining(entry -> stats.put(entry.getKey(), entry.getValue().asLong()));
          return stats;
        }
      }
    } catch (Exception e) {
      System.out.println("could not read job stats: " + e);
    }
    return Map.of();
  }

  private static long asLong(Object value) {
    return value instanceof Number number ? number.longValue() : 0L;
  }
}

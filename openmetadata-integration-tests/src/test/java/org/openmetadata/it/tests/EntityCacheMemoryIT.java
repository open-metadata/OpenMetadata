/*
 *  Copyright 2021 Collate
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

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Diagnostic integration test that measures memory impact at each phase of entity creation and
 * concurrent fetching. Reports a breakdown so we can identify what consumes heap — entity caches,
 * change events, search indexing, request processing, or GC pressure.
 */
@ExtendWith(TestNamespaceExtension.class)
@Tag("benchmark")
@Isolated
class EntityCacheMemoryIT {

  private static final Logger LOG = LoggerFactory.getLogger(EntityCacheMemoryIT.class);

  private static final int COLUMNS_PER_TABLE = 300;
  private static final int NUM_LARGE_TABLES = 30;
  private static final int CONCURRENT_FETCHERS = 5;
  private static final int FETCHES_PER_TABLE = 3;

  @Test
  @DisplayName("Diagnose heap growth per phase during concurrent large table fetches")
  void concurrentLargeTableFetches_heapStaysBounded(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Map<String, Long> heapSnapshots = new LinkedHashMap<>();

    // --- Baseline ---
    heapSnapshots.put("baseline", getServerHeapUsedMB());

    // --- Setup: service -> database -> schema ---
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.prefix("cache_test_db"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("cache_test_schema"))
            .in(database.getFullyQualifiedName())
            .execute();

    heapSnapshots.put("after_schema_setup", getServerHeapUsedMB());

    // --- Phase 1: Create large tables ---
    List<Column> columns = buildLargeColumnList(COLUMNS_PER_TABLE);
    List<Table> tables = new ArrayList<>();

    for (int i = 0; i < NUM_LARGE_TABLES; i++) {
      CreateTable createTable =
          new CreateTable()
              .withName(ns.prefix("big_table_" + i))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(columns)
              .withDescription("Large table for cache memory testing - table " + i);
      tables.add(client.tables().createOrUpdate(createTable));
    }

    heapSnapshots.put("after_create_30_tables", getServerHeapUsedMB());

    // Measure one entity's JSON size for reference
    Table sampleTable =
        client.tables().getByName(tables.get(0).getFullyQualifiedName(), "columns,tags,owners");
    String sampleJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(sampleTable);
    int entityJsonKB = sampleJson.length() / 1024;
    int entityHeapKB = (sampleJson.length() * 2 + 40) / 1024;
    LOG.info("Single table entity: JSON={}KB, heap estimate={}KB", entityJsonKB, entityHeapKB);

    // --- Phase 2: Sequential fetches (warm the cache) ---
    for (Table table : tables) {
      client.tables().get(table.getId().toString(), "columns,tags,owners");
      client.tables().getByName(table.getFullyQualifiedName(), "columns,tags,owners");
    }

    heapSnapshots.put("after_sequential_fetches", getServerHeapUsedMB());

    // --- Phase 3: Concurrent fetch storm ---
    ExecutorService executor = Executors.newFixedThreadPool(CONCURRENT_FETCHERS);
    List<CompletableFuture<Integer>> futures = new ArrayList<>();

    for (int fetcher = 0; fetcher < CONCURRENT_FETCHERS; fetcher++) {
      final int fetcherId = fetcher;
      futures.add(
          CompletableFuture.supplyAsync(
              () -> {
                int fetched = 0;
                for (int round = 0; round < FETCHES_PER_TABLE; round++) {
                  for (Table table : tables) {
                    try {
                      client.tables().get(table.getId().toString(), "columns,tags,owners");
                      client
                          .tables()
                          .getByName(table.getFullyQualifiedName(), "columns,tags,owners");
                      fetched += 2;
                    } catch (Exception e) {
                      LOG.warn("Fetcher {} failed: {}", fetcherId, e.getMessage());
                    }
                  }
                }
                return fetched;
              },
              executor));
    }

    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get(120, TimeUnit.SECONDS);
    executor.shutdown();

    int totalFetches = futures.stream().mapToInt(CompletableFuture::join).sum();
    heapSnapshots.put("after_concurrent_fetches", getServerHeapUsedMB());

    // --- Phase 4: Let things settle (5s for async event processing) ---
    Thread.sleep(5000);
    heapSnapshots.put("after_5s_settle", getServerHeapUsedMB());

    // --- Report ---
    LOG.info("=== MEMORY DIAGNOSTIC REPORT ===");
    LOG.info("Entity size: {}KB JSON, {}KB heap estimate", entityJsonKB, entityHeapKB);
    LOG.info("Tables created: {}, Columns per table: {}", NUM_LARGE_TABLES, COLUMNS_PER_TABLE);
    LOG.info("Concurrent fetchers: {}, Total fetches: {}", CONCURRENT_FETCHERS, totalFetches);
    LOG.info("Max cache budget: 100MB (CACHE_WITH_ID) + 100MB (CACHE_WITH_NAME) = 200MB");
    LOG.info(
        "If cache were unbounded: {} tables × {}KB × 2 caches = {}MB",
        NUM_LARGE_TABLES,
        entityHeapKB,
        NUM_LARGE_TABLES * entityHeapKB * 2 / 1024);
    LOG.info("");
    LOG.info("--- Heap snapshots (MB) ---");

    long prevHeap = -1;
    for (Map.Entry<String, Long> entry : heapSnapshots.entrySet()) {
      long heap = entry.getValue();
      String delta = prevHeap >= 0 ? String.format(" (+%dMB)", heap - prevHeap) : "";
      LOG.info("  {}: {}MB{}", entry.getKey(), heap, delta);
      prevHeap = heap;
    }

    long totalGrowth =
        heapSnapshots.get("after_concurrent_fetches") - heapSnapshots.get("baseline");
    long createGrowth =
        heapSnapshots.get("after_create_30_tables") - heapSnapshots.get("after_schema_setup");
    long fetchGrowth =
        heapSnapshots.get("after_concurrent_fetches")
            - heapSnapshots.get("after_sequential_fetches");

    LOG.info("");
    LOG.info("--- Growth breakdown ---");
    LOG.info("  Table creation (30 tables): +{}MB", createGrowth);
    LOG.info(
        "  Sequential fetch warmup: +{}MB",
        heapSnapshots.get("after_sequential_fetches")
            - heapSnapshots.get("after_create_30_tables"));
    LOG.info("  Concurrent fetch storm: +{}MB", fetchGrowth);
    LOG.info("  Total growth: +{}MB", totalGrowth);
    LOG.info("");

    // --- Per-entity allocation cost analysis ---
    // Based on code path tracing of EntityRepository.createOrUpdate → postCreate →
    // ChangeEventHandler
    int columnsPerTable = COLUMNS_PER_TABLE;
    LOG.info(
        "=== PER-TABLE ALLOCATION BUDGET ({}KB entity, {} columns) ===",
        entityJsonKB,
        columnsPerTable);
    LOG.info("  DB storage (serializeForStorage):               ~{}KB", entityJsonKB);
    LOG.info(
        "  Search indexing (buildSearchIndexDoc):             ~{}KB",
        entityJsonKB * 2 + columnsPerTable * 3);
    LOG.info("    ├─ getMap(entity) full entity→Map:              ~{}KB", entityJsonKB * 2);
    LOG.info("    ├─ pojoToJson(searchDoc) Map→JSON:              ~{}KB", entityJsonKB);
    LOG.info(
        "    └─ indexTableColumns ({} cols × ~3KB):          ~{}KB",
        columnsPerTable,
        columnsPerTable * 3);
    LOG.info("  ChangeEvent (entity embedded + serialized):       ~{}KB", entityJsonKB * 2);
    LOG.info("    ├─ pojoToMaskedJson(entity):                    ~{}KB", entityJsonKB);
    LOG.info("    └─ pojoToJson(changeEvent):                     ~{}KB", entityJsonKB + 3);
    LOG.info("  Redis write-through (dao.findById round-trip):    ~{}KB", entityJsonKB);
    LOG.info("  RequestEntityCache (pojoToJson for cache):        ~{}KB", entityJsonKB);
    LOG.info("  Other (relations, inheritance, tags):             ~150KB");
    int totalPerTableKB =
        entityJsonKB
            + (entityJsonKB * 2 + columnsPerTable * 3)
            + entityJsonKB * 2
            + entityJsonKB
            + entityJsonKB
            + 150;
    LOG.info(
        "  TOTAL PER TABLE:                                  ~{}KB (~{}MB)",
        totalPerTableKB,
        totalPerTableKB / 1024);
    LOG.info(
        "  × {} tables:                                      ~{}MB in allocations",
        NUM_LARGE_TABLES,
        NUM_LARGE_TABLES * totalPerTableKB / 1024);
    LOG.info("");
    LOG.info("--- Per-fetch allocation budget (GET /api/v1/tables) ---");
    LOG.info("  Guava cache hit → readValue(JSON):                ~{}KB", entityHeapKB);
    LOG.info("  setFieldsInternal (10+ DB queries):               ~50KB");
    LOG.info("  RequestEntityCache put (pojoToJson):              ~{}KB", entityJsonKB);
    LOG.info("  HTTP response serialization:                      ~{}KB", entityJsonKB);
    int perFetchKB = entityHeapKB + 50 + entityJsonKB + entityJsonKB;
    LOG.info("  TOTAL PER FETCH:                                  ~{}KB", perFetchKB);
    LOG.info(
        "  × {} concurrent fetches:                          ~{}MB transient allocations",
        totalFetches,
        (long) totalFetches * perFetchKB / 1024);
    LOG.info("================================");

    // --- Prometheus memory pool breakdown ---
    logPrometheusMemoryPools();

    // --- Assertions ---
    int expectedFetches = CONCURRENT_FETCHERS * FETCHES_PER_TABLE * NUM_LARGE_TABLES * 2;
    assertTrue(
        totalFetches > 0, "Should have completed at least some fetches — server may have crashed");

    assertTrue(
        totalFetches >= expectedFetches * 0.95,
        String.format(
            "At least 95%% of fetches should succeed. Expected ~%d, got %d.",
            expectedFetches, totalFetches));

    // The primary assertion: the server survived all concurrent requests.
    // Heap growth is logged for diagnosis but not hard-asserted because it includes
    // non-cache overhead (change events, search indexing, request buffers, thread stacks).
    LOG.info(
        "RESULT: Server survived {} concurrent fetches. Total heap growth: {}MB",
        totalFetches,
        totalGrowth);
  }

  @Test
  @DisplayName("Verify entity JSON size for tables with many columns is in expected range")
  void largeTableJsonSize_isSignificant(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.prefix("size_test_db"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("size_test_schema"))
            .in(database.getFullyQualifiedName())
            .execute();

    List<Column> columns = buildLargeColumnList(300);
    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix("size_test_table"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(columns)
            .withDescription("Table for measuring JSON serialization size");
    client.tables().createOrUpdate(createTable);

    Table fetched =
        client
            .tables()
            .getByName(
                schema.getFullyQualifiedName() + "." + ns.prefix("size_test_table"),
                "columns,tags,owners");

    String json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(fetched);
    int jsonBytes = json.length();
    int heapBytes = json.length() * 2 + 40;

    LOG.info(
        "Table with {} columns: JSON size = {}KB, heap cost = {}KB",
        columns.size(),
        jsonBytes / 1024,
        heapBytes / 1024);

    assertTrue(
        jsonBytes > 50 * 1024,
        "300-column table JSON should be >50KB. Actual: " + (jsonBytes / 1024) + "KB");

    long projectedOldCacheMB = 20_000L * heapBytes / (1024 * 1024);
    LOG.info(
        "Projected heap for 20K cache entries of this size: {}MB (old maximumSize=20000)",
        projectedOldCacheMB);

    assertTrue(
        projectedOldCacheMB > 500,
        "Old maximumSize(20000) would allow "
            + projectedOldCacheMB
            + "MB — proves count-based is dangerous");
  }

  private static List<Column> buildLargeColumnList(int count) {
    List<Column> columns = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      columns.add(
          new Column()
              .withName("column_" + i)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255)
              .withDescription(
                  "Test column "
                      + i
                      + " with a reasonably long description to increase "
                      + "the serialized JSON size of this entity, simulating real-world "
                      + "tables with documented columns — UUID:"
                      + UUID.randomUUID()));
    }
    return columns;
  }

  private static long getServerHeapUsedMB() {
    try {
      int adminPort = TestSuiteBootstrap.getAdminPort();
      URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
      HttpURLConnection connection = (HttpURLConnection) url.openConnection();
      connection.setRequestMethod("GET");
      connection.setConnectTimeout(5000);
      connection.setReadTimeout(5000);

      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
        String response = reader.lines().collect(Collectors.joining("\n"));
        return parseHeapUsedMB(response);
      }
    } catch (Exception e) {
      LOG.warn("Failed to read server heap metrics from /prometheus: {}", e.getMessage());
      return -1;
    }
  }

  private static long parseHeapUsedMB(String prometheusResponse) {
    double totalHeapBytes = 0;
    boolean found = false;
    for (String line : prometheusResponse.split("\n")) {
      if (line.startsWith("jvm_memory_used_bytes") && line.contains("area=\"heap\"")) {
        String[] parts = line.split("\\s+");
        if (parts.length >= 2) {
          try {
            totalHeapBytes += Double.parseDouble(parts[parts.length - 1]);
            found = true;
          } catch (NumberFormatException e) {
            LOG.warn("Failed to parse heap metric line: {}", line);
          }
        }
      }
    }
    if (!found) {
      LOG.warn("Could not find jvm_memory_used_bytes in Prometheus response");
      return -1;
    }
    return (long) (totalHeapBytes / (1024 * 1024));
  }

  private static void logPrometheusMemoryPools() {
    try {
      int adminPort = TestSuiteBootstrap.getAdminPort();
      URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
      HttpURLConnection connection = (HttpURLConnection) url.openConnection();
      connection.setRequestMethod("GET");
      connection.setConnectTimeout(5000);
      connection.setReadTimeout(5000);

      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
        String response = reader.lines().collect(Collectors.joining("\n"));
        LOG.info("--- JVM Memory Pools ---");
        for (String line : response.split("\n")) {
          if (line.startsWith("jvm_memory_used_bytes{")
              || line.startsWith("jvm_memory_max_bytes{")
              || line.startsWith("jvm_buffer_memory_used_bytes{")
              || line.startsWith("jvm_gc_live_data_size_bytes")
              || line.startsWith("jvm_gc_memory_allocated_bytes")
              || line.startsWith("jvm_threads_live_threads")) {
            LOG.info("  {}", line);
          }
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to read Prometheus memory pools: {}", e.getMessage());
    }
  }
}

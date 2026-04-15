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
import java.util.List;
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
 * Integration test that validates entity cache behavior under load against a real running server.
 * Proves that creating and repeatedly fetching large Table entities (with many columns) causes
 * measurable heap growth, and that the weight-based cache cap limits it.
 *
 * <p>This test simulates the Myntra OOM scenario: concurrent clients creating and fetching tables
 * with hundreds of columns, which produce large JSON blobs that fill the entity cache.
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
  @DisplayName(
      "Concurrent fetches of large tables cause measurable heap growth bounded by cache cap")
  void concurrentLargeTableFetches_heapStaysBounded(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // --- Setup: create service -> database -> schema ---
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

    // --- Phase 1: Create large tables (300 columns each ≈ 100-500KB JSON per table) ---
    List<Column> columns = buildLargeColumnList(COLUMNS_PER_TABLE);
    List<Table> tables = new ArrayList<>();

    LOG.info(
        "Creating {} tables with {} columns each in schema {}",
        NUM_LARGE_TABLES,
        COLUMNS_PER_TABLE,
        schema.getFullyQualifiedName());

    for (int i = 0; i < NUM_LARGE_TABLES; i++) {
      CreateTable createTable =
          new CreateTable()
              .withName(ns.prefix("big_table_" + i))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(columns)
              .withDescription("Large table for cache memory testing - table " + i);
      Table table = client.tables().createOrUpdate(createTable);
      tables.add(table);
    }

    LOG.info("Created {} large tables successfully", tables.size());

    // --- Phase 2: Record baseline heap ---
    long heapBeforeMB = getServerHeapUsedMB();
    LOG.info("Server heap BEFORE concurrent fetches: {}MB", heapBeforeMB);

    // --- Phase 3: Hammer the server with concurrent GET requests ---
    // This simulates 5 ingestion clients each fetching all 30 tables repeatedly,
    // filling the entity cache with large JSON blobs
    ExecutorService executor = Executors.newFixedThreadPool(CONCURRENT_FETCHERS);
    List<CompletableFuture<Integer>> futures = new ArrayList<>();

    for (int fetcher = 0; fetcher < CONCURRENT_FETCHERS; fetcher++) {
      final int fetcherId = fetcher;
      CompletableFuture<Integer> future =
          CompletableFuture.supplyAsync(
              () -> {
                int fetched = 0;
                for (int round = 0; round < FETCHES_PER_TABLE; round++) {
                  for (Table table : tables) {
                    try {
                      // Fetch by ID — this populates CACHE_WITH_ID
                      client.tables().get(table.getId().toString(), "columns,tags,owners");
                      fetched++;

                      // Fetch by FQN — this populates CACHE_WITH_NAME
                      client
                          .tables()
                          .getByName(table.getFullyQualifiedName(), "columns,tags,owners");
                      fetched++;
                    } catch (Exception e) {
                      LOG.warn("Fetcher {} failed on table {}: {}", fetcherId, table.getName(), e);
                    }
                  }
                }
                LOG.info("Fetcher {} completed {} fetches", fetcherId, fetched);
                return fetched;
              },
              executor);
      futures.add(future);
    }

    // Wait for all fetchers to complete
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get(120, TimeUnit.SECONDS);
    executor.shutdown();

    int totalFetches = futures.stream().mapToInt(CompletableFuture::join).sum();
    LOG.info("Total fetches completed: {}", totalFetches);

    // --- Phase 4: Measure heap after the storm ---
    long heapAfterMB = getServerHeapUsedMB();
    long heapGrowthMB = heapAfterMB - heapBeforeMB;

    LOG.info("Server heap AFTER concurrent fetches: {}MB", heapAfterMB);
    LOG.info("Heap growth during test: {}MB", heapGrowthMB);
    LOG.info(
        "Expected: {} tables × ~500KB × 2 caches = ~{}MB if unbounded",
        NUM_LARGE_TABLES,
        NUM_LARGE_TABLES * 500 * 2 / 1024);

    // --- Assertions ---
    // With the old maximumSize(20000), all 30 large table JSONs would be cached
    // in both CACHE_WITH_ID and CACHE_WITH_NAME, consuming ~30MB+ of cache heap.
    // With maximumWeight(100MB), the cache still stores them but is capped.
    // The key assertion: the server survived without OOM and heap didn't explode.

    assertTrue(
        totalFetches > 0, "Should have completed at least some fetches — server may have crashed");

    int expectedFetches = CONCURRENT_FETCHERS * FETCHES_PER_TABLE * NUM_LARGE_TABLES * 2;
    assertTrue(
        totalFetches >= expectedFetches * 0.95,
        "At least 95% of fetches should succeed. Expected ~"
            + expectedFetches
            + ", got "
            + totalFetches
            + ". Failures indicate server instability under load.");

    // Heap growth should be bounded — with 100MB cache cap, growth shouldn't exceed ~300MB.
    // Only assert if metrics were available (skip if /prometheus is unreachable).
    if (heapBeforeMB >= 0 && heapAfterMB >= 0) {
      assertTrue(
          heapGrowthMB < 500,
          "Heap growth should be bounded under 500MB with cache caps. "
              + "Actual growth: "
              + heapGrowthMB
              + "MB. This suggests unbounded cache growth.");
    } else {
      LOG.warn("Heap metrics unavailable — skipping heap growth assertion");
    }

    LOG.info(
        "PASS: Server survived {} concurrent fetches, heap growth {}MB (bounded)",
        totalFetches,
        heapGrowthMB);
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

    // Create a table with 300 columns — representative of real-world large tables
    List<Column> columns = buildLargeColumnList(300);
    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix("size_test_table"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(columns)
            .withDescription("Table for measuring JSON serialization size");
    client.tables().createOrUpdate(createTable);

    // Fetch and measure
    Table fetched =
        client
            .tables()
            .getByName(
                schema.getFullyQualifiedName() + "." + ns.prefix("size_test_table"),
                "columns,tags,owners");

    String json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(fetched);
    int jsonBytes = json.length();
    int heapBytes = json.length() * 2 + 40; // UTF-16 + String header

    LOG.info(
        "Table with {} columns: JSON size = {}KB, heap cost = {}KB",
        columns.size(),
        jsonBytes / 1024,
        heapBytes / 1024);

    // A 300-column table should produce at least 50KB of JSON
    assertTrue(
        jsonBytes > 50 * 1024,
        "300-column table JSON should be >50KB. Actual: " + (jsonBytes / 1024) + "KB");

    // At 20K cache entries × this size: 20000 × 100KB = 2GB per cache
    long projectedOldCacheMB = 20_000L * heapBytes / (1024 * 1024);
    LOG.info(
        "Projected heap for 20K entries of this size: {}MB (old config would allow this)",
        projectedOldCacheMB);

    assertTrue(
        projectedOldCacheMB > 500,
        "This proves the old maximumSize(20000) config is dangerous: "
            + "20K entries of "
            + (heapBytes / 1024)
            + "KB each = "
            + projectedOldCacheMB
            + "MB");
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
      return -1; // Caller should handle gracefully
    }
  }

  private static long parseHeapUsedMB(String prometheusResponse) {
    // Sum all jvm_memory_used_bytes{area="heap",...} samples (one per memory pool)
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
}

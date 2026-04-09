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

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Benchmark comparing old recursive hard delete vs new FQN prefix hard delete.
 *
 * <p>Default topology: 5 databases × 5 schemas × 400 tables = 10,000 tables per service
 * (~10,031 total entities including service, databases, schemas).
 *
 * <p>Run manually against a local stack:
 *
 * <pre>
 *   mvn verify -pl openmetadata-integration-tests \
 *     -Dgroups=benchmark \
 *     -Dit.test=PrefixDeletionBenchmarkIT \
 *     -Dtest.databases=5    # databases per service (default: 5)
 *     -Dtest.schemas=5      # schemas per database (default: 5)
 *     -Dtest.tables=400     # tables per schema    (default: 400)
 * </pre>
 *
 * <p>NOTE: Setup creates entities sequentially via REST — at ~50ms/call expect ~15 min of
 * data seeding per hierarchy before deletion timing begins.
 *
 * <p>Both deletions are timed end-to-end: the old delete is synchronous; the new prefix
 * delete is async (202), so we poll until the service is gone before recording elapsed time.
 */
@Tag("benchmark")
@Disabled("Manual benchmark — run explicitly against a local mysql/postgres stack")
@ExtendWith(TestNamespaceExtension.class)
class PrefixDeletionBenchmarkIT {

  private static final Logger LOG = LoggerFactory.getLogger(PrefixDeletionBenchmarkIT.class);

  private static final int DATABASES_PER_SERVICE = Integer.getInteger("test.databases", 5);
  private static final int SCHEMAS_PER_DATABASE = Integer.getInteger("test.schemas", 5);
  private static final int TABLES_PER_SCHEMA = Integer.getInteger("test.tables", 400);

  private static final Duration DELETE_POLL_TIMEOUT = Duration.ofMinutes(10);
  private static final Duration DELETE_POLL_INTERVAL = Duration.ofSeconds(2);

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void benchmark_oldRecursiveHardDelete_vs_newPrefixDelete(TestNamespace ns) throws Exception {
    int totalTables = DATABASES_PER_SERVICE * SCHEMAS_PER_DATABASE * TABLES_PER_SCHEMA;
    int totalEntities = 1 + DATABASES_PER_SERVICE
        + DATABASES_PER_SERVICE * SCHEMAS_PER_DATABASE
        + totalTables;
    LOG.info(
        "Benchmark topology: {} databases × {} schemas × {} tables = {} tables, {} total entities per service",
        DATABASES_PER_SERVICE, SCHEMAS_PER_DATABASE, TABLES_PER_SCHEMA, totalTables, totalEntities);

    DatabaseService oldService = buildHierarchy(ns, "old");
    long oldMs = timeOldDelete(oldService);

    DatabaseService newService = buildHierarchy(ns, "new");
    long newMs = timeNewDelete(newService);

    double speedup = (double) oldMs / Math.max(newMs, 1);
    LOG.info("=== Deletion Benchmark Results ({} entities per service) ===", totalEntities);
    LOG.info("  Old recursive hard delete : {} ms", oldMs);
    LOG.info("  New FQN prefix hard delete: {} ms", newMs);
    LOG.info("  Speedup                   : {}x", String.format("%.2f", speedup));
  }

  private DatabaseService buildHierarchy(TestNamespace ns, String tag) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    LOG.info("[{}] Seeding hierarchy under service {} ...", tag, service.getName());

    for (int d = 0; d < DATABASES_PER_SERVICE; d++) {
      Database database = DatabaseTestFactory.createWithName(ns, service.getFullyQualifiedName(), tag + "db" + d);
      for (int s = 0; s < SCHEMAS_PER_DATABASE; s++) {
        DatabaseSchema schema = DatabaseSchemaTestFactory.createWithName(ns, database.getFullyQualifiedName(), tag + "sc" + d + s);
        for (int t = 0; t < TABLES_PER_SCHEMA; t++) {
          TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), tag + "t" + d + s + t);
        }
      }
    }

    LOG.info("[{}] Hierarchy created.", tag);
    return service;
  }

  private long timeOldDelete(DatabaseService service) throws Exception {
    LOG.info("Timing OLD recursive hard delete for service {} ...", service.getName());
    long start = System.currentTimeMillis();

    String url = SdkClients.getServerUrl()
        + "/v1/services/databaseServices/" + service.getId()
        + "?hardDelete=true&recursive=true";
    sendDelete(url);

    long elapsed = System.currentTimeMillis() - start;
    LOG.info("OLD recursive hard delete completed in {} ms", elapsed);
    return elapsed;
  }

  private long timeNewDelete(DatabaseService service) throws Exception {
    LOG.info("Timing NEW FQN prefix hard delete for service {} ...", service.getName());
    long start = System.currentTimeMillis();

    String url = SdkClients.getServerUrl()
        + "/v1/services/databaseServices/prefix/" + service.getId();
    sendDelete(url);

    // Prefix delete is async — poll until the service is actually gone so we measure
    // real deletion time, not just the time to hand off the job to the executor.
    UUID serviceId = service.getId();
    Awaitility.await("Wait for prefix deletion of " + service.getName() + " to complete")
        .atMost(DELETE_POLL_TIMEOUT)
        .pollInterval(DELETE_POLL_INTERVAL)
        .until(() -> {
          try {
            SdkClients.adminClient().databaseServices().get(serviceId.toString());
            return false;
          } catch (Exception e) {
            return true;
          }
        });

    long elapsed = System.currentTimeMillis() - start;
    LOG.info("NEW FQN prefix hard delete completed in {} ms", elapsed);
    return elapsed;
  }

  private void sendDelete(String url) throws Exception {
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Authorization", "Bearer " + SdkClients.getAdminToken())
        .DELETE()
        .build();
    HttpResponse<String> response =
        HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      throw new RuntimeException(
          "Delete failed with status " + response.statusCode() + ": " + response.body());
    }
  }
}

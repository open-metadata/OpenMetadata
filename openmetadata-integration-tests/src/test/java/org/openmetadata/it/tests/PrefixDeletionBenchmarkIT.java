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
import java.util.HashMap;
import java.util.Map;
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
 * <p>Run manually against a local stack with a pre-populated database:
 *
 * <pre>
 *   mvn verify -pl openmetadata-integration-tests \
 *     -Dgroups=benchmark \
 *     -Dit.test=PrefixDeletionBenchmarkIT \
 *     -Dtest.scenario=100   # tables per schema (default: 50)
 * </pre>
 *
 * <p>Results are printed to the log. The prefix approach should be 3-10x faster for large
 * hierarchies because it issues one bulk DELETE per table vs one round-trip per entity.
 */
@Tag("benchmark")
@Disabled("Manual benchmark — run explicitly against a local mysql/postgres stack")
@ExtendWith(TestNamespaceExtension.class)
class PrefixDeletionBenchmarkIT {

  private static final Logger LOG = LoggerFactory.getLogger(PrefixDeletionBenchmarkIT.class);

  private static final int DATABASES_PER_SERVICE = 2;
  private static final int SCHEMAS_PER_DATABASE = 2;
  private static final int TABLES_PER_SCHEMA =
      Integer.getInteger("test.scenario", 50);

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void benchmark_oldRecursiveHardDelete_vs_newPrefixDelete(TestNamespace ns) throws Exception {
    int totalTables = DATABASES_PER_SERVICE * SCHEMAS_PER_DATABASE * TABLES_PER_SCHEMA;
    LOG.info(
        "Benchmark: {} databases × {} schemas × {} tables = {} total tables per service",
        DATABASES_PER_SERVICE, SCHEMAS_PER_DATABASE, TABLES_PER_SCHEMA, totalTables);

    DatabaseService oldService = buildHierarchy(ns, "old");
    long oldMs = timeOldDelete(oldService);

    DatabaseService newService = buildHierarchy(ns, "new");
    long newMs = timeNewDelete(newService);

    double speedup = (double) oldMs / Math.max(newMs, 1);
    LOG.info("=== Deletion Benchmark Results ({} tables per service) ===", totalTables);
    LOG.info("  Old recursive hard delete : {} ms", oldMs);
    LOG.info("  New FQN prefix hard delete: {} ms", newMs);
    LOG.info("  Speedup                   : {:.2f}x", speedup);
  }

  private DatabaseService buildHierarchy(TestNamespace ns, String tag) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    LOG.info("[{}] Creating hierarchy under service: {}", tag, service.getName());

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
    LOG.info("Starting OLD recursive hard delete for service {}", service.getName());
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
    LOG.info("Starting NEW FQN prefix hard delete for service {}", service.getName());
    long start = System.currentTimeMillis();

    String url = SdkClients.getServerUrl()
        + "/v1/services/databaseServices/prefix/" + service.getId();
    sendDelete(url);

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

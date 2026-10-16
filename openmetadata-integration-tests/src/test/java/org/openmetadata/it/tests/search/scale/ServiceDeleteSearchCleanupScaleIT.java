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

package org.openmetadata.it.tests.search.scale;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.SeedData;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Scale regression for the bulk service-delete search cascade. Seeds a {@code databaseService} with
 * {@value #DEFAULT_TABLES} tables (override with {@code -Djpw.scale.tables=N}), each carrying
 * {@value #COLUMNS_PER_TABLE} columns, recursively hard-deletes the service, and asserts the search
 * index is fully clean — both the {@code table_search_index} docs AND the {@code column_search_index}
 * docs scoped to that service drop to zero.
 *
 * <p>The column-doc assertion is the regression PR #29322 introduced: the recursive hard delete
 * skips the per-table search dispatch ({@code descendantsCoveredByAncestorCascade}) and the
 * ancestor {@code service.id} cascade did not cover the flat {@code column_search_index}, so at
 * scale every descendant column doc orphaned in search. Counts are scoped by {@code service.id} so
 * the assertion is exact regardless of what else the cluster holds.
 *
 * <p>Tagged {@code @scale} so PR runs skip it; the nightly scale workflow runs it. Full 100k run:
 *
 * <pre>{@code
 * mvn test -pl openmetadata-integration-tests \
 *   -Dtest=ServiceDeleteSearchCleanupScaleIT -Djpw.scale.tables=100000 -Dgroups=scale
 * }</pre>
 */
@Tag("scale")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
class ServiceDeleteSearchCleanupScaleIT {

  private static final Logger LOG =
      LoggerFactory.getLogger(ServiceDeleteSearchCleanupScaleIT.class);
  private static final int DEFAULT_TABLES = 100_000;
  private static final int COLUMNS_PER_TABLE = 5;
  // Seeding runs through EntityLoader (the same path Scale100kEntitiesIT uses) rather than a
  // local executor. Measured on nightly run 34443597282, both at parallelWorkers=8 against the
  // same cluster and creating 100k tables x 5 columns: EntityLoader took 29m14s (~57 tables/s)
  // where the executor here took 106m51s (~15.6/s). That 3.65x was 42% of the whole 5h workflow.
  //
  // EntityLoader also honours -Djpw.loader.maxWorkers, so one property now governs seed
  // concurrency for every scale test instead of this one reading a second, easily-missed name.
  private static final int LOAD_WORKERS = Integer.getInteger("jpw.scale.workers", 32);
  // How long the search cascade gets to drop this service's docs to zero after the async delete is
  // accepted. On an unloaded cluster this ran in 116s, which is what the original 5 minutes was
  // sized against. It no longer holds: POST /v1/tables now spends ~1.3s server-side per table
  // (db 23ms, search 101ms — the rest is unaccounted resourceCreate time, with a governance
  // workflow firing per table-entityCreated), so by the time this test runs last the cluster is
  // slow enough that the same delete took between 5 and 14 minutes on run 31286594784. Sized to
  // cover that with headroom rather than to hide it — the throughput regression is tracked
  // separately. Override with -Djpw.scale.searchCleanupTimeoutMin.
  private static final Duration SEARCH_CLEANUP_TIMEOUT =
      Duration.ofMinutes(Integer.getInteger("jpw.scale.searchCleanupTimeoutMin", 20));

  private static ServerHandle server;
  private static SearchClient search;
  private static IndexAliasInspector indexAliases;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    search = new SearchClient(server);
    indexAliases = new IndexAliasInspector(server);
  }

  @Test
  void recursiveServiceHardDelete_clearsTableAndColumnDocsAtScale(final TestNamespace ns)
      throws Exception {
    final int tableCount = Integer.getInteger("jpw.scale.tables", DEFAULT_TABLES);

    // EntityLoader builds its own service + schema (ensureTablesSchema) and tracks the service as
    // a namespace root, so it is read back from there rather than created here — creating one up
    // front would leave the seeded tables under a *different* service than the one deleted below,
    // and the scoped doc counts would trivially pass against an empty service.
    final long seedStart = System.currentTimeMillis();
    SeedData.provision(
        EntityLoadSpec.builder()
            .count(EntityKind.TABLE, tableCount)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .parallelWorkers(LOAD_WORKERS)
            .build(),
        ns,
        server);
    LOG.info(
        "Seeded {} tables ({} columns each) in {} ms",
        tableCount,
        COLUMNS_PER_TABLE,
        System.currentTimeMillis() - seedStart);

    final String serviceId = seededServiceId(ns);

    // Resolve the entity indexes via the server (IndexAliasInspector), not the in-JVM
    // Entity.getSearchRepository() — that static is null in external mode, where the OM service
    // runs in a separate JVM. indexNameFor is cluster-alias-aware (e.g.
    // openmetadata_column_search_index) so counts work regardless of clusterAlias.
    final String tableIndex = indexAliases.indexNameFor(Entity.TABLE);
    final String columnIndex = indexAliases.indexNameFor(Entity.TABLE_COLUMN);

    final long expectedColumns = (long) tableCount * COLUMNS_PER_TABLE;
    awaitCount(tableIndex, serviceId, tableCount);
    awaitCount(columnIndex, serviceId, expectedColumns);
    LOG.info(
        "Search seeded for service {}: {} table docs, {} column docs",
        serviceId,
        tableCount,
        expectedColumns);

    final long deleteStart = System.currentTimeMillis();
    recursiveHardDelete(serviceId);
    awaitCount(tableIndex, serviceId, 0);
    awaitCount(columnIndex, serviceId, 0);
    final long deleteMs = System.currentTimeMillis() - deleteStart;
    LOG.info(
        "Recursive async hard delete of {} tables cleared search in {} ms — table docs=0,"
            + " column docs=0",
        tableCount,
        deleteMs);
  }

  /** The databaseService EntityLoader created for this namespace's tables. */
  private static String seededServiceId(final TestNamespace ns) {
    return ns.trackedRoots().stream()
        .filter(root -> Entity.DATABASE_SERVICE.equals(root.entityType()))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalStateException(
                    "EntityLoader seeded no databaseService root into the namespace"))
        .id()
        .toString();
  }

  private void recursiveHardDelete(final String serviceId) {
    // Mirror the UI's service delete: hit the async endpoint (DELETE /databaseServices/async/{id})
    // so the recursive hard delete runs on the server's background executor instead of blocking the
    // request thread — a synchronous 100k-table delete can exceed a proxied cluster's gateway
    // timeout. The endpoint returns 202 immediately; the awaitCount(...) assertions confirm the
    // delete's search cascade actually cleared both indexes. Fetch the admin client fresh (not a
    // captured reference) so the refreshed token is used after a long-running seed.
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            "/v1/services/databaseServices/async/" + serviceId + "?hardDelete=true&recursive=true",
            null,
            Object.class);
  }

  private void awaitCount(final String index, final String serviceId, final long expected) {
    Awaitility.await("count(" + index + ") for service " + serviceId + " == " + expected)
        .atMost(SEARCH_CLEANUP_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertThat(countByService(index, serviceId))
                    .as("doc count in %s for service %s", index, serviceId)
                    .isEqualTo(expected));
  }

  private long countByService(final String index, final String serviceId) {
    final String body = "{\"query\":{\"term\":{\"service.id\":\"" + serviceId + "\"}}}";
    final JsonNode response = search.count(index, body);
    return response.path("count").asLong();
  }
}

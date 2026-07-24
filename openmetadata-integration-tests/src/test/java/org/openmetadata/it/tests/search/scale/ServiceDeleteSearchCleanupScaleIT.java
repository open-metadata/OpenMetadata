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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Scale regression for the bulk service-delete search cascade. Seeds a {@code databaseService} with
 * {@value #DEFAULT_TABLES} tables (override with {@code -Dscale.tables=N}), each carrying
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
 *   -Dtest=ServiceDeleteSearchCleanupScaleIT -Dscale.tables=100000 -Dgroups=scale
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
  // Concurrency is intentionally modest: each create blocks on a synchronous table-doc index, and
  // too many in flight saturates a single-node search engine's write queue. Tune with
  // -Dscale.workers.
  private static final int LOAD_WORKERS = Integer.getInteger("scale.workers", 8);
  private static final int CREATE_TIMEOUT_SECONDS = 300;

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
    final int tableCount = Integer.getInteger("scale.tables", DEFAULT_TABLES);

    final DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    final String serviceId = service.getId().toString();

    // Resolve the entity indexes via the server (IndexAliasInspector), not the in-JVM
    // Entity.getSearchRepository() — that static is null in external mode, where the OM service
    // runs in a separate JVM. indexNameFor is cluster-alias-aware (e.g.
    // openmetadata_column_search_index) so counts work regardless of clusterAlias.
    final String tableIndex = indexAliases.indexNameFor(Entity.TABLE);
    final String columnIndex = indexAliases.indexNameFor(Entity.TABLE_COLUMN);

    final long seedStart = System.currentTimeMillis();
    seedTables(ns, schema.getFullyQualifiedName(), tableCount);
    LOG.info(
        "Seeded {} tables ({} columns each) in {} ms",
        tableCount,
        COLUMNS_PER_TABLE,
        System.currentTimeMillis() - seedStart);

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

  private void seedTables(final TestNamespace ns, final String schemaFqn, final int count) {
    final String namePrefix = ns.prefix("scale_tbl") + "_";
    final ExecutorService executor = Executors.newFixedThreadPool(LOAD_WORKERS);
    try {
      final List<Future<?>> futures = new ArrayList<>(count);
      for (int i = 0; i < count; i++) {
        final int index = i;
        futures.add(
            executor.submit(
                () -> {
                  // Fetch the admin client fresh per task: a 100k seed outlives the operator
                  // token's ~1h TTL, and ExternalTokenRefresher rebuilds SdkClients' cached client
                  // on re-login. A captured reference would pin the pre-refresh (expired) token and
                  // fail mid-seed with "401 Expired token!".
                  SdkClients.adminClient()
                      .tables()
                      .create(
                          new CreateTable()
                              .withName(namePrefix + index)
                              .withDatabaseSchema(schemaFqn)
                              .withColumns(buildColumns()));
                  return null;
                }));
      }
      for (final Future<?> future : futures) {
        future.get(CREATE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
      }
    } catch (final Exception e) {
      throw new IllegalStateException("Failed seeding scale tables", e);
    } finally {
      executor.shutdownNow();
    }
  }

  private List<Column> buildColumns() {
    final List<Column> columns = new ArrayList<>(COLUMNS_PER_TABLE);
    for (int i = 0; i < COLUMNS_PER_TABLE; i++) {
      columns.add(new Column().withName("col_" + i).withDataType(ColumnDataType.STRING));
    }
    return columns;
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
        .atMost(Duration.ofSeconds(300))
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

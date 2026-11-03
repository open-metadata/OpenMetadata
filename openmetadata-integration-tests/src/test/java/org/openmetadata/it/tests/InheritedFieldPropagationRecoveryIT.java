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

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.stream.StreamSupport;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
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
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.Entity;

/**
 * A parent's owner reaches its children through a background update-by-query. The search engine can
 * fail that task after the request returned, e.g. when its open scroll contexts are exhausted under
 * concurrent update- and delete-by-query load. This refuses every scroll while the owner is set, so
 * the task fails for certain, then lifts the limit: the owner must still reach the table, through
 * the replay the failed task queued.
 *
 * <p>Isolated: while scrolls are refused, any other test's update- or delete-by-query would fail too.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class InheritedFieldPropagationRecoveryIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String SCROLL_LIMIT = "search.max_open_scroll_context";

  @Test
  void anOwnerPropagationTheEngineFailedIsReplayed(TestNamespace ns) throws Exception {
    // OpenSearch retries a refused scroll inside the task and completes it once contexts free up,
    // so
    // the failure this replays cannot be forced there; Elasticsearch fails the task outright.
    assumeFalse(
        "opensearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "Elasticsearch fails an update-by-query on a refused scroll; OpenSearch retries it");
    OpenMetadataClient client = SdkClients.adminClient();
    String owner = SharedEntities.get().USER1.getId().toString();
    Database database = createDatabase(client, ns);
    Table table = createTable(client, ns, database);
    long patchedAt = System.currentTimeMillis();

    setScrollLimit("0");
    try {
      database.setOwners(List.of(SharedEntities.get().USER1_REF));
      client.databases().update(database.getId().toString(), database);
      awaitFailedPropagationTask(patchedAt);
    } finally {
      setScrollLimit("null");
    }

    Awaitility.await("the replayed propagation brings the owner to the table")
        .atMost(Duration.ofSeconds(90))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(() -> assertTrue(tableOwners(table).contains(owner)));
  }

  private static Database createDatabase(OpenMetadataClient client, TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(ns.prefix("replay_db"))
                    .withService(service.getFullyQualifiedName()));
    return client.databases().get(database.getId().toString(), "owners");
  }

  private static Table createTable(OpenMetadataClient client, TestNamespace ns, Database database) {
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.prefix("replay_schema"))
                    .withDatabase(database.getFullyQualifiedName()));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix("replay_table"))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(ColumnBuilder.of("id", "BIGINT").build())));
  }

  // The engine keeps a background task's result in .tasks, where its error is stored but not
  // indexed; wait until a propagation task finished with one, so the replay below is the only way
  // the owner can arrive.
  private static void awaitFailedPropagationTask(long since) {
    String query =
        """
        {"size":50,"query":{"bool":{"filter":[
          {"term":{"task.action":"indices:data/write/update/byquery"}},
          {"range":{"task.start_time_in_millis":{"gte":%d}}}]}}}"""
            .formatted(since - 1000);
    Awaitility.await("the engine fails the owner propagation while scrolls are refused")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertTrue(
                    StreamSupport.stream(
                            MAPPER
                                .readTree(search("POST", "/.tasks/_search", query))
                                .path("hits")
                                .path("hits")
                                .spliterator(),
                            false)
                        .anyMatch(hit -> hit.path("_source").hasNonNull("error"))));
  }

  private static List<String> tableOwners(Table table) throws Exception {
    String alias = Entity.getSearchRepository().getClusterAlias();
    String index = (alias == null || alias.isEmpty() ? "" : alias + "_") + "table_search_index";
    JsonNode owners =
        MAPPER
            .readTree(search("GET", "/%s/_doc/%s".formatted(index, table.getId()), null))
            .path("_source")
            .path("owners");
    return StreamSupport.stream(owners.spliterator(), false)
        .map(o -> o.path("id").asText())
        .toList();
  }

  private static void setScrollLimit(String value) throws Exception {
    search(
        "PUT", "/_cluster/settings", "{\"persistent\":{\"%s\":%s}}".formatted(SCROLL_LIMIT, value));
  }

  private static String search(String method, String path, String body) throws Exception {
    Request request = new Request(method, path);
    if (body != null) {
      request.setJsonEntity(body);
    }
    try (Rest5Client client = TestSuiteBootstrap.createSearchClient()) {
      return new String(
          client.performRequest(request).getEntity().getContent().readAllBytes(),
          StandardCharsets.UTF_8);
    }
  }
}

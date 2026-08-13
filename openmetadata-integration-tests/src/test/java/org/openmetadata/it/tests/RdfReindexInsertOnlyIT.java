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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfReindexInsertOnlyIT {

  private static final String APP_NAME = "RdfIndexApp";
  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String SQL_QUERY = "SELECT * FROM insert_only_source";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void recreateRunWritesEntitiesAndDetailedLineageIdempotently(TestNamespace namespace)
      throws Exception {
    assumeTrue(
        RdfTestUtils.isRdfEnabled(),
        "RDF is disabled. Run this test with an RDF integration-test profile.");
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger is not compatible with K8s pipelines");

    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);
    Table source = createTable(namespace, schema, "insertOnlySource");
    Table target = createTable(namespace, schema, "insertOnlyTarget");
    addDetailedLineage(client, source, target);

    HttpClient httpClient = client.getHttpClient();
    waitForCurrentRunCompletion(httpClient);

    AppRunRecord firstRun = triggerAndWait(httpClient, readLatestRunStartTime(httpClient));
    assertExpectedTriples(source, target);

    AppRunRecord secondRun = triggerAndWait(httpClient, firstRun.getStartTime());
    assertExpectedTriples(source, target);
    assertTrue(secondRun.getStartTime() > firstRun.getStartTime());
  }

  private static Table createTable(
      TestNamespace namespace, DatabaseSchema schema, String tableName) {
    CreateTable request =
        new CreateTable()
            .withName(namespace.prefix(tableName))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("RDF insert-only reindex integration fixture")
            .withColumns(
                List.of(
                    ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
                    ColumnBuilder.of("value", "VARCHAR").dataLength(255).build()));
    return Tables.create(request);
  }

  private static void addDetailedLineage(OpenMetadataClient client, Table source, Table target) {
    LineageDetails details = new LineageDetails().withSqlQuery(SQL_QUERY);
    AddLineage request =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(source.getEntityReference())
                    .withToEntity(target.getEntityReference())
                    .withLineageDetails(details));
    assertNotNull(client.lineage().addLineage(request));
  }

  private static AppRunRecord triggerAndWait(HttpClient httpClient, Long previousRunStartTime) {
    trigger(httpClient);
    AppRunRecord[] completedRun = new AppRunRecord[1];
    Awaitility.await("RDF reindex completion")
        .atMost(Duration.ofMinutes(10))
        .pollDelay(Duration.ofSeconds(2))
        .pollInterval(Duration.ofSeconds(5))
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
              assertNotNull(run.getStartTime());
              if (previousRunStartTime != null && run.getStartTime() <= previousRunStartTime) {
                throw new AssertionError("Waiting for the newly triggered RDF reindex run");
              }
              assertTrue(isTerminal(run.getStatus().value()));
              completedRun[0] = run;
            });

    AppRunRecord run = completedRun[0];
    assertTrue(
        "completed".equalsIgnoreCase(run.getStatus().value())
            || "success".equalsIgnoreCase(run.getStatus().value()),
        () -> "RDF reindex failed: " + run);
    return run;
  }

  private static void trigger(HttpClient httpClient) {
    Map<String, Object> config = new HashMap<>();
    // CLEAR ALL affects the shared integration dataset. Reindexing all supported
    // entity types restores the complete graph for tests that run afterward.
    config.put("entities", List.of("all"));
    config.put("recreateIndex", true);
    config.put("batchSize", 100);
    config.put("producerThreads", 2);
    config.put("consumerThreads", 3);
    config.put("queueSize", 5000);
    config.put("useDistributedIndexing", false);
    config.put("partitionSize", 10000);

    Awaitility.await("Trigger " + APP_NAME)
        .atMost(Duration.ofMinutes(2))
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

  private static void assertExpectedTriples(Table source, Table target) throws Exception {
    String sourceUri = entityUri(source);
    String targetUri = entityUri(target);
    String detailsUri = BASE_URI + "lineageDetails/" + source.getId() + "/" + target.getId();

    assertEquals(1, countTriples("<" + sourceUri + "> a <http://www.w3.org/ns/dcat#Dataset>"));
    assertEquals(1, countTriples("<" + targetUri + "> a <http://www.w3.org/ns/dcat#Dataset>"));
    assertEquals(
        1,
        countTriples(
            "<"
                + sourceUri
                + "> <https://open-metadata.org/ontology/UPSTREAM> <"
                + targetUri
                + ">"));
    assertEquals(
        1,
        countTriples(
            "<" + targetUri + "> <http://www.w3.org/ns/prov#wasDerivedFrom> <" + sourceUri + ">"));
    assertEquals(
        1,
        countTriples(
            "<"
                + sourceUri
                + "> <https://open-metadata.org/ontology/hasLineageDetails> <"
                + detailsUri
                + ">"));
    assertEquals(
        1,
        countTriples(
            "<"
                + detailsUri
                + "> <https://open-metadata.org/ontology/sqlQuery> \""
                + SQL_QUERY
                + "\""));
  }

  private static long countTriples(String triplePattern) throws Exception {
    String query =
        "SELECT (COUNT(*) AS ?count) WHERE { GRAPH <"
            + KNOWLEDGE_GRAPH
            + "> { "
            + triplePattern
            + " . } }";
    String response = RdfTestUtils.executeSparqlSelect(query);
    assertNotNull(response, "Fuseki did not return a SPARQL result");
    JsonNode bindings = MAPPER.readTree(response).path("results").path("bindings");
    assertTrue(bindings.isArray() && !bindings.isEmpty(), "SPARQL count result is missing");
    return bindings.get(0).path("count").path("value").asLong();
  }

  private static String entityUri(Table table) {
    return BASE_URI + "entity/table/" + table.getId();
  }

  private static Long readLatestRunStartTime(HttpClient httpClient) {
    try {
      AppRunRecord latest =
          httpClient.execute(
              HttpMethod.GET,
              "/v1/apps/name/" + APP_NAME + "/runs/latest",
              null,
              AppRunRecord.class);
      return latest == null ? null : latest.getStartTime();
    } catch (Exception ignored) {
      return null;
    }
  }

  private static void waitForCurrentRunCompletion(HttpClient httpClient) {
    Awaitility.await("Wait for an in-flight " + APP_NAME)
        .atMost(Duration.ofMinutes(10))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord latest =
                  httpClient.execute(
                      HttpMethod.GET,
                      "/v1/apps/name/" + APP_NAME + "/runs/latest",
                      null,
                      AppRunRecord.class);
              return latest == null
                  || latest.getStatus() == null
                  || isTerminal(latest.getStatus().value());
            });
  }

  private static boolean isTerminal(String status) {
    return "completed".equalsIgnoreCase(status)
        || "success".equalsIgnoreCase(status)
        || "failed".equalsIgnoreCase(status)
        || "activeError".equalsIgnoreCase(status)
        || "stopped".equalsIgnoreCase(status);
  }
}

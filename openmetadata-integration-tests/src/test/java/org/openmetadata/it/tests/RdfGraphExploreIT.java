/*
 *  Copyright 2024 Collate.
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.rdf.RdfUpdater;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for the RDF graph-explore endpoint ({@code GET /v1/rdf/graph/explore}).
 *
 * <p>These tests exercise the endpoint against a live Fuseki store, asserting on the actual
 * returned graph shape (hydrated nodes, edges, depth-controlled traversal). They are gated by the
 * RDF test profile via {@code assumeTrue(RdfTestUtils.isRdfEnabled(), ...)} and skip cleanly when
 * RDF is disabled.
 *
 * <p>Test isolation: Uses {@link TestNamespace} for unique entity naming. The class is
 * {@code @Isolated} because it mutates global RDF state in {@code @BeforeAll}.
 *
 * <p>Authenticated REST calls reuse the harness raw-REST mechanism — {@code java.net.http.HttpClient}
 * with a Bearer token from {@link SdkClients#getAdminToken()} against {@link SdkClients#getServerUrl()}
 * — the same pattern used by {@link RdfRelationExclusionsIT}. The endpoint is admin-only.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfGraphExploreIT {

  private static final Logger LOG = LoggerFactory.getLogger(RdfGraphExploreIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  private static final String TABLE_RDF_TYPE = "dcat:Dataset";
  private static final String ENTITY_TYPE_TABLE = "table";

  @BeforeAll
  static void enableRdf() {
    assumeTrue(
        RdfTestUtils.isRdfEnabled(),
        "RDF is disabled for this test run. Use the RDF test profile to execute RdfGraphExploreIT.");
    RdfConfiguration rdfConfig = new RdfConfiguration();
    rdfConfig.setEnabled(true);
    rdfConfig.setBaseUri(URI.create("https://open-metadata.org/"));
    rdfConfig.setStorageType(RdfConfiguration.StorageType.FUSEKI);
    rdfConfig.setRemoteEndpoint(URI.create(TestSuiteBootstrap.getFusekiEndpoint()));
    rdfConfig.setUsername("admin");
    rdfConfig.setPassword("test-admin");
    rdfConfig.setDataset("openmetadata");
    RdfUpdater.initialize(rdfConfig);
  }

  @AfterAll
  static void disableRdf() {
    RdfUpdater.disable();
  }

  @Test
  void exploreReturnsHydratedGraphShape(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("schema"))
            .in(database.getFullyQualifiedName())
            .execute();

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("rdfExploreTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setDescription("Table for RDF explore shape test");
    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build());
    createRequest.setColumns(columns);

    Table table = Tables.create(createRequest);
    assertNotNull(table.getId());

    awaitTableInRdf(table);

    JsonNode graph = explore(table.getId(), ENTITY_TYPE_TABLE, 2);

    assertEquals("rdf", graph.path("source").asText(), "graph source should be rdf");
    assertFalse(graph.path("truncated").asBoolean(), "small graph should not be truncated");

    JsonNode nodes = graph.path("nodes");
    assertTrue(nodes.isArray() && !nodes.isEmpty(), "graph should contain nodes");
    assertEquals(
        nodes.size(),
        graph.path("totalNodes").asInt(),
        "totalNodes must match the nodes array length");

    JsonNode focal = findNodeByEntityId(graph, table.getId());
    assertNotNull(focal, "focal table node should be present");
    assertFalse(
        focal.path("name").asText("").isBlank(),
        "focal node name must be hydrated via the batch path (N+1 fix regression guard)");
    assertFalse(
        focal.path("fullyQualifiedName").asText("").isBlank(),
        "focal node fullyQualifiedName must be hydrated via the batch path");

    JsonNode edges = graph.path("edges");
    assertTrue(edges.isArray() && !edges.isEmpty(), "graph should contain at least one edge");
    JsonNode firstEdge = edges.get(0);
    assertFalse(firstEdge.path("from").asText("").isBlank(), "edge 'from' should be populated");
    assertFalse(firstEdge.path("to").asText("").isBlank(), "edge 'to' should be populated");
    assertFalse(
        firstEdge.path("relationType").asText("").isBlank(),
        "edge 'relationType' should be populated");
  }

  @Test
  void depthControlsTraversalReach(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("schema"))
            .in(database.getFullyQualifiedName())
            .execute();

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("rdfDepthTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setDescription("Table for RDF depth traversal test");
    createRequest.setColumns(
        List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));

    Table table = Tables.create(createRequest);
    assertNotNull(table.getId());

    awaitTableInRdf(table);

    JsonNode depthOneGraph = explore(table.getId(), ENTITY_TYPE_TABLE, 1);
    Set<String> depthOneIds = collectEntityIds(depthOneGraph);
    assertNoDuplicateNodeIds(depthOneGraph);

    assertTrue(
        depthOneIds.contains(table.getId().toString()),
        "depth=1 must contain the focal table node");
    assertTrue(
        depthOneIds.contains(schema.getId().toString()),
        "depth=1 must contain the immediate schema neighbor (table belongsTo schema)");
    assertFalse(
        depthOneIds.contains(database.getId().toString()),
        "depth=1 must NOT reach the 2-hop database neighbor");

    JsonNode depthTwoGraph = explore(table.getId(), ENTITY_TYPE_TABLE, 2);
    Set<String> depthTwoIds = collectEntityIds(depthTwoGraph);
    assertNoDuplicateNodeIds(depthTwoGraph);

    assertTrue(
        depthTwoIds.containsAll(depthOneIds), "depth=2 node set must contain all depth=1 nodes");
    assertTrue(
        depthTwoIds.size() > depthOneIds.size(),
        "depth=2 node set must strictly grow beyond depth=1");
    assertTrue(
        depthTwoIds.contains(database.getId().toString()),
        "depth=2 must reach the 2-hop database neighbor");
  }

  @Test
  void orphanNeighborDoesNotFailExplore(TestNamespace ns) throws Exception {
    // The batch-hydration orphan-tolerance path (a stale triple pointing at a hard-deleted
    // neighbor) is exercised directly by the unit layer (RdfRepositoryTest). Reproducing the
    // lingering-triple race reliably in this harness is not feasible without flakiness, so we
    // assert the simpler, deterministic invariant instead: a table whose only RDF neighbors are
    // its own ancestors still explores cleanly at depth=1 returning the focal node, with the
    // endpoint returning 200 and never 500.
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("schema"))
            .in(database.getFullyQualifiedName())
            .execute();

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("rdfOrphanTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setDescription("Table for RDF orphan-tolerance test");
    createRequest.setColumns(
        List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));

    Table table = Tables.create(createRequest);
    assertNotNull(table.getId());

    awaitTableInRdf(table);

    HttpResponse<String> response = exploreRaw(table.getId(), ENTITY_TYPE_TABLE, 1);
    assertEquals(200, response.statusCode(), "explore should return 200, never 500");

    JsonNode graph = MAPPER.readTree(response.body());
    assertEquals("rdf", graph.path("source").asText());
    JsonNode focal = findNodeByEntityId(graph, table.getId());
    assertNotNull(focal, "focal table node should still be present");
  }

  // NOTE: A per-method "503 when RDF disabled" assertion is intentionally omitted here. The
  // class-level @BeforeAll enables RDF for the whole class, and toggling it off per-method would
  // fight the harness (and race other @Isolated RDF state). The 503 disabled-path branch of
  // RdfResource.exploreEntityGraph is covered by the RdfResourceTest unit layer.

  private void awaitTableInRdf(Table table) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(20))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(() -> RdfTestUtils.verifyEntityInRdf(table, TABLE_RDF_TYPE));
  }

  private JsonNode explore(UUID entityId, String entityType, int depth) throws Exception {
    HttpResponse<String> response = exploreRaw(entityId, entityType, depth);
    assertEquals(
        200,
        response.statusCode(),
        () ->
            "explore should return 200 but got " + response.statusCode() + ": " + response.body());
    return MAPPER.readTree(response.body());
  }

  private HttpResponse<String> exploreRaw(UUID entityId, String entityType, int depth)
      throws Exception {
    String url =
        SdkClients.getServerUrl()
            + "/v1/rdf/graph/explore?entityId="
            + URLEncoder.encode(entityId.toString(), StandardCharsets.UTF_8)
            + "&entityType="
            + URLEncoder.encode(entityType, StandardCharsets.UTF_8)
            + "&depth="
            + depth;

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private JsonNode findNodeByEntityId(JsonNode graph, UUID entityId) {
    JsonNode match = null;
    String wanted = entityId.toString();
    for (JsonNode node : graph.path("nodes")) {
      if (wanted.equals(node.path("entityId").asText())) {
        match = node;
        break;
      }
    }
    return match;
  }

  private Set<String> collectEntityIds(JsonNode graph) {
    Set<String> ids = new HashSet<>();
    for (JsonNode node : graph.path("nodes")) {
      ids.add(node.path("entityId").asText());
    }
    return ids;
  }

  private void assertNoDuplicateNodeIds(JsonNode graph) {
    Set<String> seen = new HashSet<>();
    for (JsonNode node : graph.path("nodes")) {
      String id = node.path("id").asText();
      assertTrue(seen.add(id), () -> "duplicate node id in graph: " + id);
    }
  }
}

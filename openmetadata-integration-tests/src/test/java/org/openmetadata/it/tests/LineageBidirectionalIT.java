package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

/**
 * Integration tests for the bidirectional searchLineage API (/v1/lineage/getLineage). Verifies that
 * upstream and downstream edges are correctly separated with no duplicates.
 *
 * <p>Topology:
 *
 * <pre>
 *   upstream_a ──→ ROOT ──→ downstream_a ──→ downstream_b
 *   upstream_b ──→ ROOT ──→ downstream_c
 * </pre>
 */
@Execution(ExecutionMode.SAME_THREAD)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class LineageBidirectionalIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private OpenMetadataClient client;
  private TestNamespace namespace;

  private Table upstreamA;
  private Table upstreamB;
  private Table root;
  private Table downstreamA;
  private Table downstreamB;
  private Table downstreamC;

  @BeforeAll
  void setUp() throws Exception {
    client = SdkClients.adminClient();
    namespace = new TestNamespace("LineageBidirIT");

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);
    String schemaFqn = schema.getFullyQualifiedName();

    upstreamA = createTable(schemaFqn, "upstream_a", List.of("id", "name", "email"));
    upstreamB = createTable(schemaFqn, "upstream_b", List.of("id", "code"));
    root = createTable(schemaFqn, "root_table", List.of("id", "name", "email", "code"));
    downstreamA = createTable(schemaFqn, "downstream_a", List.of("id", "name"));
    downstreamB = createTable(schemaFqn, "downstream_b", List.of("id", "name"));
    downstreamC = createTable(schemaFqn, "downstream_c", List.of("id", "code"));

    addLineage(upstreamA, root, "id", "id");
    addLineage(upstreamB, root, "id", "id");
    addLineage(root, downstreamA, "id", "id");
    addLineage(root, downstreamB, "name", "name");
    addLineage(downstreamA, downstreamB, "id", "id");
    addLineage(root, downstreamC, "code", "code");

    waitForSearchIndex(root.getFullyQualifiedName());
  }

  @AfterAll
  void tearDown() {
    safeDelete(downstreamB);
    safeDelete(downstreamC);
    safeDelete(downstreamA);
    safeDelete(root);
    safeDelete(upstreamA);
    safeDelete(upstreamB);
  }

  @Test
  void bidirectionalSearchReturnsNoEdgeDuplicates() throws Exception {
    JsonNode result = searchLineageBidirectional(root, 3, 3);

    Set<String> upstreamEdgeIds = edgeIds(result, "upstreamEdges");
    Set<String> downstreamEdgeIds = edgeIds(result, "downstreamEdges");

    assertFalse(upstreamEdgeIds.isEmpty(), "Expected upstream edges");
    assertFalse(downstreamEdgeIds.isEmpty(), "Expected downstream edges");

    Set<String> overlap = new HashSet<>(upstreamEdgeIds);
    overlap.retainAll(downstreamEdgeIds);
    assertTrue(overlap.isEmpty(), "Duplicate edge IDs in both maps: " + overlap);
  }

  @Test
  void bidirectionalSearchReturnsCorrectUpstreamNodes() throws Exception {
    JsonNode result = searchLineageBidirectional(root, 3, 3);
    JsonNode nodes = result.get("nodes");

    assertNotNull(nodes);
    assertTrue(nodes.has(upstreamA.getFullyQualifiedName()), "Expected upstream_a in nodes");
    assertTrue(nodes.has(upstreamB.getFullyQualifiedName()), "Expected upstream_b in nodes");
  }

  @Test
  void bidirectionalSearchReturnsCorrectDownstreamNodes() throws Exception {
    JsonNode result = searchLineageBidirectional(root, 3, 3);
    JsonNode nodes = result.get("nodes");

    assertNotNull(nodes);
    assertTrue(nodes.has(downstreamA.getFullyQualifiedName()), "Expected downstream_a in nodes");
    assertTrue(nodes.has(downstreamB.getFullyQualifiedName()), "Expected downstream_b in nodes");
    assertTrue(nodes.has(downstreamC.getFullyQualifiedName()), "Expected downstream_c in nodes");
  }

  @Test
  void bidirectionalSearchIncludesRootNode() throws Exception {
    JsonNode result = searchLineageBidirectional(root, 3, 3);
    JsonNode nodes = result.get("nodes");

    assertNotNull(nodes);
    assertTrue(nodes.has(root.getFullyQualifiedName()), "Expected root in nodes");
  }

  @Test
  void bidirectionalSearchUpstreamEdgesOnlyContainUpstreamEntities() throws Exception {
    JsonNode result = searchLineageBidirectional(root, 3, 3);
    JsonNode upstreamEdges = result.get("upstreamEdges");

    assertNotNull(upstreamEdges);
    Set<String> downstreamFqns =
        Set.of(
            downstreamA.getFullyQualifiedName(),
            downstreamB.getFullyQualifiedName(),
            downstreamC.getFullyQualifiedName());

    Iterator<JsonNode> edges = upstreamEdges.elements();
    while (edges.hasNext()) {
      JsonNode edge = edges.next();
      String fromFqn = edge.path("fromEntity").path("fullyQualifiedName").asText();
      String toFqn = edge.path("toEntity").path("fullyQualifiedName").asText();
      assertFalse(
          downstreamFqns.contains(fromFqn) && downstreamFqns.contains(toFqn),
          "Upstream edges should not contain purely downstream edge: " + fromFqn + " → " + toFqn);
    }
  }

  @Test
  void bidirectionalSearchWithDepthZeroUpstreamReturnsOnlyDownstream() throws Exception {
    JsonNode result = searchLineageBidirectional(root, 0, 3);
    JsonNode upstreamEdges = result.get("upstreamEdges");
    JsonNode downstreamEdges = result.get("downstreamEdges");

    assertEquals(0, edgeIds(result, "upstreamEdges").size(), "No upstream edges expected");
    assertFalse(edgeIds(result, "downstreamEdges").isEmpty(), "Expected downstream edges");
  }

  @Test
  void bidirectionalSearchWithDepthZeroDownstreamReturnsOnlyUpstream() throws Exception {
    JsonNode result = searchLineageBidirectional(root, 3, 0);
    JsonNode downstreamEdges = result.get("downstreamEdges");

    assertEquals(0, edgeIds(result, "downstreamEdges").size(), "No downstream edges expected");
    assertFalse(edgeIds(result, "upstreamEdges").isEmpty(), "Expected upstream edges");
  }

  @Test
  void bidirectionalSearchMultiDepthDownstreamReachesDepth2() throws Exception {
    JsonNode result = searchLineageBidirectional(root, 0, 3);
    JsonNode nodes = result.get("nodes");

    assertTrue(nodes.has(downstreamB.getFullyQualifiedName()), "Expected downstream_b at depth 2");
  }

  @Test
  void bidirectionalSearchEdgeCountMatchesTopology() throws Exception {
    JsonNode result = searchLineageBidirectional(root, 3, 3);

    int upstreamCount = edgeIds(result, "upstreamEdges").size();
    int downstreamCount = edgeIds(result, "downstreamEdges").size();

    assertEquals(2, upstreamCount, "Expected 2 upstream edges (upstreamA→root, upstreamB→root)");
    assertEquals(
        4,
        downstreamCount,
        "Expected 4 downstream edges (root→downA, root→downB, downA→downB, root→downC)");
  }

  // --- Helpers ---

  private JsonNode searchLineageBidirectional(Table entity, int upDepth, int downDepth)
      throws Exception {
    String[] result = {null};

    Awaitility.await("searchLineage bidirectional")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              result[0] =
                  client
                      .lineage()
                      .searchLineage(
                          entity.getFullyQualifiedName(), "table", upDepth, downDepth, false);
              return result[0] != null;
            });

    return MAPPER.readTree(result[0]);
  }

  private Set<String> edgeIds(JsonNode result, String edgeMapName) {
    Set<String> ids = new HashSet<>();
    JsonNode edgeMap = result.get(edgeMapName);
    if (edgeMap != null) {
      edgeMap.fieldNames().forEachRemaining(ids::add);
    }
    return ids;
  }

  private Table createTable(String schemaFqn, String name, List<String> columnNames) {
    List<org.openmetadata.schema.type.Column> columns =
        columnNames.stream()
            .map(colName -> new ColumnBuilder(colName, "VARCHAR").dataLength(256).build())
            .toList();

    return client
        .tables()
        .create(
            new CreateTable()
                .withName(namespace.prefix(name))
                .withDatabaseSchema(schemaFqn)
                .withColumns(columns));
  }

  private void addLineage(Table from, Table to, String fromCol, String toCol) {
    LineageDetails details = new LineageDetails();
    details.setColumnsLineage(
        List.of(
            new ColumnLineage()
                .withFromColumns(List.of(from.getFullyQualifiedName() + "." + fromCol))
                .withToColumn(to.getFullyQualifiedName() + "." + toCol)));
    details.setSource(LineageDetails.Source.MANUAL);

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference())
                    .withLineageDetails(details));

    Awaitility.await("Add lineage " + from.getName() + " → " + to.getName())
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              client.lineage().addLineage(addLineage);
              return true;
            });
  }

  private void waitForSearchIndex(String fqn) {
    Awaitility.await("Wait for ES index of " + fqn)
        .atMost(Duration.ofSeconds(90))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              String downResult =
                  client
                      .lineage()
                      .getLineageByEntityCount(fqn, "Downstream", 0, 100, 10, false, null, null);
              JsonNode downNodes = MAPPER.readTree(downResult).get("nodes");
              if (downNodes == null || downNodes.size() < 4) {
                return false;
              }
              String upResult =
                  client
                      .lineage()
                      .getLineageByEntityCount(fqn, "Upstream", 0, 100, 10, false, null, null);
              JsonNode upNodes = MAPPER.readTree(upResult).get("nodes");
              return upNodes != null && upNodes.size() >= 3;
            });
  }

  private void safeDelete(Table table) {
    if (table != null) {
      try {
        client.tables().delete(table.getId());
      } catch (Exception e) {
        // Ignore cleanup failures
      }
    }
  }
}

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashSet;
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
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

/**
 * Integration tests for manual lineage edge creation and persistence. Reproduces the bug where
 * manually created edges (via PUT /v1/lineage) are lost after page refresh.
 *
 * <p>Flow: 1. Create two tables 2. Add manual lineage edge via PUT 3. Verify edge appears in
 * graph-view API (GET /v1/lineage/getLineage) 4. Verify edge appears in directional API (GET
 * /v1/lineage/getLineage/{direction}) 5. Verify edge appears in entity-count API (GET
 * /v1/lineage/getLineageByEntityCount)
 */
@Execution(ExecutionMode.SAME_THREAD)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class LineageManualEdgeIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private OpenMetadataClient client;
  private TestNamespace namespace;

  private Table sourceTable;
  private Table targetTable;

  @BeforeAll
  void setUp() throws Exception {
    client = SdkClients.adminClient();
    namespace = new TestNamespace("LineageManualEdgeIT");

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);
    String schemaFqn = schema.getFullyQualifiedName();

    sourceTable = createTable(schemaFqn, "source_table", List.of("id", "name", "value"));
    targetTable = createTable(schemaFqn, "target_table", List.of("id", "name", "result"));
  }

  @AfterAll
  void tearDown() {
    safeDelete(targetTable);
    safeDelete(sourceTable);
  }

  @Test
  void manualLineageEdgePersistsInGraphView() throws Exception {
    addManualLineage(sourceTable, targetTable);
    waitForEdgeInSearchIndex(sourceTable, targetTable);

    JsonNode result = getGraphViewLineage(sourceTable, 0, 3);
    JsonNode downstreamEdges = result.get("downstreamEdges");
    JsonNode nodes = result.get("nodes");

    assertNotNull(downstreamEdges, "downstreamEdges should not be null");
    assertNotNull(nodes, "nodes should not be null");
    assertTrue(
        nodes.has(targetTable.getFullyQualifiedName()),
        "Target table should appear in downstream nodes");
    assertFalse(edgeFieldNames(downstreamEdges).isEmpty(), "Should have downstream edges");
  }

  @Test
  void manualLineageEdgePersistsInDirectionalView() throws Exception {
    addManualLineage(sourceTable, targetTable);
    waitForEdgeInSearchIndex(sourceTable, targetTable);

    String resultStr =
        callWithRetry(
            () ->
                client
                    .lineage()
                    .searchLineageWithDirection(
                        sourceTable.getFullyQualifiedName(),
                        "Downstream",
                        0,
                        3,
                        false,
                        null,
                        null));
    JsonNode result = MAPPER.readTree(resultStr);
    JsonNode downstreamEdges = result.get("downstreamEdges");

    assertNotNull(downstreamEdges, "downstreamEdges should not be null");
    assertFalse(edgeFieldNames(downstreamEdges).isEmpty(), "Should have downstream edges");

    boolean foundTarget = hasNodeInEdges(downstreamEdges, targetTable.getFullyQualifiedName());
    assertTrue(foundTarget, "Target table should appear in downstream edge endpoints");
  }

  @Test
  void manualLineageEdgePersistsInEntityCountView() throws Exception {
    addManualLineage(sourceTable, targetTable);
    waitForEdgeInSearchIndex(sourceTable, targetTable);

    String resultStr =
        callWithRetry(
            () ->
                client
                    .lineage()
                    .getLineageByEntityCount(
                        sourceTable.getFullyQualifiedName(),
                        "Downstream",
                        0,
                        100,
                        10,
                        false,
                        null,
                        null));
    JsonNode result = MAPPER.readTree(resultStr);
    JsonNode nodes = result.get("nodes");

    assertNotNull(nodes, "nodes should not be null");
    assertTrue(
        nodes.has(targetTable.getFullyQualifiedName()),
        "Target table should appear in entity count results");
  }

  @Test
  void manualLineageEdgeVisibleFromTargetUpstream() throws Exception {
    addManualLineage(sourceTable, targetTable);
    waitForEdgeInSearchIndex(sourceTable, targetTable);

    // Also wait for edge to be indexed from target's perspective
    Awaitility.await("Wait for upstream edge from target")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              String result =
                  client
                      .lineage()
                      .getLineageByEntityCount(
                          targetTable.getFullyQualifiedName(),
                          "Upstream",
                          0,
                          100,
                          10,
                          false,
                          null,
                          null);
              JsonNode nodes = MAPPER.readTree(result).get("nodes");
              return nodes != null && nodes.has(sourceTable.getFullyQualifiedName());
            });

    JsonNode result = getGraphViewLineage(targetTable, 3, 0);
    JsonNode upstreamEdges = result.get("upstreamEdges");
    JsonNode nodes = result.get("nodes");

    assertNotNull(nodes, "nodes should not be null");
    assertTrue(
        nodes.has(sourceTable.getFullyQualifiedName()),
        "Source table should appear in upstream nodes when querying from target");
    assertFalse(edgeFieldNames(upstreamEdges).isEmpty(), "Should have upstream edges");
  }

  @Test
  void manualLineageEdgeHasCorrectSource() throws Exception {
    addManualLineage(sourceTable, targetTable);
    waitForEdgeInSearchIndex(sourceTable, targetTable);

    JsonNode result = getGraphViewLineage(sourceTable, 0, 3);
    JsonNode downstreamEdges = result.get("downstreamEdges");

    boolean foundManualSource = false;
    if (downstreamEdges != null) {
      var edgeIter = downstreamEdges.elements();
      while (edgeIter.hasNext()) {
        JsonNode edge = edgeIter.next();
        JsonNode pipeline = edge.path("pipeline");
        JsonNode source = edge.path("source");
        if (source.asText("").equalsIgnoreCase("Manual")
            || pipeline.path("source").asText("").equalsIgnoreCase("Manual")) {
          foundManualSource = true;
          break;
        }
      }
    }

    assertTrue(foundManualSource, "Edge should have Manual source");
  }

  // --- Helpers ---

  private JsonNode getGraphViewLineage(Table entity, int upDepth, int downDepth) throws Exception {
    String resultStr =
        callWithRetry(
            () ->
                client
                    .lineage()
                    .searchLineage(
                        entity.getFullyQualifiedName(), "table", upDepth, downDepth, false));
    return MAPPER.readTree(resultStr);
  }

  private void addManualLineage(Table from, Table to) {
    LineageDetails details = new LineageDetails();
    details.setSource(LineageDetails.Source.MANUAL);

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference())
                    .withLineageDetails(details));

    Awaitility.await("PUT lineage " + from.getName() + " → " + to.getName())
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              client.lineage().addLineage(addLineage);
              return true;
            });
  }

  private void waitForEdgeInSearchIndex(Table from, Table to) {
    Awaitility.await("Wait for edge in ES: " + from.getName() + " → " + to.getName())
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              String result =
                  client
                      .lineage()
                      .searchLineage(from.getFullyQualifiedName(), "table", 0, 3, false);
              JsonNode root = MAPPER.readTree(result);
              JsonNode nodes = root.get("nodes");
              return nodes != null && nodes.has(to.getFullyQualifiedName());
            });
  }

  private String callWithRetry(ApiCall call) throws Exception {
    String[] result = {null};
    Awaitility.await("API call with retry")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              result[0] = call.execute();
              return result[0] != null;
            });
    return result[0];
  }

  private Set<String> edgeFieldNames(JsonNode edgeMap) {
    Set<String> names = new HashSet<>();
    if (edgeMap != null) {
      edgeMap.fieldNames().forEachRemaining(names::add);
    }
    return names;
  }

  private boolean hasNodeInEdges(JsonNode edgeMap, String targetFqn) {
    if (edgeMap == null) {
      return false;
    }
    var iter = edgeMap.elements();
    while (iter.hasNext()) {
      JsonNode edge = iter.next();
      String fromFqn = edge.path("fromEntity").path("fullyQualifiedName").asText("");
      String toFqn = edge.path("toEntity").path("fullyQualifiedName").asText("");
      if (fromFqn.equals(targetFqn) || toFqn.equals(targetFqn)) {
        return true;
      }
    }
    return false;
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

  private void safeDelete(Table table) {
    if (table != null) {
      try {
        client.tables().delete(table.getId());
      } catch (Exception e) {
        // Ignore cleanup failures
      }
    }
  }

  @FunctionalInterface
  private interface ApiCall {
    String execute() throws Exception;
  }
}

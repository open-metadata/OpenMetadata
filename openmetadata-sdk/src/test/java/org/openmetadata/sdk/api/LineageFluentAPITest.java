package org.openmetadata.sdk.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.lineage.LineageAPI;

/**
 * Tests for Lineage fluent API operations.
 * Verifies the new fluent builder pattern for lineage retrieval and manipulation functionality.
 */
public class LineageFluentAPITest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private LineageAPI mockLineageAPI;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.lineage()).thenReturn(mockLineageAPI);
    Lineage.setDefaultClient(mockClient);
  }

  @Test
  void testGetLineageWithFluentAPI() throws Exception {
    // Arrange
    String entityType = "table";
    String entityId = "123e4567-e89b-12d3-a456-426614174000";
    String expectedResult =
        "{\"entity\":{\"id\":\"123e4567-e89b-12d3-a456-426614174000\",\"type\":\"table\"}}";

    when(mockLineageAPI.getEntityLineage(eq(entityType), eq(entityId), eq("1"), eq("1")))
        .thenReturn(expectedResult);

    // Act
    Lineage.LineageGraph result = Lineage.of(entityType, entityId).fetch();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockLineageAPI).getEntityLineage(eq(entityType), eq(entityId), eq("1"), eq("1"));
  }

  @Test
  void testGetLineageWithCustomDepth() throws Exception {
    // Arrange
    String entityType = "table";
    String entityId = "123e4567-e89b-12d3-a456-426614174000";
    String expectedResult =
        "{\"entity\":{\"id\":\"123e4567-e89b-12d3-a456-426614174000\"},\"lineage\":{}}";

    when(mockLineageAPI.getEntityLineage(eq(entityType), eq(entityId), eq("5"), eq("3")))
        .thenReturn(expectedResult);

    // Act
    Lineage.LineageGraph result =
        Lineage.of(entityType, entityId).upstream(5).downstream(3).fetch();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockLineageAPI).getEntityLineage(eq(entityType), eq(entityId), eq("5"), eq("3"));
  }

  @Test
  void testGetLineageWithIncludeDeleted() throws Exception {
    // Arrange
    String entityType = "table";
    String entityId = "123e4567-e89b-12d3-a456-426614174000";
    String expectedResult = "{\"entity\":{\"id\":\"123e4567-e89b-12d3-a456-426614174000\"}}";

    when(mockLineageAPI.getEntityLineage(eq(entityType), eq(entityId), eq("2"), eq("2")))
        .thenReturn(expectedResult);

    // Act
    Lineage.LineageGraph result =
        Lineage.of(entityType, entityId).depth(2).includeDeleted(true).fetch();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockLineageAPI).getEntityLineage(eq(entityType), eq(entityId), eq("2"), eq("2"));
  }

  @Test
  void testAddLineageConnection() throws Exception {
    // Arrange
    String sourceTableId = "source-table-id";
    String targetDashboardId = "target-dashboard-id";
    String expectedResult =
        "{\"edge\":{\"from\":\"table:source-table-id\",\"to\":\"dashboard:target-dashboard-id\"}}";

    Map<String, Object> expectedRequest = new HashMap<>();
    Map<String, Object> edge = new HashMap<>();
    edge.put("fromEntity", Map.of("type", "table", "id", sourceTableId));
    edge.put("toEntity", Map.of("type", "dashboard", "id", targetDashboardId));
    edge.put("description", "Dashboard uses data from this table");
    edge.put("sqlQuery", "SELECT * FROM source_table");
    expectedRequest.put("edge", edge);

    when(mockLineageAPI.addLineage(any())).thenReturn(expectedResult);

    // Act
    Lineage.LineageEdge result =
        Lineage.connect()
            .from("table", sourceTableId)
            .to("dashboard", targetDashboardId)
            .withDescription("Dashboard uses data from this table")
            .withSqlQuery("SELECT * FROM source_table")
            .execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockLineageAPI).addLineage(any());
  }

  @Test
  void testAddLineageWithColumnMapping() throws Exception {
    // Arrange
    String sourceTableId = "source-table-id";
    String targetTableId = "target-table-id";
    String pipelineId = "etl-pipeline-id";
    String expectedResult =
        "{\"edge\":{\"from\":\"table:source-table-id\",\"to\":\"table:target-table-id\"}}";

    when(mockLineageAPI.addLineage(any())).thenReturn(expectedResult);

    // Act
    Lineage.LineageEdge result =
        Lineage.connect()
            .from("table", sourceTableId)
            .fromColumns("customer_id", "order_date")
            .to("table", targetTableId)
            .toColumns("cust_id", "date")
            .withPipeline("pipeline", pipelineId)
            .withDescription("ETL transformation")
            .execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockLineageAPI).addLineage(any());
  }

  @Test
  void testDeleteLineage() throws Exception {
    // Arrange
    String sourceTableId = "source-table-id";
    String targetDashboardId = "target-dashboard-id";
    String fromEntity = "table:source-table-id";
    String toEntity = "dashboard:target-dashboard-id";

    when(mockLineageAPI.deleteLineage(eq(fromEntity), eq(toEntity))).thenReturn("true");

    // Act
    Lineage.disconnect().from("table", sourceTableId).to("dashboard", targetDashboardId).confirm();

    // Assert
    verify(mockLineageAPI).deleteLineage(eq(fromEntity), eq(toEntity));
  }

  @Test
  void testExportLineage() throws Exception {
    // Arrange
    String entityType = "table";
    String entityId = "table-id";
    String expectedResult = "{\"export\":\"lineage_graph\"}";

    when(mockLineageAPI.exportLineage(eq(entityType), eq(entityId))).thenReturn(expectedResult);

    // Act
    String result =
        Lineage.export()
            .entity(entityType, entityId)
            .format(Lineage.ExportFormat.DOT)
            .includeUpstream(true)
            .includeDownstream(true)
            .maxDepth(5)
            .execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result);
    verify(mockLineageAPI).exportLineage(eq(entityType), eq(entityId));
  }

  @Test
  void testLineagePathFinder() {
    // Arrange
    String sourceTableId = "source-table-id";
    String targetDashboardId = "target-dashboard-id";

    // Act
    Lineage.LineagePath path =
        Lineage.path()
            .from("table", sourceTableId)
            .to("dashboard", targetDashboardId)
            .maxDepth(10)
            .findShortest();

    // Assert
    assertNotNull(path);
    assertEquals(0, path.getLength()); // Empty path as it's not implemented
  }

  @Test
  void testLineagePathFinderFindAll() {
    // Arrange
    String sourceTableId = "source-table-id";
    String targetDashboardId = "target-dashboard-id";

    // Act
    List<Lineage.LineagePath> paths =
        Lineage.path().from("table", sourceTableId).to("dashboard", targetDashboardId).findAll();

    // Assert
    assertNotNull(paths);
    assertTrue(paths.isEmpty()); // Empty list as it's not implemented
  }

  @Test
  void testImpactAnalysis() throws Exception {
    // Arrange
    String entityType = "table";
    String entityId = "table-id";
    String expectedResult = "{\"impactedEntities\":[]}";

    when(mockLineageAPI.getEntityLineage(eq(entityType), eq(entityId), eq("0"), eq("3")))
        .thenReturn(expectedResult);

    // Act
    Lineage.ImpactAnalysis impact =
        Lineage.impact().of(entityType, entityId).downstream().depth(3).analyze();

    // Assert
    assertNotNull(impact);
    assertEquals(0, impact.getTotalImpactCount());
    verify(mockLineageAPI).getEntityLineage(eq(entityType), eq(entityId), eq("0"), eq("3"));
  }

  @Test
  void testImpactAnalysisUpstream() throws Exception {
    // Arrange
    String entityType = "dashboard";
    String entityId = "dashboard-id";
    String expectedResult = "{\"impactedEntities\":[]}";

    when(mockLineageAPI.getEntityLineage(eq(entityType), eq(entityId), eq("5"), eq("0")))
        .thenReturn(expectedResult);

    // Act
    Lineage.ImpactAnalysis impact =
        Lineage.impact().of(entityType, entityId).upstream().depth(5).analyze();

    // Assert
    assertNotNull(impact);
    assertEquals(0, impact.getTotalImpactCount());
    assertTrue(impact.getImpactByType().isEmpty());
    verify(mockLineageAPI).getEntityLineage(eq(entityType), eq(entityId), eq("5"), eq("0"));
  }

  @Test
  void testLineageWithoutClient() {
    // Reset client to null
    Lineage.setDefaultClient(null);

    // Act & Assert
    assertThrows(IllegalStateException.class, () -> Lineage.of("table", "id"));
    assertThrows(IllegalStateException.class, () -> Lineage.connect());
    assertThrows(IllegalStateException.class, () -> Lineage.disconnect());
    assertThrows(IllegalStateException.class, () -> Lineage.export());
    assertThrows(IllegalStateException.class, () -> Lineage.path());
    assertThrows(IllegalStateException.class, () -> Lineage.impact());
  }

  @Test
  void testLineageGraphMethods() throws Exception {
    // Arrange
    String rawData = "{\"nodes\":[],\"edges\":[]}";
    Lineage.LineageGraph graph = new Lineage.LineageGraph(rawData, mockClient);

    // Act & Assert
    assertEquals(rawData, graph.getRaw());
    assertNotNull(graph.getNodes());
    assertTrue(graph.getNodes().isEmpty());
    assertNotNull(graph.getEdges());
    assertTrue(graph.getEdges().isEmpty());
    assertNull(graph.getRootNode());
    assertNotNull(graph.getUpstreamNodes());
    assertTrue(graph.getUpstreamNodes().isEmpty());
    assertNotNull(graph.getDownstreamNodes());
    assertTrue(graph.getDownstreamNodes().isEmpty());
  }

  @Test
  void testLineageNodeMethods() {
    // Arrange
    Map<String, Object> properties = new HashMap<>();
    properties.put("tier", "Gold");
    Lineage.LineageNode node =
        new Lineage.LineageNode("table", "table-id", "test_table", properties);

    // Act & Assert
    assertEquals("table", node.getEntityType());
    assertEquals("table-id", node.getEntityId());
    assertEquals("test_table", node.getName());
    assertEquals("Gold", node.getProperty("tier"));
    assertNull(node.getProperty("nonexistent"));
  }

  @Test
  void testLineageEdgeMethods() {
    // Arrange
    String rawData = "{\"from\":\"table:id1\",\"to\":\"dashboard:id2\"}";
    Lineage.LineageEdge edge = new Lineage.LineageEdge(rawData);

    // Act & Assert
    assertEquals(rawData, edge.getRaw());
    assertNull(edge.getFromEntity()); // Not implemented
    assertNull(edge.getToEntity()); // Not implemented
  }

  @Test
  void testImpactedEntityMethods() {
    // Arrange
    Lineage.ImpactedEntity entity =
        new Lineage.ImpactedEntity("dashboard", "dash-id", "Sales Dashboard", 2);

    // Act & Assert
    assertEquals("dashboard", entity.getEntityType());
    assertEquals("dash-id", entity.getEntityId());
    assertEquals("Sales Dashboard", entity.getName());
    assertEquals(2, entity.getDistance());
  }
}

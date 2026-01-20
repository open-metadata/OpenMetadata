package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.lineage.LineageResourceTest;
import org.openmetadata.service.resources.pipelines.PipelineResourceTest;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class LineageGraphExplorerTest extends OpenMetadataApplicationTest {

  private static LineageGraphExplorer traversalService;
  private static CollectionDAO dao;
  private static TableResourceTest tableResourceTest;
  private static DashboardResourceTest dashboardResourceTest;
  private static PipelineResourceTest pipelineResourceTest;
  private static LineageResourceTest lineageResourceTest;

  private final List<Table> createdTables = new ArrayList<>();
  private final List<Dashboard> createdDashboards = new ArrayList<>();
  private final List<Pipeline> createdPipelines = new ArrayList<>();
  private final List<EntitiesEdge> createdEdges = new ArrayList<>();

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    dao = Entity.getCollectionDAO();
    traversalService = new LineageGraphExplorer(dao);

    tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);

    dashboardResourceTest = new DashboardResourceTest();
    pipelineResourceTest = new PipelineResourceTest();
    lineageResourceTest = new LineageResourceTest();
  }

  @AfterEach
  void cleanup() {
    for (EntitiesEdge edge : createdEdges) {
      try {
        lineageResourceTest.deleteLineage(edge, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
      }
    }
    createdEdges.clear();

    for (Table table : createdTables) {
      try {
        tableResourceTest.deleteEntity(table.getId(), ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
      }
    }
    createdTables.clear();

    for (Dashboard dashboard : createdDashboards) {
      try {
        dashboardResourceTest.deleteEntity(dashboard.getId(), ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
      }
    }
    createdDashboards.clear();

    for (Pipeline pipeline : createdPipelines) {
      try {
        pipelineResourceTest.deleteEntity(pipeline.getId(), ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
      }
    }
    createdPipelines.clear();
  }

  @Test
  @Order(1)
  void test_linearLineageTraversal() throws IOException {
    // Create entities: Table A → Table B → Dashboard C
    Table tableA = createTable("test_table_a_linear");
    Table tableB = createTable("test_table_b_linear");
    Dashboard dashboardC = createDashboard("test_dashboard_c_linear");

    // Create lineage: A → B → C
    addLineage(tableA.getEntityReference(), tableB.getEntityReference());
    addLineage(tableB.getEntityReference(), dashboardC.getEntityReference());

    // Test depth 1: should only find Table B
    Set<EntityReference> depth1 =
        traversalService.findUniqueEntitiesDownstream(tableA.getId(), "table", 1);
    assertEquals(1, depth1.size());
    assertTrue(containsEntity(depth1, tableB.getId()));
    assertFalse(containsEntity(depth1, dashboardC.getId()));

    // Test depth 2: should find both Table B and Dashboard C
    Set<EntityReference> depth2 =
        traversalService.findUniqueEntitiesDownstream(tableA.getId(), "table", 2);
    assertEquals(2, depth2.size());
    assertTrue(containsEntity(depth2, tableB.getId()));
    assertTrue(containsEntity(depth2, dashboardC.getId()));

    // Test unlimited depth (null): should find both
    Set<EntityReference> unlimited =
        traversalService.findUniqueEntitiesDownstream(tableA.getId(), "table", null);
    assertEquals(2, unlimited.size());
    assertTrue(containsEntity(unlimited, tableB.getId()));
    assertTrue(containsEntity(unlimited, dashboardC.getId()));
  }

  @Test
  @Order(2)
  void test_cycleDetection() throws IOException {
    // Create entities: Table X → Pipeline Y → Dashboard Z → Table X (cycle)
    Table tableX = createTable("test_table_x_cycle");
    Pipeline pipelineY = createPipeline("test_pipeline_y_cycle");
    Dashboard dashboardZ = createDashboard("test_dashboard_z_cycle");

    // Create cyclic lineage: X → Y → Z → X
    addLineage(tableX.getEntityReference(), pipelineY.getEntityReference());
    addLineage(pipelineY.getEntityReference(), dashboardZ.getEntityReference());
    addLineage(dashboardZ.getEntityReference(), tableX.getEntityReference());

    // Test with unlimited depth - should not cause infinite loop
    Set<EntityReference> downstream =
        traversalService.findUniqueEntitiesDownstream(tableX.getId(), "table", null);
    assertEquals(2, downstream.size());
    assertTrue(containsEntity(downstream, pipelineY.getId()));
    assertTrue(containsEntity(downstream, dashboardZ.getId()));
    // Should not contain itself due to cycle detection
    assertFalse(containsEntity(downstream, tableX.getId()));
  }

  @Test
  @Order(3)
  void test_emptyDownstream() throws IOException {
    // Create a table with no downstream entities
    Table isolatedTable = createTable("test_isolated_table");

    // Test downstream traversal
    Set<EntityReference> downstream =
        traversalService.findUniqueEntitiesDownstream(isolatedTable.getId(), "table", null);
    assertTrue(downstream.isEmpty());
  }

  @Test
  @Order(4)
  void test_wideLineageGraph() throws IOException {
    // Create a source table with multiple downstream branches
    Table sourceTable = createTable("test_source_wide");
    Dashboard dashboard1 = createDashboard("test_dashboard_wide_1");
    Dashboard dashboard2 = createDashboard("test_dashboard_wide_2");
    Table derivedTable1 = createTable("test_derived_wide_1");
    Table derivedTable2 = createTable("test_derived_wide_2");
    Pipeline pipeline = createPipeline("test_pipeline_wide");

    // Create wide lineage graph
    // sourceTable → dashboard1
    // sourceTable → dashboard2
    // sourceTable → derivedTable1
    // sourceTable → derivedTable2
    // sourceTable → pipeline
    addLineage(sourceTable.getEntityReference(), dashboard1.getEntityReference());
    addLineage(sourceTable.getEntityReference(), dashboard2.getEntityReference());
    addLineage(sourceTable.getEntityReference(), derivedTable1.getEntityReference());
    addLineage(sourceTable.getEntityReference(), derivedTable2.getEntityReference());
    addLineage(sourceTable.getEntityReference(), pipeline.getEntityReference());

    // Test with unlimited depth
    Set<EntityReference> downstream =
        traversalService.findUniqueEntitiesDownstream(sourceTable.getId(), "table", null);
    assertEquals(5, downstream.size());
    assertTrue(containsEntity(downstream, dashboard1.getId()));
    assertTrue(containsEntity(downstream, dashboard2.getId()));
    assertTrue(containsEntity(downstream, derivedTable1.getId()));
    assertTrue(containsEntity(downstream, derivedTable2.getId()));
    assertTrue(containsEntity(downstream, pipeline.getId()));
  }

  @Test
  @Order(5)
  void test_depthLimitingBehavior() throws IOException {
    // Create deep lineage chain: A → B → C → D → E
    Table tableA = createTable("test_deep_a");
    Table tableB = createTable("test_deep_b");
    Table tableC = createTable("test_deep_c");
    Dashboard dashboardD = createDashboard("test_deep_d");
    Pipeline pipelineE = createPipeline("test_deep_e");

    addLineage(tableA.getEntityReference(), tableB.getEntityReference());
    addLineage(tableB.getEntityReference(), tableC.getEntityReference());
    addLineage(tableC.getEntityReference(), dashboardD.getEntityReference());
    addLineage(dashboardD.getEntityReference(), pipelineE.getEntityReference());

    // Test various depth limits
    Set<EntityReference> depth0 =
        traversalService.findUniqueEntitiesDownstream(tableA.getId(), "table", 0);
    assertTrue(depth0.isEmpty());

    Set<EntityReference> depth1 =
        traversalService.findUniqueEntitiesDownstream(tableA.getId(), "table", 1);
    assertEquals(1, depth1.size());
    assertTrue(containsEntity(depth1, tableB.getId()));

    Set<EntityReference> depth3 =
        traversalService.findUniqueEntitiesDownstream(tableA.getId(), "table", 3);
    assertEquals(3, depth3.size());
    assertTrue(containsEntity(depth3, tableB.getId()));
    assertTrue(containsEntity(depth3, tableC.getId()));
    assertTrue(containsEntity(depth3, dashboardD.getId()));
    assertFalse(containsEntity(depth3, pipelineE.getId()));

    Set<EntityReference> depth5 =
        traversalService.findUniqueEntitiesDownstream(tableA.getId(), "table", 5);
    assertEquals(4, depth5.size());
    assertTrue(containsEntity(depth5, pipelineE.getId()));
  }

  @Test
  @Order(6)
  void test_nullDepthMeansUnlimited() throws IOException {
    // Test that null depth means unlimited traversal

    // Create lineage: A → B → C → D
    Table tableA = createTable("test_null_depth_a");
    Table tableB = createTable("test_null_depth_b");
    Table tableC = createTable("test_null_depth_c");
    Table tableD = createTable("test_null_depth_d");

    addLineage(tableA.getEntityReference(), tableB.getEntityReference());
    addLineage(tableB.getEntityReference(), tableC.getEntityReference());
    addLineage(tableC.getEntityReference(), tableD.getEntityReference());

    // Using null depth should find all downstream entities
    Set<EntityReference> unlimitedDepth =
        traversalService.findUniqueEntitiesDownstream(tableA.getId(), "table", null);
    assertEquals(3, unlimitedDepth.size());
    assertTrue(containsEntity(unlimitedDepth, tableB.getId()));
    assertTrue(containsEntity(unlimitedDepth, tableC.getId()));
    assertTrue(containsEntity(unlimitedDepth, tableD.getId()));

    // Using specific depth limit
    Set<EntityReference> limitedDepth =
        traversalService.findUniqueEntitiesDownstream(tableA.getId(), "table", 2);
    assertEquals(2, limitedDepth.size());
    assertTrue(containsEntity(limitedDepth, tableB.getId()));
    assertTrue(containsEntity(limitedDepth, tableC.getId()));
    assertFalse(containsEntity(limitedDepth, tableD.getId()));
  }

  @Test
  @Order(7)
  void test_complexMixedEntityTypes() throws IOException {
    // Test with mixed entity types in lineage
    Table table = createTable("test_mixed_table");
    Dashboard dashboard = createDashboard("test_mixed_dashboard");
    Pipeline pipeline = createPipeline("test_mixed_pipeline");
    Table derivedTable = createTable("test_mixed_derived_table");

    // Create mixed lineage: table → dashboard → pipeline → derivedTable
    addLineage(table.getEntityReference(), dashboard.getEntityReference());
    addLineage(dashboard.getEntityReference(), pipeline.getEntityReference());
    addLineage(pipeline.getEntityReference(), derivedTable.getEntityReference());

    // Test traversal across different entity types
    Set<EntityReference> downstream =
        traversalService.findUniqueEntitiesDownstream(table.getId(), "table", null);
    assertEquals(3, downstream.size());
    assertTrue(containsEntity(downstream, dashboard.getId()));
    assertTrue(containsEntity(downstream, pipeline.getId()));
    assertTrue(containsEntity(downstream, derivedTable.getId()));
  }

  private Table createTable(String name) throws IOException {
    CreateTable createTable = tableResourceTest.createRequest(name);
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    createdTables.add(table);
    return table;
  }

  private Dashboard createDashboard(String name) throws IOException {
    CreateDashboard createDashboard = dashboardResourceTest.createRequest(name);
    Dashboard dashboard = dashboardResourceTest.createEntity(createDashboard, ADMIN_AUTH_HEADERS);
    createdDashboards.add(dashboard);
    return dashboard;
  }

  private Pipeline createPipeline(String name) throws IOException {
    CreatePipeline createPipeline = pipelineResourceTest.createRequest(name);
    Pipeline pipeline = pipelineResourceTest.createEntity(createPipeline, ADMIN_AUTH_HEADERS);
    createdPipelines.add(pipeline);
    return pipeline;
  }

  private void addLineage(EntityReference from, EntityReference to) throws IOException {
    EntitiesEdge edge = new EntitiesEdge().withFromEntity(from).withToEntity(to);
    AddLineage addLineage = new AddLineage().withEdge(edge);
    lineageResourceTest.addLineage(addLineage, ADMIN_AUTH_HEADERS);
    createdEdges.add(edge);
  }

  private boolean containsEntity(Set<EntityReference> entities, UUID id) {
    return entities.stream().anyMatch(ref -> ref.getId().equals(id));
  }
}

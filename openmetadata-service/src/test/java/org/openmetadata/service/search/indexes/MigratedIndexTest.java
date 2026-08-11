package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

class MigratedIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo =
        Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  private void mockAllStatics() {
    mockAllStatics(Collections.emptyList());
  }

  private void mockAllStatics(List<TagLabel> tags) {
    entityStaticMock.when(() -> Entity.getEntityTags(anyString(), any())).thenReturn(tags);

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    when(relDao.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);
  }

  // ==================== DataAssetIndex: buildSearchIndexDoc() end-to-end ====================

  @Test
  void testDashboardIndex_buildSearchIndexDoc_hasAllFields() {
    EntityReference serviceRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("dashboardService")
            .withName("looker");

    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("sales-dashboard")
            .withFullyQualifiedName("looker.sales-dashboard")
            .withService(serviceRef)
            .withServiceType(
                org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType
                    .Looker);

    mockAllStatics();

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> result = index.buildSearchIndexDoc();

    // Common fields (auto-populated by template method)
    assertEquals("sales-dashboard", result.get("displayName"));
    assertEquals(Entity.DASHBOARD, result.get("entityType"));
    assertTrue(result.containsKey("owners"));
    assertTrue(result.containsKey("domains"));
    assertTrue(result.containsKey("fqnParts"));

    // Tags (auto-populated via TaggableIndex)
    assertTrue(result.containsKey("tags"));
    assertTrue(result.containsKey("classificationTags"));
    assertTrue(result.containsKey("glossaryTags"));

    // Service (auto-populated via ServiceBackedIndex)
    assertNotNull(result.get("service"));
    assertEquals(
        org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType.Looker,
        result.get("serviceType"));

    // Lineage (auto-populated via LineageIndex)
    assertTrue(result.containsKey("upstreamLineage"));
  }

  @Test
  void testDashboardIndex_buildSearchIndexDocInternal_isEmpty() {
    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("empty-test")
            .withFullyQualifiedName("svc.empty-test");

    DashboardIndex index = new DashboardIndex(dashboard);
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertTrue(result.isEmpty());
  }

  @Test
  void testPipelineIndex_setsNameField() {
    Pipeline pipeline =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("etl-pipeline")
            .withDisplayName("ETL Pipeline")
            .withFullyQualifiedName("airflow.etl-pipeline");

    PipelineIndex index = new PipelineIndex(pipeline);
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertEquals("etl-pipeline", result.get("name"));
    assertEquals(1, result.size());
  }

  @Test
  void testStoredProcedureIndex_setsProcessedLineage() {
    StoredProcedure sp =
        new StoredProcedure()
            .withId(UUID.randomUUID())
            .withName("usp_getUsers")
            .withFullyQualifiedName("svc.db.schema.usp_getUsers");

    StoredProcedureIndex index = new StoredProcedureIndex(sp);
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertTrue(result.containsKey("processedLineage"));
    assertEquals(1, result.size());
  }

  // ==================== Child tag merging via mergeChildTags() ====================

  @Test
  void testTableIndex_buildSearchIndexDoc_mergesChildTags() {
    TagLabel colTag =
        new TagLabel().withTagFQN("PII.Email").withSource(TagLabel.TagSource.CLASSIFICATION);
    Column col =
        new Column()
            .withName("email")
            .withDataType(ColumnDataType.VARCHAR)
            .withTags(List.of(colTag));

    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("users")
            .withFullyQualifiedName("svc.db.schema.users")
            .withColumns(List.of(col));

    mockAllStatics();

    TableIndex index = new TableIndex(table);
    Map<String, Object> result = index.buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(tags.stream().anyMatch(t -> "PII.Email".equals(t.getTagFQN())));

    assertNotNull(result.get("columnNames"));
  }

  // ==================== TaggableIndex + LineageIndex (no service) ====================

  @Test
  void testDomainIndex_buildSearchIndexDoc_hasTagsAndLineageButNoService() {
    Domain domain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("engineering")
            .withFullyQualifiedName("engineering");

    mockAllStatics();

    DomainIndex index = new DomainIndex(domain);
    Map<String, Object> result = index.buildSearchIndexDoc();

    // Common
    assertEquals("engineering", result.get("displayName"));
    assertEquals(Entity.DOMAIN, result.get("entityType"));

    // Tags
    assertTrue(result.containsKey("tags"));
    assertTrue(result.containsKey("classificationTags"));

    // Lineage
    assertTrue(result.containsKey("upstreamLineage"));

    // NO service (Domain is not ServiceBacked)
    assertFalse(result.containsKey("serviceType"));
  }

  // ==================== LineageIndex only ====================

  @Test
  void testDatabaseServiceIndex_buildSearchIndexDoc_hasLineageOnly() {
    DatabaseService dbService =
        new DatabaseService()
            .withId(UUID.randomUUID())
            .withName("mysql-prod")
            .withFullyQualifiedName("mysql-prod");

    mockAllStatics();

    DatabaseServiceIndex index = new DatabaseServiceIndex(dbService);
    Map<String, Object> result = index.buildSearchIndexDoc();

    // Common
    assertEquals("mysql-prod", result.get("displayName"));
    assertEquals(Entity.DATABASE_SERVICE, result.get("entityType"));

    // Lineage
    assertTrue(result.containsKey("upstreamLineage"));

    // TaggableIndex (service indexes now implement TaggableIndex)
    assertTrue(result.containsKey("classificationTags"));
    assertTrue(result.containsKey("tier"));
    // NOT ServiceBackedIndex (it IS a service, not service-backed)
    assertFalse(result.containsKey("serviceType"));
  }
}

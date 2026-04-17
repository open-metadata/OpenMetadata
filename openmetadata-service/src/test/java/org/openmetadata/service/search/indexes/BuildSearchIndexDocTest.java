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
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Tests for the {@link SearchIndex#buildSearchIndexDoc()} template method, verifying the
 * orchestration: populateCommonFields -> mixin dispatch -> buildSearchIndexDocInternal -> fqnHash ->
 * cleanup.
 */
class BuildSearchIndexDocTest {

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
    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any()))
        .thenReturn(Collections.emptyList());

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    when(relDao.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);
  }

  // ==================== Phase 1: populateCommonFields dispatch ====================

  @Test
  void testEntityInterface_getsCommonFields() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("test")
            .withFullyQualifiedName("svc.test");

    mockAllStatics();

    Map<String, Object> result = new DashboardIndex(d).buildSearchIndexDoc();

    // displayName falls back to name when entity has no explicit displayName
    assertEquals("test", result.get("displayName"));
    assertEquals(Entity.DASHBOARD, result.get("entityType"));
    assertNotNull(result.get("owners"));
  }

  @Test
  void testNonEntityInterface_skipsCommonFields() {
    Pipeline pipeline =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("p")
            .withFullyQualifiedName("svc.p")
            .withServiceType(
                org.openmetadata.schema.api.services.CreatePipelineService.PipelineServiceType
                    .Airflow);
    org.openmetadata.schema.entity.data.PipelineStatus status =
        new org.openmetadata.schema.entity.data.PipelineStatus()
            .withExecutionId("exec-1")
            .withTimestamp(System.currentTimeMillis())
            .withExecutionStatus(org.openmetadata.schema.type.StatusType.Successful);

    mockAllStatics();

    PipelineExecutionIndex index = new PipelineExecutionIndex(pipeline, status);
    Map<String, Object> result = index.buildSearchIndexDoc();

    // PipelineExecutionIndex.buildSearchIndexDocInternal replaces the doc entirely
    // so common fields are NOT present (entity is not EntityInterface)
    assertFalse(result.containsKey("owners"));
    assertFalse(result.containsKey("domains"));
    // entityType is set by buildSearchIndexDocInternal, not populateCommonFields
    assertEquals("pipelineExecution", result.get("entityType"));
  }

  // ==================== Phase 2: Mixin dispatch ====================

  @Test
  void testDataAssetIndex_getsAllThreeMixins() {
    EntityReference serviceRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("dashboardService")
            .withName("looker");

    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("looker.d")
            .withService(serviceRef)
            .withServiceType(
                org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType
                    .Looker);

    mockAllStatics();

    Map<String, Object> result = new DashboardIndex(d).buildSearchIndexDoc();

    // TaggableIndex
    assertTrue(result.containsKey("tags"));
    assertTrue(result.containsKey("tier"));
    assertTrue(result.containsKey("classificationTags"));
    assertTrue(result.containsKey("glossaryTags"));
    // ServiceBackedIndex
    assertNotNull(result.get("service"));
    assertNotNull(result.get("serviceType"));
    // LineageIndex
    assertTrue(result.containsKey("upstreamLineage"));
  }

  @Test
  void testTaggableAndLineageOnly_noServiceFields() {
    Domain domain =
        new Domain().withId(UUID.randomUUID()).withName("eng").withFullyQualifiedName("eng");

    mockAllStatics();

    Map<String, Object> result = new DomainIndex(domain).buildSearchIndexDoc();

    // TaggableIndex
    assertTrue(result.containsKey("tags"));
    // LineageIndex
    assertTrue(result.containsKey("upstreamLineage"));
    // NOT ServiceBackedIndex
    assertFalse(result.containsKey("serviceType"));
  }

  @Test
  void testTaggableOnly_noServiceOrLineage() {
    Query query =
        new Query().withId(UUID.randomUUID()).withName("q").withFullyQualifiedName("svc.q");

    mockAllStatics();

    Map<String, Object> result = new QueryIndex(query).buildSearchIndexDoc();

    // TaggableIndex
    assertTrue(result.containsKey("tags"));
    // NOT LineageIndex
    assertFalse(result.containsKey("upstreamLineage"));
    // NOT ServiceBackedIndex
    assertFalse(result.containsKey("serviceType"));
  }

  @Test
  void testLineageOnly_noTagsOrService() {
    DatabaseService svc =
        new DatabaseService()
            .withId(UUID.randomUUID())
            .withName("mysql")
            .withFullyQualifiedName("mysql");

    mockAllStatics();

    Map<String, Object> result = new DatabaseServiceIndex(svc).buildSearchIndexDoc();

    // LineageIndex
    assertTrue(result.containsKey("upstreamLineage"));
    // TaggableIndex (service indexes now implement TaggableIndex)
    assertTrue(result.containsKey("classificationTags"));
    assertTrue(result.containsKey("glossaryTags"));
    assertTrue(result.containsKey("tier"));
    // NOT ServiceBackedIndex (it IS a service, not service-backed)
    assertFalse(result.containsKey("serviceType"));
  }

  @Test
  void testBaseSearchIndexOnly_getsCommonFieldsButNoMixinFields() {
    // UserIndex implements bare SearchIndex (no TaggableIndex, no LineageIndex)
    org.openmetadata.schema.entity.teams.User user =
        new org.openmetadata.schema.entity.teams.User()
            .withId(UUID.randomUUID())
            .withName("alice")
            .withFullyQualifiedName("alice");

    mockAllStatics();

    Map<String, Object> result = new UserIndex(user).buildSearchIndexDoc();

    // Common fields present (displayName falls back to name)
    assertEquals(Entity.USER, result.get("entityType"));
    // No mixin-applied fields
    assertFalse(result.containsKey("classificationTags"));
    assertFalse(result.containsKey("glossaryTags"));
    assertFalse(result.containsKey("tier"));
    assertFalse(result.containsKey("upstreamLineage"));
    assertFalse(result.containsKey("service"));
  }

  // ==================== Phase 4: fqnHash ====================

  @Test
  void testFqnHash_generatedWhenFqnPresent() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("hash-test")
            .withFullyQualifiedName("svc.hash-test");

    mockAllStatics();

    Map<String, Object> result = new DashboardIndex(d).buildSearchIndexDoc();

    assertNotNull(result.get("fqnHash"));
    assertEquals(FullyQualifiedName.buildHash("svc.hash-test"), result.get("fqnHash"));
  }

  @Test
  void testFqnHash_generatedForMultiPartFqn() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("deep")
            .withFullyQualifiedName("svc.project.deep");

    mockAllStatics();

    Map<String, Object> result = new DashboardIndex(d).buildSearchIndexDoc();

    assertNotNull(result.get("fqnHash"));
    assertEquals(FullyQualifiedName.buildHash("svc.project.deep"), result.get("fqnHash"));
  }

  // ==================== Phase 5: removeNonIndexableFields ====================

  @Test
  void testChangeDescriptionRemovedFromDoc() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("cleanup-test")
            .withFullyQualifiedName("svc.cleanup-test");

    mockAllStatics();

    Map<String, Object> result = new DashboardIndex(d).buildSearchIndexDoc();

    assertFalse(result.containsKey("changeDescription"));
    assertFalse(result.containsKey("incrementalChangeDescription"));
    assertFalse(result.containsKey("connection"));
    assertFalse(result.containsKey("changeSummary"));
  }
}

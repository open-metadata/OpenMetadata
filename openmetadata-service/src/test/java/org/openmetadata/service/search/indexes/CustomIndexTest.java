package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Tests for non-EntityInterface custom index classes that manage their own doc building. These
 * indexes are NOT affected by populateCommonFields or mixin dispatch, but we verify they produce
 * the expected fields.
 */
class CustomIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo = mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    SearchClient mockSearchClient = mock(SearchClient.class);
    when(mockSearchRepo.getSearchClient()).thenReturn(mockSearchClient);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
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

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  // ==================== ReportData indexes =====================================================

  @Test
  void testReportDataIndexes_setsTimestampAndType() {
    ReportData rd = new ReportData().withTimestamp(12345L);

    ReportDataIndexes index = new ReportDataIndexes(rd);
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertEquals(12345L, result.get("timestamp"));
    assertNull(result.get("id"));
    // reportDataType is present (may be null if not set on entity)
    assertTrue(result.containsKey("reportDataType"));
  }

  @Test
  void testEntityReportDataIndex_setsEntityType() {
    ReportData rd = new ReportData();

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new EntityReportDataIndex(rd).buildSearchIndexDocInternal(doc);

    assertEquals("entityReportData", result.get("entityType"));
  }

  @Test
  void testRawCostAnalysisReportDataIndex_setsEntityType() {
    ReportData rd = new ReportData();

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new RawCostAnalysisReportDataIndex(rd).buildSearchIndexDocInternal(doc);

    assertEquals("rawCostAnalysisReportData", result.get("entityType"));
  }

  @Test
  void testAggregatedCostAnalysisReportDataIndex_setsEntityType() {
    ReportData rd = new ReportData();

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new AggregatedCostAnalysisReportDataIndex(rd).buildSearchIndexDocInternal(doc);

    assertEquals("aggregatedCostAnalysisReportData", result.get("entityType"));
  }

  @Test
  void testWebAnalyticEntityViewReportDataIndex_setsEntityType() {
    ReportData rd = new ReportData();

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new WebAnalyticEntityViewReportDataIndex(rd).buildSearchIndexDocInternal(doc);

    assertEquals("webAnalyticEntityViewReportData", result.get("entityType"));
  }

  @Test
  void testWebAnalyticUserActivityReportDataIndex_setsEntityType() {
    ReportData rd = new ReportData();

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new WebAnalyticUserActivityReportDataIndex(rd).buildSearchIndexDocInternal(doc);

    assertEquals("webAnalyticUserActivityReportData", result.get("entityType"));
  }

  @Test
  void testReportDataIndexes_notEntityInterface_noCommonFields() {
    ReportData rd = new ReportData();

    Map<String, Object> result = new EntityReportDataIndex(rd).buildSearchIndexDoc();

    // ReportData is NOT EntityInterface, so populateCommonFields is skipped
    assertFalse(result.containsKey("displayName"));
    assertFalse(result.containsKey("owners"));
    assertFalse(result.containsKey("domains"));
    // Should have entityType from buildSearchIndexDocInternal
    assertEquals("entityReportData", result.get("entityType"));
  }

  // ==================== ColumnSearchIndex =====================================================

  @Test
  void testColumnSearchIndex_setsColumnFields() {
    Column col =
        new Column()
            .withName("email")
            .withFullyQualifiedName("svc.db.sc.users.email")
            .withDataType(ColumnDataType.VARCHAR)
            .withDescription("User email")
            .withOrdinalPosition(1);

    Table parentTable =
        new Table()
            .withId(UUID.randomUUID())
            .withName("users")
            .withFullyQualifiedName("svc.db.sc.users")
            .withDeleted(false)
            .withVersion(1.0);

    ColumnSearchIndex index = new ColumnSearchIndex(col, parentTable);
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertNotNull(result.get("id"));
    assertEquals("email", result.get("name"));
    assertEquals("email", result.get("displayName"));
    assertEquals("svc.db.sc.users.email", result.get("fullyQualifiedName"));
    assertEquals("VARCHAR", result.get("dataType"));
    assertEquals("User email", result.get("description"));
    assertEquals(1, result.get("ordinalPosition"));
    assertEquals(Entity.TABLE_COLUMN, result.get("entityType"));
    assertEquals(false, result.get("deleted"));
    assertEquals("COMPLETE", result.get("descriptionStatus"));
  }

  @Test
  void testColumnSearchIndex_displayNameFallsBackToName() {
    Column col = new Column().withName("id").withFullyQualifiedName("svc.db.sc.t.id");
    Table parent = new Table().withId(UUID.randomUUID()).withName("t").withDeleted(false);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new ColumnSearchIndex(col, parent).buildSearchIndexDocInternal(doc);

    assertEquals("id", result.get("displayName"));
  }

  @Test
  void testColumnSearchIndex_setsTableReference() {
    Column col = new Column().withName("c").withFullyQualifiedName("svc.db.sc.t.c");
    Table parent =
        new Table()
            .withId(UUID.randomUUID())
            .withName("t")
            .withFullyQualifiedName("svc.db.sc.t")
            .withDisplayName("My Table")
            .withDeleted(false);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new ColumnSearchIndex(col, parent).buildSearchIndexDocInternal(doc);

    @SuppressWarnings("unchecked")
    Map<String, Object> tableRef = (Map<String, Object>) result.get("table");
    assertNotNull(tableRef);
    assertEquals("t", tableRef.get("name"));
    assertEquals("My Table", tableRef.get("displayName"));
  }

  @Test
  void testColumnSearchIndex_setsParentServiceFields() {
    EntityReference svc =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("databaseService")
            .withName("mysql");
    Column col = new Column().withName("c").withFullyQualifiedName("svc.db.sc.t.c");
    Table parent =
        new Table()
            .withId(UUID.randomUUID())
            .withName("t")
            .withFullyQualifiedName("svc.db.sc.t")
            .withDeleted(false)
            .withService(svc);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new ColumnSearchIndex(col, parent).buildSearchIndexDocInternal(doc);

    assertNotNull(result.get("service"));
  }

  @Test
  void testColumnSearchIndex_setsColumnTags() {
    TagLabel tag =
        new TagLabel().withTagFQN("PII.Email").withSource(TagLabel.TagSource.CLASSIFICATION);
    Column col =
        new Column()
            .withName("email")
            .withFullyQualifiedName("svc.db.sc.t.email")
            .withTags(List.of(tag));
    Table parent = new Table().withId(UUID.randomUUID()).withName("t").withDeleted(false);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new ColumnSearchIndex(col, parent).buildSearchIndexDocInternal(doc);

    assertNotNull(result.get("tags"));
    assertNotNull(result.get("classificationTags"));
    assertNotNull(result.get("glossaryTags"));
  }

  @Test
  void testColumnSearchIndex_descriptionStatusIncomplete() {
    Column col = new Column().withName("c").withFullyQualifiedName("svc.db.sc.t.c");
    Table parent = new Table().withId(UUID.randomUUID()).withName("t").withDeleted(false);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new ColumnSearchIndex(col, parent).buildSearchIndexDocInternal(doc);

    assertEquals("INCOMPLETE", result.get("descriptionStatus"));
  }

  // ==================== TestCaseResultIndex ===================================================

  @Test
  void testTestCaseResultIndex_setsTimestamp() {
    TestCaseResult tcr =
        new TestCaseResult().withTimestamp(99999L).withTestCaseFQN("svc.db.sc.t.myTest");

    // Mock Entity.getEntityByName to throw (test case not found)
    entityStaticMock
        .when(() -> Entity.getEntityByName(eq(Entity.TEST_CASE), anyString(), anyString(), any()))
        .thenThrow(new org.openmetadata.service.exception.EntityNotFoundException("not found"));

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TestCaseResultIndex(tcr).buildSearchIndexDocInternal(doc);

    assertEquals(99999L, result.get("@timestamp"));
  }

  @Test
  void testTestCaseResultIndex_enrichesFromTestCase() {
    TestCaseResult tcr =
        new TestCaseResult().withTimestamp(12345L).withTestCaseFQN("svc.db.sc.t.myTest");

    EntityReference domain =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("domain")
            .withName("eng")
            .withDisplayName("Engineering");

    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName("myTest")
            .withFullyQualifiedName("svc.db.sc.t.myTest")
            .withEntityLink("<#E::table::svc.db.sc.t>")
            .withDomains(List.of(domain));

    entityStaticMock
        .when(() -> Entity.getEntityByName(eq(Entity.TEST_CASE), anyString(), anyString(), any()))
        .thenReturn(testCase);

    // Mock table lookup in setParentRelationships to throw (table not found)
    entityStaticMock
        .when(() -> Entity.getEntityByName(eq(Entity.TABLE), anyString(), anyString(), any()))
        .thenThrow(
            new org.openmetadata.service.exception.EntityNotFoundException("table not found"));

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TestCaseResultIndex(tcr).buildSearchIndexDocInternal(doc);

    assertEquals(12345L, result.get("@timestamp"));
    assertNotNull(result.get("testCase"));
    assertNotNull(result.get("domains"));
  }

  @Test
  void testTestCaseResultIndex_getEntityTypeName() {
    TestCaseResult tcr = new TestCaseResult();
    assertEquals(Entity.TEST_CASE_RESULT, new TestCaseResultIndex(tcr).getEntityTypeName());
  }

  // ==================== TestCaseResolutionStatusIndex ==========================================

  @Test
  void testTestCaseResolutionStatusIndex_setsTimestampAndFqnParts() {
    EntityReference testCaseRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TEST_CASE)
            .withName("myTest")
            .withFullyQualifiedName("svc.db.sc.t.myTest");

    TestCaseResolutionStatus status =
        new TestCaseResolutionStatus()
            .withId(UUID.randomUUID())
            .withTimestamp(55555L)
            .withTestCaseReference(testCaseRef);

    // Mock: testCase not found
    entityStaticMock
        .when(() -> Entity.getEntityOrNull(any(EntityReference.class), anyString(), any()))
        .thenReturn(null);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new TestCaseResolutionStatusIndex(status).buildSearchIndexDocInternal(doc);

    assertEquals(55555L, result.get("@timestamp"));
    assertNotNull(result.get("fqnParts"));
  }

  @Test
  void testTestCaseResolutionStatusIndex_enrichesFromTestCase() {
    EntityReference testCaseRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TEST_CASE)
            .withName("myTest")
            .withFullyQualifiedName("svc.db.sc.t.myTest");

    TestCaseResolutionStatus status =
        new TestCaseResolutionStatus()
            .withId(UUID.randomUUID())
            .withTimestamp(55555L)
            .withTestCaseReference(testCaseRef);

    EntityReference domain =
        new EntityReference().withId(UUID.randomUUID()).withType("domain").withName("eng");

    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName("myTest")
            .withFullyQualifiedName("svc.db.sc.t.myTest")
            .withDomains(List.of(domain));

    entityStaticMock
        .when(
            () ->
                Entity.getEntityOrNull(
                    any(EntityReference.class), eq("testSuite,domains,tags,owners"), any()))
        .thenReturn(testCase);

    // TestSuite not found
    entityStaticMock
        .when(() -> Entity.getEntityOrNull(any(EntityReference.class), eq(""), any()))
        .thenReturn(null);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result =
        new TestCaseResolutionStatusIndex(status).buildSearchIndexDocInternal(doc);

    assertNotNull(result.get("testCase"));
    assertNotNull(result.get("domains"));
  }

  @Test
  void testTestCaseResolutionStatusIndex_getEntityTypeName() {
    EntityReference ref =
        new EntityReference().withId(UUID.randomUUID()).withFullyQualifiedName("test");
    TestCaseResolutionStatus status =
        new TestCaseResolutionStatus().withId(UUID.randomUUID()).withTestCaseReference(ref);
    assertEquals(
        Entity.TEST_CASE_RESOLUTION_STATUS,
        new TestCaseResolutionStatusIndex(status).getEntityTypeName());
  }
}

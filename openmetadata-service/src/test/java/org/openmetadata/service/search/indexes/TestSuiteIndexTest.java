package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

class TestSuiteIndexTest {

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

  @Test
  void testImplementsTaggableIndex() {
    TestSuite ts = new TestSuite().withId(UUID.randomUUID()).withName("ts");
    assertTrue(new TestSuiteIndex(ts) instanceof TaggableIndex);
  }

  @Test
  void testGetEntityTypeName() {
    TestSuite ts = new TestSuite().withId(UUID.randomUUID()).withName("ts");
    assertEquals(Entity.TEST_SUITE, new TestSuiteIndex(ts).getEntityTypeName());
  }

  @Test
  void testBuildSearchIndexDocInternal_onlyEntitySpecificFields() {
    TestSuite ts =
        new TestSuite()
            .withId(UUID.randomUUID())
            .withName("mySuite")
            .withFullyQualifiedName("mySuite");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TestSuiteIndex(ts).buildSearchIndexDocInternal(doc);

    // Entity-specific: lastResultTimestamp
    assertEquals(0L, result.get("lastResultTimestamp"));

    // Common fields NOT set by buildSearchIndexDocInternal
    assertFalse(result.containsKey("fqnParts"));
    assertFalse(result.containsKey("entityType"));
    assertFalse(result.containsKey("owners"));
    assertFalse(result.containsKey("tags"));
    assertFalse(result.containsKey("followers"));
    assertFalse(result.containsKey("displayName"));
  }

  @Test
  void testBuildSearchIndexDocInternal_lastResultTimestamp_withSummaries() {
    ResultSummary rs1 = new ResultSummary().withTimestamp(1000L);
    ResultSummary rs2 = new ResultSummary().withTimestamp(2000L);
    ResultSummary rs3 = new ResultSummary().withTimestamp(1500L);

    TestSuite ts =
        new TestSuite()
            .withId(UUID.randomUUID())
            .withName("suite")
            .withFullyQualifiedName("suite")
            .withTestCaseResultSummary(List.of(rs1, rs2, rs3));

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TestSuiteIndex(ts).buildSearchIndexDocInternal(doc);

    assertEquals(2000L, result.get("lastResultTimestamp"));
  }

  @Test
  void testBuildSearchIndexDocInternal_lastResultTimestamp_emptySummaries() {
    TestSuite ts =
        new TestSuite()
            .withId(UUID.randomUUID())
            .withName("suite")
            .withFullyQualifiedName("suite")
            .withTestCaseResultSummary(Collections.emptyList());

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TestSuiteIndex(ts).buildSearchIndexDocInternal(doc);

    assertEquals(0L, result.get("lastResultTimestamp"));
  }

  @Test
  void testBuildSearchIndexDoc_endToEnd_hasCommonAndTagFields() {
    TestSuite ts =
        new TestSuite()
            .withId(UUID.randomUUID())
            .withName("mySuite")
            .withFullyQualifiedName("mySuite");

    TagLabel tag =
        new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION);
    entityStaticMock
        .when(() -> Entity.getEntityTags(eq(Entity.TEST_SUITE), any()))
        .thenReturn(List.of(tag));

    Map<String, Object> result = new TestSuiteIndex(ts).buildSearchIndexDoc();

    // Common fields from populateCommonFields
    assertEquals("mySuite", result.get("displayName"));
    assertEquals(Entity.TEST_SUITE, result.get("entityType"));
    assertNotNull(result.get("owners"));
    assertNotNull(result.get("fqnParts"));

    // TaggableIndex fields
    assertNotNull(result.get("tags"));
    assertTrue(result.containsKey("tier"));
    assertTrue(result.containsKey("classificationTags"));
    assertTrue(result.containsKey("glossaryTags"));

    // Entity-specific
    assertEquals(0L, result.get("lastResultTimestamp"));
  }
}

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
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

class TestCaseIndexTest {

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

  private TestCase createTestCaseWithDefinition() {
    UUID testDefId = UUID.randomUUID();
    EntityReference testDefRef =
        new EntityReference().withId(testDefId).withType(Entity.TEST_DEFINITION);

    TestDefinition testDef =
        new TestDefinition()
            .withId(testDefId)
            .withTestPlatforms(List.of(TestPlatform.OPEN_METADATA))
            .withEntityType(TestDefinitionEntityType.COLUMN);

    entityStaticMock
        .when(() -> Entity.getEntity(eq(Entity.TEST_DEFINITION), eq(testDefId), anyString(), any()))
        .thenReturn(testDef);

    return new TestCase()
        .withId(UUID.randomUUID())
        .withName("columnValuesToBeBetween")
        .withFullyQualifiedName("svc.db.schema.table.columnValuesToBeBetween")
        .withEntityLink("<#E::table::svc.db.schema.table>")
        .withTestDefinition(testDefRef);
  }

  @Test
  void testImplementsTaggableIndex() {
    TestCase tc = new TestCase().withId(UUID.randomUUID()).withName("tc");
    assertTrue(new TestCaseIndex(tc) instanceof TaggableIndex);
  }

  @Test
  void testGetEntityTypeName() {
    TestCase tc = new TestCase().withId(UUID.randomUUID()).withName("tc");
    assertEquals(Entity.TEST_CASE, new TestCaseIndex(tc).getEntityTypeName());
  }

  @Test
  void testBuildSearchIndexDocInternal_onlyEntitySpecificFields() {
    TestCase tc = createTestCaseWithDefinition();

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TestCaseIndex(tc).buildSearchIndexDocInternal(doc);

    // Entity-specific fields present
    assertEquals("svc.db.schema.table", result.get("originEntityFQN"));
    assertNotNull(result.get("testPlatforms"));
    assertEquals(TestDefinitionEntityType.COLUMN, result.get("testCaseType"));

    // Common fields NOT set by buildSearchIndexDocInternal (handled by template method)
    assertFalse(result.containsKey("fqnParts"));
    assertFalse(result.containsKey("entityType"));
    assertFalse(result.containsKey("owners"));
    assertFalse(result.containsKey("tags"));
    assertFalse(result.containsKey("followers"));
    assertFalse(result.containsKey("displayName"));
  }

  @Test
  void testBuildSearchIndexDoc_endToEnd_hasCommonAndTagFields() {
    TestCase tc = createTestCaseWithDefinition();

    TagLabel tag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    entityStaticMock
        .when(() -> Entity.getEntityTags(eq(Entity.TEST_CASE), any()))
        .thenReturn(List.of(tag));

    Map<String, Object> result = new TestCaseIndex(tc).buildSearchIndexDoc();

    // Common fields from populateCommonFields
    assertEquals(Entity.TEST_CASE, result.get("entityType"));
    assertNotNull(result.get("owners"));
    assertNotNull(result.get("fqnParts"));

    // TaggableIndex fields from applyTagFields
    assertNotNull(result.get("tags"));
    assertTrue(result.containsKey("tier"));
    assertTrue(result.containsKey("classificationTags"));
    assertTrue(result.containsKey("glossaryTags"));

    // Entity-specific
    assertNotNull(result.get("originEntityFQN"));
  }

  @Test
  void testBuildSearchIndexDocInternal_testDefinitionNotFound() {
    UUID testDefId = UUID.randomUUID();
    EntityReference testDefRef =
        new EntityReference().withId(testDefId).withType(Entity.TEST_DEFINITION);

    TestCase tc =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName("myTest")
            .withFullyQualifiedName("svc.db.schema.table.myTest")
            .withEntityLink("<#E::table::svc.db.schema.table>")
            .withTestDefinition(testDefRef);

    entityStaticMock
        .when(() -> Entity.getEntity(eq(Entity.TEST_DEFINITION), eq(testDefId), anyString(), any()))
        .thenThrow(new EntityNotFoundException("not found"));

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TestCaseIndex(tc).buildSearchIndexDocInternal(doc);

    // Should still have originEntityFQN even when testDefinition not found
    assertNotNull(result.get("originEntityFQN"));
    // testPlatforms etc. should NOT be present
    assertFalse(result.containsKey("testPlatforms"));
  }
}

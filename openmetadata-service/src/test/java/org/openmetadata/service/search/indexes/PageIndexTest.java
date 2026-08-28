package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.jdbi3.KnowledgePageRepository.KNOWLEDGE_PAGE_ENTITY;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class PageIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo = mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  @Test
  void testGetEntityTypeName() {
    Page page = new Page().withId(UUID.randomUUID()).withName("p");
    assertEquals(KNOWLEDGE_PAGE_ENTITY, new PageIndex(page).getEntityTypeName());
  }

  @Test
  void testGetEntity() {
    Page page = new Page().withId(UUID.randomUUID()).withName("p");
    assertEquals(page, new PageIndex(page).getEntity());
  }

  @Test
  void testBuildSearchIndexDocInternal_setsFqnDepth() {
    Page page =
        new Page()
            .withId(UUID.randomUUID())
            .withName("child")
            .withFullyQualifiedName("root.parent.child");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new PageIndex(page).buildSearchIndexDocInternal(doc);

    assertEquals(3, result.get("fqnDepth"));
  }

  @Test
  void testBuildSearchIndexDocInternal_setsDeletedFalse() {
    Page page = new Page().withId(UUID.randomUUID()).withName("p").withFullyQualifiedName("root.p");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new PageIndex(page).buildSearchIndexDocInternal(doc);

    assertEquals(Boolean.FALSE, result.get("deleted"));
  }

  @Test
  void testBuildSearchIndexDocInternal_doesNotSetCommonFields() {
    Page page = new Page().withId(UUID.randomUUID()).withName("p").withFullyQualifiedName("root.p");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new PageIndex(page).buildSearchIndexDocInternal(doc);

    // Common fields are now auto-handled by the template method
    assertFalse(result.containsKey("owners"));
    assertFalse(result.containsKey("entityType"));
    assertFalse(result.containsKey("followers"));
    assertFalse(result.containsKey("totalVotes"));
    // Only entity-specific fields
    assertEquals(2, result.size()); // fqnDepth + deleted
  }

  @Test
  void testFqnDepth_singlePart() {
    Page page =
        new Page().withId(UUID.randomUUID()).withName("root").withFullyQualifiedName("root");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new PageIndex(page).buildSearchIndexDocInternal(doc);

    assertEquals(1, result.get("fqnDepth"));
  }

  @Test
  void testFqnDepth_nullFqn() {
    Page page = new Page().withId(UUID.randomUUID()).withName("p");

    PageIndex index = new PageIndex(page);
    assertEquals(0, index.calculateFqnDepth(null));
  }

  @Test
  void testFqnDepth_emptyFqn() {
    Page page = new Page().withId(UUID.randomUUID()).withName("p");

    PageIndex index = new PageIndex(page);
    assertEquals(0, index.calculateFqnDepth(""));
  }
}

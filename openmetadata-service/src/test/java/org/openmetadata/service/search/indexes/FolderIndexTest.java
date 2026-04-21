package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.jdbi3.FolderRepository.FOLDER_ENTITY;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class FolderIndexTest {

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
    Folder folder = new Folder().withId(UUID.randomUUID()).withName("folder");
    assertEquals(FOLDER_ENTITY, new FolderIndex(folder).getEntityTypeName());
  }

  @Test
  void testGetEntity() {
    Folder folder = new Folder().withId(UUID.randomUUID()).withName("folder");
    assertEquals(folder, new FolderIndex(folder).getEntity());
  }

  @Test
  void testBuildSearchIndexDocInternal_setsCommonFieldsAndParent() {
    EntityReference owner =
        new EntityReference().withId(UUID.randomUUID()).withType("user").withName("admin");
    EntityReference parent =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(FOLDER_ENTITY)
            .withName("parent")
            .withDisplayName("Parent");

    Folder folder =
        new Folder()
            .withId(UUID.randomUUID())
            .withName("child")
            .withFullyQualifiedName("parent.child")
            .withOwners(List.of(owner))
            .withParent(parent)
            .withChildrenCount(2);

    Map<String, Object> result =
        new FolderIndex(folder).buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(FOLDER_ENTITY, result.get("entityType"));
    assertEquals(Boolean.FALSE, result.get("deleted"));
    assertEquals(2, result.get("childrenCount"));
    assertNotNull(result.get("owners"));
    assertNotNull(result.get("parent"));
  }
}

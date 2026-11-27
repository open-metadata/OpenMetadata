package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.FolderRepository.FOLDER_ENTITY;

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
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
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
  void testBuildSearchIndexDocInternal_setsEntitySpecificFieldsOnly() {
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

    // Common fields (entityType, deleted, owners) are handled by populateCommonFields in the
    // SearchIndex template method, not in buildSearchIndexDocInternal. See PageIndexTest for
    // the same convention.
    assertFalse(result.containsKey("entityType"));
    assertFalse(result.containsKey("deleted"));
    assertFalse(result.containsKey("owners"));

    // Entity-specific fields; the count depends on who reads the folder, so it is not indexed.
    assertFalse(result.containsKey("childrenCount"));
    assertNotNull(result.get("parent"));
  }

  /** The builder starts from every field of the folder, a count it was read with included. */
  @Test
  void theIndexedDocumentLeavesOutAChildrenCountTheFolderCarries() {
    stubCommonFieldLookups();
    Folder folder =
        new Folder()
            .withId(UUID.randomUUID())
            .withName("counted")
            .withFullyQualifiedName("counted")
            .withChildrenCount(2);

    assertFalse(new FolderIndex(folder).buildSearchIndexDoc().containsKey("childrenCount"));
  }

  private static void stubCommonFieldLookups() {
    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any()))
        .thenReturn(Collections.emptyList());
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationships =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relationships);
    when(relationships.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);
  }
}

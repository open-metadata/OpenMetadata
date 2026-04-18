package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.jdbi3.ContextFileRepository.CONTEXT_FILE_ENTITY;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class ContextFileIndexTest {

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
    ContextFile file = new ContextFile().withId(UUID.randomUUID()).withName("file");
    assertEquals(CONTEXT_FILE_ENTITY, new ContextFileIndex(file).getEntityTypeName());
  }

  @Test
  void testGetEntity() {
    ContextFile file = new ContextFile().withId(UUID.randomUUID()).withName("file");
    assertEquals(file, new ContextFileIndex(file).getEntity());
  }

  @Test
  void testBuildSearchIndexDocInternal_setsCommonFieldsAndNormalizesDeleted() {
    EntityReference owner =
        new EntityReference().withId(UUID.randomUUID()).withType("user").withName("admin");
    EntityReference folder =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("folder")
            .withName("docs")
            .withDisplayName("Docs");

    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("quarterly-report")
            .withFullyQualifiedName("docs.quarterly-report")
            .withOwners(List.of(owner))
            .withFolder(folder)
            .withFileType(ContextFileType.PDF)
            .withVotes(new Votes().withUpVotes(3).withDownVotes(1));

    Map<String, Object> result =
        new ContextFileIndex(file).buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(CONTEXT_FILE_ENTITY, result.get("entityType"));
    assertEquals(Boolean.FALSE, result.get("deleted"));
    assertEquals(2, result.get("totalVotes"));
    assertEquals(ContextFileType.PDF, result.get("fileType"));
    assertNotNull(result.get("owners"));
    assertNotNull(result.get("folder"));
  }
}

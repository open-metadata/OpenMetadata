package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.ContextFileRepository.CONTEXT_FILE_ENTITY;

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
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
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
  void testBuildSearchIndexDocInternal_setsEntitySpecificFieldsOnly() {
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

    // Common fields (entityType, deleted, owners, totalVotes) are handled by
    // populateCommonFields in the SearchIndex template method, not in
    // buildSearchIndexDocInternal. See PageIndexTest for the same convention.
    assertFalse(result.containsKey("entityType"));
    assertFalse(result.containsKey("deleted"));
    assertFalse(result.containsKey("owners"));
    assertFalse(result.containsKey("totalVotes"));

    // Entity-specific fields
    assertEquals(ContextFileType.PDF, result.get("fileType"));
    assertNotNull(result.get("folder"));
  }

  @Test
  void theIndexedDocumentSaysWhetherTheFileWasNeverExtracted() {
    stubCommonFieldLookups();
    ContextFile uploadedWhileOff = processedFile();
    // The entity a write indexes may carry a stale value; the document computes its own.
    ContextFile extracted =
        processedFile()
            .withNeverExtracted(true)
            .withExtractionStats(
                new ExtractionStats()
                    .withChunksTotal(1)
                    .withChunksProcessed(1)
                    .withPillsCreated(0));

    assertEquals(
        Boolean.TRUE,
        new ContextFileIndex(uploadedWhileOff).buildSearchIndexDoc().get("neverExtracted"));
    assertEquals(
        Boolean.FALSE, new ContextFileIndex(extracted).buildSearchIndexDoc().get("neverExtracted"));
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

  private static ContextFile processedFile() {
    return new ContextFile()
        .withId(UUID.randomUUID())
        .withName("revenue-recognition.pdf")
        .withFullyQualifiedName("revenue-recognition.pdf")
        .withHeadContentId(UUID.randomUUID().toString())
        .withExtractedText("Revenue is recognised when the service is delivered.")
        .withProcessingStatus(ProcessingStatus.Processed);
  }
}

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;

/** neverExtracted is computed on read for the callers that ask, and never stored. */
@Isolated
class KnowledgePageRepositoryTest {
  private static final String NEVER_EXTRACTED = "neverExtracted";
  private KnowledgePageRepository repository;

  @BeforeEach
  void setUp() {
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.knowledgePageDAO()).thenReturn(mock(CollectionDAO.KnowledgePageDAO.class));
    when(dao.assetDAO()).thenReturn(mock(CollectionDAO.AssetDAO.class));
    Entity.setCollectionDAO(dao);
    Jdbi jdbi = mock(Jdbi.class);
    when(jdbi.onDemand(CollectionDAO.class)).thenReturn(dao);
    repository = new KnowledgePageRepository(jdbi);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void aReadThatAsksForNeverExtractedComputesIt() {
    Fields fields = repository.getFields(NEVER_EXTRACTED);
    Page writtenWhileOff = articleWrittenWhileExtractionWasOff();
    Page queued =
        articleWrittenWhileExtractionWasOff().withProcessingStatus(PageProcessingStatus.Queued);

    read(writtenWhileOff, fields);
    read(queued, fields);

    assertEquals(Boolean.TRUE, writtenWhileOff.getNeverExtracted());
    assertEquals(Boolean.FALSE, queued.getNeverExtracted());
  }

  @Test
  void aReadThatDoesNotAskLeavesNeverExtractedOut() {
    Page page = articleWrittenWhileExtractionWasOff().withNeverExtracted(true);

    read(page, repository.getFields(""));

    assertNull(page.getNeverExtracted());
  }

  @Test
  void aListComputesNeverExtractedForEachPage() {
    Page writtenWhileOff = articleWrittenWhileExtractionWasOff();
    Page failed =
        articleWrittenWhileExtractionWasOff().withProcessingStatus(PageProcessingStatus.Failed);

    repository.setFieldsInBulk(
        repository.getFields(NEVER_EXTRACTED), List.of(writtenWhileOff, failed));

    assertEquals(Boolean.TRUE, writtenWhileOff.getNeverExtracted());
    assertEquals(Boolean.FALSE, failed.getNeverExtracted());
  }

  @Test
  void neverExtractedIsNeitherStoredNorVersioned() {
    Page page = articleWrittenWhileExtractionWasOff().withNeverExtracted(true);

    assertFalse(repository.storageJsonNode(page).has(NEVER_EXTRACTED));
    assertFalse(
        JsonUtils.readTree(repository.serializeForVersionHistory(page)).has(NEVER_EXTRACTED));
    assertTrue(repository.storageJsonNode(page).has("description"));
  }

  private void read(Page page, Fields fields) {
    repository.setFieldsInternal(page, fields);
    repository.clearFieldsInternal(page, fields);
  }

  private static Page articleWrittenWhileExtractionWasOff() {
    return new Page()
        .withId(UUID.randomUUID())
        .withName("gdpr")
        .withPageType(PageType.ARTICLE)
        .withPage(new Article())
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withDescription("GDPR covers the personal data of every EU resident.");
  }
}

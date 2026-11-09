package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.api.context.ExtractionAvailability;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.context.center.AiProvider;
import org.openmetadata.service.context.center.AiProviderHolder;
import org.openmetadata.service.context.center.LlmAiProvider;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.EntityRepository.Operation;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.llm.NoopCompletionClient;

@Isolated
class ContextProcessingRepositoryTest {
  private ContextFileRepository repository;
  private KnowledgePageRepository pageRepository;

  @BeforeEach
  void setUp() {
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.contextFileDAO()).thenReturn(mock(CollectionDAO.ContextFileDAO.class));
    when(dao.contextFileContentDAO()).thenReturn(mock(CollectionDAO.ContextFileContentDAO.class));
    when(dao.knowledgePageDAO()).thenReturn(mock(CollectionDAO.KnowledgePageDAO.class));
    Entity.setCollectionDAO(dao);
    Jdbi jdbi = mock(Jdbi.class);
    when(jdbi.onDemand(CollectionDAO.class)).thenReturn(dao);
    repository = new ContextFileRepository(jdbi);
    pageRepository = new KnowledgePageRepository(jdbi);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
    AiProviderHolder.reset();
    LLMClientHolder.setForTesting(null);
  }

  @ParameterizedTest
  @CsvSource({"PATCH,100,101", "PUT,100,101", "PATCH,99,101", "PUT,150,150"})
  void updatesAdvanceTheTimestampEvenWithinOneMillisecond(
      Operation operation, long requestedTimestamp, long expectedTimestamp) {
    ContextFile original = file().withUpdatedAt(100L);
    ContextFile updated =
        JsonUtils.deepCopy(original, ContextFile.class).withUpdatedAt(requestedTimestamp);

    repository.getUpdater(original, updated, operation, ChangeSource.MANUAL);

    assertEquals(expectedTimestamp, updated.getUpdatedAt());
  }

  @ParameterizedTest
  @CsvSource({"PATCH,100,101", "PUT,100,101", "PATCH,99,101", "PUT,150,150"})
  void pageUpdatesAdvanceTheTimestampEvenWithinOneMillisecond(
      Operation operation, long requestedTimestamp, long expectedTimestamp) {
    Page original =
        new Page()
            .withId(UUID.randomUUID())
            .withName("page")
            .withUpdatedAt(100L)
            .withUpdatedBy(Entity.ADMIN_USER_NAME);
    Page updated = JsonUtils.deepCopy(original, Page.class).withUpdatedAt(requestedTimestamp);

    pageRepository.getUpdater(original, updated, operation, ChangeSource.MANUAL);

    assertEquals(expectedTimestamp, updated.getUpdatedAt());
  }

  @Test
  void conditionalWriteRestoresTheFolderWhenTheRowChanged() {
    EntityReference folder =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.FOLDER);
    ContextFile updated = file().withFolder(folder);

    assertThrows(
        PreconditionFailedException.class,
        () -> repository.storeEntityWithVersion(updated, true, 0.2, 100L));

    assertEquals(folder, updated.getFolder());
  }

  /** The Queued stamp asks the scheduler's gate, so no article is left Queued without a job. */
  @Test
  void aNewArticleIsQueuedOnlyWhileTheProviderCanExtract() {
    LLMClientHolder.setForTesting(new NoopCompletionClient());
    AiProvider unavailable = mock(AiProvider.class);
    when(unavailable.extractionAvailability())
        .thenReturn(
            new ExtractionAvailability()
                .withAvailable(false)
                .withReason(ExtractionAvailability.Reason.ProviderUnavailable));
    AiProviderHolder.setForTesting(unavailable);
    Page whileUnavailable = articleWithBody();
    pageRepository.prepare(whileUnavailable, false);

    AiProviderHolder.setForTesting(new LlmAiProvider());
    Page whileAvailable = articleWithBody();
    pageRepository.prepare(whileAvailable, false);

    assertNull(whileUnavailable.getProcessingStatus());
    assertEquals(PageProcessingStatus.Queued, whileAvailable.getProcessingStatus());
  }

  private static Page articleWithBody() {
    return new Page()
        .withId(UUID.randomUUID())
        .withName("runbook")
        .withPageType(PageType.ARTICLE)
        .withPage(new Article())
        .withDescription("Restart the ingestion worker before the nightly run.");
  }

  private ContextFile file() {
    return new ContextFile()
        .withId(UUID.randomUUID())
        .withName("report")
        .withFullyQualifiedName("report")
        .withVersion(0.3)
        .withUpdatedBy(Entity.ADMIN_USER_NAME);
  }
}

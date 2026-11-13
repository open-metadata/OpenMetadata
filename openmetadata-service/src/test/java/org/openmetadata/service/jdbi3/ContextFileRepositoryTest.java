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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository.Operation;
import org.openmetadata.service.util.EntityUtil.Fields;

@Isolated
class ContextFileRepositoryTest {
  private static final String NEVER_EXTRACTED = "neverExtracted";
  private ContextFileRepository repository;

  @BeforeEach
  void setUp() {
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.contextFileDAO()).thenReturn(mock(CollectionDAO.ContextFileDAO.class));
    when(dao.contextFileContentDAO()).thenReturn(mock(CollectionDAO.ContextFileContentDAO.class));
    Entity.setCollectionDAO(dao);
    Jdbi jdbi = mock(Jdbi.class);
    when(jdbi.onDemand(CollectionDAO.class)).thenReturn(dao);
    repository = new ContextFileRepository(jdbi);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @ParameterizedTest
  @EnumSource(
      value = Operation.class,
      names = {"PATCH", "PUT"})
  void updatesKeepStoredContentReferences(Operation operation) {
    ContextFile original = storedFile();
    ContextFile updated =
        JsonUtils.deepCopy(original, ContextFile.class)
            .withAssetId("another-asset")
            .withHeadContentId(UUID.randomUUID().toString())
            .withDescription("Updated description");

    repository.getUpdater(original, updated, operation, ChangeSource.MANUAL);

    assertEquals(original.getAssetId(), updated.getAssetId());
    assertEquals(original.getHeadContentId(), updated.getHeadContentId());
    assertEquals("Updated description", updated.getDescription());
  }

  @ParameterizedTest
  @EnumSource(
      value = Operation.class,
      names = {"PATCH", "PUT"})
  void updatesCannotClearStoredContentReferences(Operation operation) {
    ContextFile original = storedFile();
    ContextFile updated =
        new ContextFile()
            .withId(original.getId())
            .withName(original.getName())
            .withUpdatedBy(Entity.ADMIN_USER_NAME);

    repository.getUpdater(original, updated, operation, ChangeSource.MANUAL);

    assertEquals(original.getAssetId(), updated.getAssetId());
    assertEquals(original.getHeadContentId(), updated.getHeadContentId());
  }

  @ParameterizedTest
  @EnumSource(
      value = Operation.class,
      names = {"PATCH", "PUT"})
  void metadataOnlyFilesCannotAcquireContentReferences(Operation operation) {
    ContextFile original =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("notes")
            .withUpdatedBy(Entity.ADMIN_USER_NAME);
    ContextFile updated =
        JsonUtils.deepCopy(original, ContextFile.class)
            .withAssetId("another-asset")
            .withHeadContentId(UUID.randomUUID().toString());

    repository.getUpdater(original, updated, operation, ChangeSource.MANUAL);

    assertNull(updated.getAssetId());
    assertNull(updated.getHeadContentId());
  }

  @Test
  void aReadThatAsksForNeverExtractedComputesIt() {
    Fields fields = repository.getFields(NEVER_EXTRACTED);
    ContextFile uploadedWhileOff = uploadedWhileExtractionWasOff();
    ContextFile extracted = extractedIntoNoMemories();

    read(uploadedWhileOff, fields);
    read(extracted, fields);

    assertEquals(Boolean.TRUE, uploadedWhileOff.getNeverExtracted());
    assertEquals(Boolean.FALSE, extracted.getNeverExtracted());
  }

  @Test
  void aReadThatDoesNotAskLeavesNeverExtractedOut() {
    ContextFile file = uploadedWhileExtractionWasOff().withNeverExtracted(true);

    read(file, repository.getFields(""));

    assertNull(file.getNeverExtracted());
  }

  @Test
  void aListComputesNeverExtractedForEachFile() {
    ContextFile uploadedWhileOff = uploadedWhileExtractionWasOff();
    ContextFile extracted = extractedIntoNoMemories();

    repository.setFieldsInBulk(
        repository.getFields(NEVER_EXTRACTED), List.of(uploadedWhileOff, extracted));

    assertEquals(Boolean.TRUE, uploadedWhileOff.getNeverExtracted());
    assertEquals(Boolean.FALSE, extracted.getNeverExtracted());
  }

  @Test
  void neverExtractedIsNeitherStoredNorVersioned() {
    ContextFile file = uploadedWhileExtractionWasOff().withNeverExtracted(true);

    assertFalse(repository.storageJsonNode(file).has(NEVER_EXTRACTED));
    assertFalse(
        JsonUtils.readTree(repository.serializeForVersionHistory(file)).has(NEVER_EXTRACTED));
    assertTrue(repository.storageJsonNode(file).has("headContentId"));
  }

  private void read(ContextFile file, Fields fields) {
    repository.setFieldsInternal(file, fields);
    repository.clearFieldsInternal(file, fields);
  }

  private static ContextFile uploadedWhileExtractionWasOff() {
    return new ContextFile()
        .withId(UUID.randomUUID())
        .withName("revenue-recognition.pdf")
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withHeadContentId(UUID.randomUUID().toString())
        .withExtractedText("Revenue is recognised when the service is delivered.")
        .withProcessingStatus(ProcessingStatus.Processed);
  }

  private static ContextFile extractedIntoNoMemories() {
    return uploadedWhileExtractionWasOff()
        .withExtractionStats(
            new ExtractionStats().withChunksTotal(1).withChunksProcessed(1).withPillsCreated(0));
  }

  private ContextFile storedFile() {
    return new ContextFile()
        .withId(UUID.randomUUID())
        .withName("report")
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withAssetId("stored-asset")
        .withHeadContentId(UUID.randomUUID().toString());
  }
}

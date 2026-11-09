package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.entity.data.QuickLink;

/** A document reads "Not processed" when its memories were never extracted. */
class MemoryExtractionStateTest {

  private static final MemoryShareConfig PRIVATE =
      new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE).withSharedWith(List.of());

  @Test
  void aFileUploadedWhileExtractionWasOffWasNeverExtracted() {
    assertTrue(MemoryExtractionState.neverExtracted(uploadedWhileExtractionWasOff()));
  }

  @Test
  void aFileExtractedIntoNoMemoriesStaysProcessed() {
    ContextFile extractedIntoNone =
        uploadedWhileExtractionWasOff()
            .withExtractionStats(
                new ExtractionStats()
                    .withChunksTotal(1)
                    .withChunksProcessed(1)
                    .withPillsCreated(0)
                    .withLastExtractedAt(System.currentTimeMillis())
                    .withSourceHash("c0ffee"));

    assertFalse(MemoryExtractionState.neverExtracted(extractedIntoNone));
  }

  // ChatUploadDocumentService mirrors an attachment as a Private, Processed file with no snapshot.
  @Test
  void aChatAttachmentStaysProcessed() {
    ContextFile chatAttachment =
        uploadedWhileExtractionWasOff().withHeadContentId(null).withShareConfig(PRIVATE);

    assertFalse(MemoryExtractionState.neverExtracted(chatAttachment));
  }

  @Test
  void aPrivateUploadWithASnapshotWasStillNeverExtracted() {
    assertTrue(
        MemoryExtractionState.neverExtracted(
            uploadedWhileExtractionWasOff().withShareConfig(PRIVATE)));
  }

  @ParameterizedTest
  @EnumSource(value = ProcessingStatus.class, names = "Processed", mode = EnumSource.Mode.EXCLUDE)
  void onlyAProcessedFileCanBeNotProcessed(ProcessingStatus status) {
    assertFalse(
        MemoryExtractionState.neverExtracted(
            uploadedWhileExtractionWasOff().withProcessingStatus(status)));
  }

  @Test
  void anArticleWrittenWhileExtractionWasOffWasNeverExtracted() {
    assertTrue(MemoryExtractionState.neverExtracted(articleWrittenWhileExtractionWasOff()));
  }

  @ParameterizedTest
  @EnumSource(PageProcessingStatus.class)
  void anArticleOnceQueuedForExtractionKeepsItsStatus(PageProcessingStatus status) {
    assertFalse(
        MemoryExtractionState.neverExtracted(
            articleWrittenWhileExtractionWasOff().withProcessingStatus(status)));
  }

  @Test
  void anArticleWithoutABodyHasNothingToExtract() {
    assertFalse(
        MemoryExtractionState.neverExtracted(
            articleWrittenWhileExtractionWasOff().withDescription(null)));
    assertFalse(
        MemoryExtractionState.neverExtracted(
            articleWrittenWhileExtractionWasOff().withDescription(" \n\t ")));
  }

  @Test
  void onlyAnArticleCanBeNotProcessed() {
    Page quickLink =
        articleWrittenWhileExtractionWasOff()
            .withPageType(PageType.QUICK_LINK)
            .withPage(new QuickLink().withUrl(URI.create("https://example.com/gdpr")));

    assertFalse(MemoryExtractionState.neverExtracted(quickLink));
  }

  private static ContextFile uploadedWhileExtractionWasOff() {
    return new ContextFile()
        .withId(UUID.randomUUID())
        .withName("revenue-recognition.pdf")
        .withAssetId(UUID.randomUUID().toString())
        .withHeadContentId(UUID.randomUUID().toString())
        .withProcessingStatus(ProcessingStatus.Processed);
  }

  private static Page articleWrittenWhileExtractionWasOff() {
    return new Page()
        .withId(UUID.randomUUID())
        .withName("gdpr")
        .withPageType(PageType.ARTICLE)
        .withPage(new Article())
        .withDescription("GDPR covers the personal data of every EU resident.");
  }
}

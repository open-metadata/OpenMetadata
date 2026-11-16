package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
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
  private static final String ARTICLE_BODY = "GDPR covers the personal data of every EU resident.";

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

  // A scanned PDF or an empty text file: the engine skips a source with no text, so Extract
  // would never change the label.
  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {" \n\t "})
  void aFileWithoutTextStaysProcessed(String extractedText) {
    assertFalse(
        MemoryExtractionState.neverExtracted(
            uploadedWhileExtractionWasOff().withExtractedText(extractedText)));
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

  // A run waiting or in flight reads Queued or Processing, and a failed one gets Retry instead.
  @ParameterizedTest
  @EnumSource(
      value = PageProcessingStatus.class,
      names = {"Queued", "Processing", "Failed"})
  void anArticleWithARunPendingOrFailedKeepsItsStatus(PageProcessingStatus status) {
    assertFalse(
        MemoryExtractionState.neverExtracted(
            articleWrittenWhileExtractionWasOff().withProcessingStatus(status)));
  }

  @Test
  void anArticleExtractedFromItsCurrentBodyStaysProcessed() {
    assertFalse(
        MemoryExtractionState.neverExtracted(
            extractedFrom(ARTICLE_BODY, articleWrittenWhileExtractionWasOff())));
  }

  // Extraction was off when the body changed, so the article kept the earlier run's status.
  @Test
  void anArticleEditedWhileExtractionWasOffWasNeverExtracted() {
    assertTrue(
        MemoryExtractionState.neverExtracted(
            extractedFrom("An earlier draft.", articleWrittenWhileExtractionWasOff())));
  }

  // A run over an empty body stamps Processed with no stats; this body came afterwards.
  @Test
  void anArticleGivenABodyAfterAnEmptyRunWasNeverExtracted() {
    assertTrue(
        MemoryExtractionState.neverExtracted(
            articleWrittenWhileExtractionWasOff()
                .withProcessingStatus(PageProcessingStatus.Processed)));
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
        .withExtractedText("Revenue is recognised when the service is delivered.")
        .withProcessingStatus(ProcessingStatus.Processed);
  }

  private static Page articleWrittenWhileExtractionWasOff() {
    return new Page()
        .withId(UUID.randomUUID())
        .withName("gdpr")
        .withPageType(PageType.ARTICLE)
        .withPage(new Article())
        .withDescription(ARTICLE_BODY);
  }

  /** The page as a completed run over {@code body} leaves it. */
  private static Page extractedFrom(String body, Page page) {
    return page.withProcessingStatus(PageProcessingStatus.Processed)
        .withExtractionStats(
            new ExtractionStats()
                .withChunksTotal(1)
                .withChunksProcessed(1)
                .withPillsCreated(1)
                .withSourceHash(PageContextProcessingEngine.sourceHash(body)));
  }
}

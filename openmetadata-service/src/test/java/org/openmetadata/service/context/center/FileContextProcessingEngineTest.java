package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextFileRepository;

@ExtendWith(MockitoExtension.class)
class FileContextProcessingEngineTest {
  @Mock private ContextFileRepository repository;
  @Mock private DocumentMemoryExtractor extractor;
  @Mock private ContextMemoryReconciler reconciler;

  @Test
  void identicalFileReusesProcessedMemoriesWithoutCallingExtractor() {
    UUID fileId = UUID.randomUUID();
    UUID contentId = UUID.randomUUID();
    ContextFile file =
        new ContextFile()
            .withId(fileId)
            .withName("copy.md")
            .withHeadContentId(contentId.toString());
    ContextFile prior =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("original.md")
            .withProcessingStatus(ProcessingStatus.Processed)
            .withExtractionStats(new ExtractionStats().withChunksTotal(2).withChunksProcessed(2));
    ContextFileContent content =
        new ContextFileContent()
            .withId(contentId)
            .withChecksum("same-hash")
            .withExtractedText("same facts");
    when(repository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(file);
    when(repository.getContentById(contentId.toString())).thenReturn(content);
    when(repository.listByExtractedSourceHash("same-hash", fileId)).thenReturn(List.of(prior));
    when(reconciler.reuseExtractedFrom(file.getEntityReference(), prior.getEntityReference()))
        .thenReturn(new ContextMemoryReconciler.ReconcileResult(0, 0, 6, 0));

    ContextProcessingEngine.ExtractionOutcome outcome =
        new FileContextProcessingEngine(repository, extractor, reconciler).runExtraction(fileId);

    assertFalse(outcome.skipped());
    assertEquals(0, outcome.stats().getPillsCreated());
    assertEquals("same-hash", outcome.stats().getSourceHash());
    assertEquals(6, outcome.reconciled().kept());
    verify(extractor, never()).derive(any(), any(), any());
    ArgumentCaptor<ContextFile> updated = ArgumentCaptor.forClass(ContextFile.class);
    verify(repository).update(isNull(), eq(file), updated.capture(), eq(Entity.ADMIN_USER_NAME));
    assertEquals("same-hash", updated.getValue().getExtractionStats().getSourceHash());
  }
}

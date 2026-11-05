package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jobs.BackgroundJobException;

class ContextMemoryExtractionJobHandlerTest {
  private final PageContextProcessingEngine pageEngine = mock(PageContextProcessingEngine.class);
  private final ContextFileProcessingService fileService = mock(ContextFileProcessingService.class);
  private final ContextMemoryExtractionJobHandler handler =
      new ContextMemoryExtractionJobHandler(() -> pageEngine, () -> fileService);

  @Test
  void dispatchesArticleMemoryToThePageEngine() {
    UUID pageId = UUID.randomUUID();

    handler.runJob(job(ContextMemoryExtractionJobHandler.Args.page(pageId)));

    verify(pageEngine).runQueued(pageId);
  }

  @Test
  void dispatchesUploadedFileMemoryToTheFileService() {
    UUID fileId = UUID.randomUUID();
    UUID contentId = UUID.randomUUID();

    handler.runJob(job(ContextMemoryExtractionJobHandler.Args.file(fileId, contentId)));

    verify(fileService).runMemoryExtraction(fileId, contentId);
  }

  @Test
  void rejectsAFileJobWithoutItsContentSnapshot() {
    UUID fileId = UUID.randomUUID();
    ContextMemoryExtractionJobHandler.Args args =
        new ContextMemoryExtractionJobHandler.Args(Entity.CONTEXT_FILE, fileId, null, "bad");

    assertThrows(BackgroundJobException.class, () -> handler.runJob(job(args)));
  }

  @Test
  void fileFailureUsesSourceNeutralJobMessage() {
    UUID fileId = UUID.randomUUID();
    UUID contentId = UUID.randomUUID();
    doThrow(new IllegalStateException("unavailable"))
        .when(fileService)
        .runMemoryExtraction(fileId, contentId);

    BackgroundJobException error =
        assertThrows(
            BackgroundJobException.class,
            () ->
                handler.runJob(
                    job(ContextMemoryExtractionJobHandler.Args.file(fileId, contentId))));

    assertTrue(error.getMessage().contains("Context memory extraction failed"));
  }

  private BackgroundJob job(ContextMemoryExtractionJobHandler.Args args) {
    BackgroundJob job = new BackgroundJob();
    job.setId(1L);
    job.setJobArgs(args);
    return job;
  }
}

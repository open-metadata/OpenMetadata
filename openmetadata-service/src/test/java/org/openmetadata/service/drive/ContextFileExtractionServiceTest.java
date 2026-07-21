package org.openmetadata.service.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.AssetRepository;
import org.openmetadata.service.jdbi3.ContextFileContentRepository;
import org.openmetadata.service.jdbi3.ContextFileRepository;

@ExtendWith(MockitoExtension.class)
class ContextFileExtractionServiceTest {

  @Mock private ContextFileRepository repository;
  @Mock private ContextFileContentRepository contentRepository;
  @Mock private AssetRepository assetRepository;
  @Mock private AssetService assetService;
  @Mock private ContextFileTextExtractor textExtractor;

  @Captor private ArgumentCaptor<ContextFile> updatedFileCaptor;
  @Captor private ArgumentCaptor<ContextFileContent> updatedContentCaptor;

  private UUID fileId;
  private UUID contentId;
  private ContextFile file;
  private ContextFileContent content;
  private Asset asset;

  @BeforeEach
  void setUp() {
    fileId = UUID.randomUUID();
    contentId = UUID.randomUUID();

    file =
        new ContextFile()
            .withId(fileId)
            .withName("report")
            .withFileType(ContextFileType.PDF)
            .withFileExtension("pdf")
            .withHeadContentId(contentId.toString())
            .withProcessingStatus(ProcessingStatus.Uploaded);

    content =
        new ContextFileContent()
            .withId(contentId)
            .withName("v1")
            .withAssetId("asset-1")
            .withContextFile(file.getEntityReference())
            .withProcessingStatus(ProcessingStatus.Uploaded);

    asset = new Asset();
    asset.setId("asset-1");

    lenient().when(repository.getContentRepository()).thenReturn(contentRepository);
    lenient().when(repository.getAssetRepository()).thenReturn(assetRepository);
    lenient()
        .when(repository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(file);
    lenient().when(contentRepository.getById(contentId)).thenReturn(content);
    lenient().when(assetRepository.getById("asset-1")).thenReturn(asset);
  }

  @Test
  void processSuccessMarksAnalyzingThenProcessed() throws Exception {
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    verify(repository, times(2))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    verify(contentRepository, times(2))
        .updateIfCurrent(isNull(), same(content), updatedContentCaptor.capture(), anyString());

    List<ContextFile> fileUpdates = updatedFileCaptor.getAllValues();
    assertEquals(ProcessingStatus.Analyzing, fileUpdates.get(0).getProcessingStatus());
    assertEquals(ProcessingStatus.Processed, fileUpdates.get(1).getProcessingStatus());
    assertEquals("Quarterly results", fileUpdates.get(1).getExtractedText());
    assertEquals(3, fileUpdates.get(1).getPageCount());

    List<ContextFileContent> contentUpdates = updatedContentCaptor.getAllValues();
    assertEquals(ProcessingStatus.Analyzing, contentUpdates.get(0).getProcessingStatus());
    assertNull(contentUpdates.get(0).getProcessingError());
    assertEquals(ProcessingStatus.Processed, contentUpdates.get(1).getProcessingStatus());
    assertEquals("Quarterly results", contentUpdates.get(1).getExtractedText());
  }

  @Test
  void processMarksFailureWhenObjectStorageIsUnavailable() {
    service(Runnable::run, () -> null).process(fileId, contentId);

    verifyFailedWith("Object storage is not configured for text extraction");
  }

  @Test
  void processMarksFailureWhenStorageReadReturnsNullStream() {
    when(assetService.read(asset)).thenReturn(CompletableFuture.completedFuture(null));

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    verifyFailedWith("Unable to read file content from object storage");
  }

  @Test
  void submitMarksFailureWhenExecutorRejectsWork() {
    Executor rejectingExecutor =
        task -> {
          throw new RejectedExecutionException("queue full");
        };

    service(rejectingExecutor, () -> assetService).submit(fileId, contentId);

    verifyImmediateFailureWith("Text extraction queue is full. Please retry later.");
    verify(assetService, never()).read(any());
  }

  @Test
  void processSkipsWhenHeadContentNoLongerMatches() {
    file.setHeadContentId(UUID.randomUUID().toString());

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    verify(repository, never()).updateIfCurrent(any(), any(), any(), anyString());
    verify(contentRepository, never()).updateIfCurrent(any(), any(), any(), anyString());
    verify(assetService, never()).read(any());
  }

  @Test
  void processDoesNotPublishResultWhenDeleteWinsConditionalWriteRace() throws Exception {
    AtomicBoolean deleted = new AtomicBoolean();
    AtomicInteger fileWriteAttempts = new AtomicInteger();
    CountDownLatch finalWriteStarted = new CountDownLatch(1);
    CountDownLatch deleteCommitted = new CountDownLatch(1);

    when(repository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenAnswer(ignored -> deleted.get() ? null : file);
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));
    when(repository.updateIfCurrent(isNull(), same(file), any(ContextFile.class), anyString()))
        .thenAnswer(
            invocation -> {
              if (fileWriteAttempts.incrementAndGet() == 2) {
                finalWriteStarted.countDown();
                if (!deleteCommitted.await(5, TimeUnit.SECONDS)) {
                  throw new IllegalStateException("Timed out waiting for simulated hard delete");
                }
                throw new PreconditionFailedException("Context file was deleted");
              }
              return null;
            });

    CompletableFuture<Void> processing =
        CompletableFuture.runAsync(
            () -> service(Runnable::run, () -> assetService).process(fileId, contentId));

    assertTrue(finalWriteStarted.await(5, TimeUnit.SECONDS));
    deleted.set(true);
    deleteCommitted.countDown();
    processing.get(5, TimeUnit.SECONDS);

    assertEquals(2, fileWriteAttempts.get());
    verify(repository, times(2))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    assertEquals(
        List.of(ProcessingStatus.Analyzing, ProcessingStatus.Processed),
        updatedFileCaptor.getAllValues().stream().map(ContextFile::getProcessingStatus).toList());
  }

  @Test
  void processKeepsRetryingTerminalUpdateAfterRepeatedConflicts() throws Exception {
    AtomicInteger contentWriteAttempts = new AtomicInteger();
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));
    when(contentRepository.updateIfCurrent(
            isNull(), same(content), any(ContextFileContent.class), anyString()))
        .thenAnswer(
            invocation -> {
              int attempt = contentWriteAttempts.incrementAndGet();
              if (attempt >= 2 && attempt <= 4) {
                throw new PreconditionFailedException("Concurrent content update");
              }
              return null;
            });

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    assertEquals(5, contentWriteAttempts.get());
    verify(contentRepository, times(5))
        .updateIfCurrent(isNull(), same(content), updatedContentCaptor.capture(), anyString());
    assertEquals(
        ProcessingStatus.Processed,
        updatedContentCaptor.getAllValues().getLast().getProcessingStatus());
    verify(repository, times(2))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    assertEquals(
        ProcessingStatus.Processed,
        updatedFileCaptor.getAllValues().getLast().getProcessingStatus());
  }

  @Test
  void processYieldsAndRequeuesAfterSustainedConflicts() throws Exception {
    AtomicBoolean conflict = new AtomicBoolean(true);
    AtomicInteger fileWriteAttempts = new AtomicInteger();
    AtomicReference<Runnable> requeued = new AtomicReference<>();
    when(repository.updateIfCurrent(isNull(), same(file), any(ContextFile.class), anyString()))
        .thenAnswer(
            invocation -> {
              fileWriteAttempts.incrementAndGet();
              if (conflict.get()) {
                throw new PreconditionFailedException("Concurrent file update");
              }
              return null;
            });
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));

    service(requeued::set, () -> assetService).process(fileId, contentId);

    assertEquals(10, fileWriteAttempts.get());
    Runnable retry = requeued.getAndSet(null);
    assertNotNull(retry);

    conflict.set(false);
    retry.run();

    assertNull(requeued.get());
    assertEquals(12, fileWriteAttempts.get());
    verify(contentRepository, times(2))
        .updateIfCurrent(isNull(), same(content), updatedContentCaptor.capture(), anyString());
    assertEquals(
        ProcessingStatus.Processed,
        updatedContentCaptor.getAllValues().getLast().getProcessingStatus());
  }

  @Test
  void processRethrowsVirtualMachineErrors() throws Exception {
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(new ByteArrayInputStream(new byte[] {1, 2, 3})));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenThrow(new InternalError("fatal"));

    assertThrows(
        InternalError.class,
        () -> service(Runnable::run, () -> assetService).process(fileId, contentId));
  }

  private void verifyFailedWith(String expectedReason) {
    verify(repository, times(2))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    verify(contentRepository, times(2))
        .updateIfCurrent(isNull(), same(content), updatedContentCaptor.capture(), anyString());

    List<ContextFile> fileUpdates = updatedFileCaptor.getAllValues();
    assertEquals(ProcessingStatus.Analyzing, fileUpdates.get(0).getProcessingStatus());
    assertEquals(ProcessingStatus.Failed, fileUpdates.get(1).getProcessingStatus());
    assertNull(fileUpdates.get(1).getExtractedText());
    assertNull(fileUpdates.get(1).getPageCount());

    List<ContextFileContent> contentUpdates = updatedContentCaptor.getAllValues();
    assertEquals(ProcessingStatus.Analyzing, contentUpdates.get(0).getProcessingStatus());
    assertEquals(ProcessingStatus.Failed, contentUpdates.get(1).getProcessingStatus());
    assertEquals(expectedReason, contentUpdates.get(1).getProcessingError());
    assertNull(contentUpdates.get(1).getExtractedText());
  }

  private void verifyImmediateFailureWith(String expectedReason) {
    verify(repository)
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    verify(contentRepository)
        .updateIfCurrent(isNull(), same(content), updatedContentCaptor.capture(), anyString());

    ContextFile fileUpdate = updatedFileCaptor.getValue();
    assertEquals(ProcessingStatus.Failed, fileUpdate.getProcessingStatus());
    assertNull(fileUpdate.getExtractedText());
    assertNull(fileUpdate.getPageCount());

    ContextFileContent contentUpdate = updatedContentCaptor.getValue();
    assertEquals(ProcessingStatus.Failed, contentUpdate.getProcessingStatus());
    assertEquals(expectedReason, contentUpdate.getProcessingError());
    assertNull(contentUpdate.getExtractedText());
  }

  private ContextFileExtractionService service(
      Executor executor, Supplier<AssetService> assetServiceSupplier) {
    return new ContextFileExtractionService(
        repository, assetServiceSupplier, executor, textExtractor);
  }
}

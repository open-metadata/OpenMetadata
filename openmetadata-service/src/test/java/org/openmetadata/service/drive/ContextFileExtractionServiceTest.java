package org.openmetadata.service.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
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
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.entity.EntityFieldPolicyFixture;
import org.openmetadata.service.entity.read.EntityReadFixture;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityPutService;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.AssetRepository;
import org.openmetadata.service.jdbi3.ContextFileContentRepository;
import org.openmetadata.service.jdbi3.ContextFileRepository;

@ExtendWith(MockitoExtension.class)
class ContextFileExtractionServiceTest {

  private static final String UPLOADER = "test.user";

  @Mock private ContextFileRepository repository;
  @Mock private ContextFileContentRepository contentRepository;
  @Mock private AssetRepository assetRepository;
  @Mock private AssetService assetService;
  @Mock private ContextFileTextExtractor textExtractor;

  private final List<ContextFile> fileUpdates = new ArrayList<>();
  private final List<ContextFileContent> contentUpdates = new ArrayList<>();
  private Consumer<ContextFile> fileWrite = entity -> {};
  private Consumer<ContextFileContent> contentWrite = entity -> {};

  private UUID fileId;
  private UUID contentId;
  private ContextFile file;
  private ContextFileContent content;
  private Asset asset;

  @BeforeEach
  void setUp() {
    lenient()
        .when(repository.fieldPolicy())
        .thenReturn(EntityFieldPolicyFixture.forEntity(ContextFile.class));
    lenient()
        .when(repository.puts())
        .thenReturn(
            (uri, original, updated, actor, mode) -> {
              assertNull(uri);
              assertEquals(file, original);
              assertEquals(new EntityCommandActor(UPLOADER, null), actor);
              assertEquals(EntityPutService.Mode.OPTIMISTIC, mode);
              fileUpdates.add(updated);
              fileWrite.accept(updated);
              return null;
            });
    lenient()
        .when(contentRepository.puts())
        .thenReturn(
            (uri, original, updated, actor, mode) -> {
              assertNull(uri);
              assertEquals(content, original);
              assertEquals(new EntityCommandActor(UPLOADER, null), actor);
              assertEquals(EntityPutService.Mode.OPTIMISTIC, mode);
              contentUpdates.add(updated);
              contentWrite.accept(updated);
              return null;
            });
    fileId = UUID.randomUUID();

    contentId = UUID.randomUUID();

    file =
        new ContextFile()
            .withId(fileId)
            .withName("report")
            .withFileType(ContextFileType.PDF)
            .withFileExtension("pdf")
            .withHeadContentId(contentId.toString())
            .withProcessingStatus(ProcessingStatus.Uploaded)
            .withUpdatedBy(UPLOADER);

    content =
        new ContextFileContent()
            .withId(contentId)
            .withName("v1")
            .withAssetId("asset-1")
            .withContextFile(file.getEntityReference())
            .withProcessingStatus(ProcessingStatus.Uploaded)
            .withUpdatedBy(UPLOADER);

    asset = new Asset();
    asset.setId("asset-1");

    lenient().when(repository.getContentRepository()).thenReturn(contentRepository);
    lenient().when(repository.getAssetRepository()).thenReturn(assetRepository);
    lenient()
        .when(repository.reads())
        .thenReturn(
            EntityReadFixture.byId(
                (readId, readQuery) -> {
                  assertEquals(null, readQuery.uri());
                  assertEquals(fileId, readId);
                  assertEquals(Include.NON_DELETED, readQuery.includes().getDefaultInclude());
                  assertEquals(false, readQuery.fromCache());
                  return file;
                }));
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

    assertEquals(2, fileUpdates.size());
    assertEquals(2, contentUpdates.size());

    assertEquals(ProcessingStatus.Analyzing, fileUpdates.get(0).getProcessingStatus());
    assertEquals(ProcessingStatus.Processed, fileUpdates.get(1).getProcessingStatus());
    assertEquals("Quarterly results", fileUpdates.get(1).getExtractedText());
    assertEquals(3, fileUpdates.get(1).getPageCount());

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

    assertTrue(fileUpdates.isEmpty());
    assertTrue(contentUpdates.isEmpty());
    verify(assetService, never()).read(any());
  }

  @Test
  void processDoesNotPublishResultWhenDeleteWinsConditionalWriteRace() throws Exception {
    AtomicBoolean deleted = new AtomicBoolean();
    AtomicInteger fileWriteAttempts = new AtomicInteger();
    CountDownLatch finalWriteStarted = new CountDownLatch(1);
    CountDownLatch deleteCommitted = new CountDownLatch(1);

    when(repository.reads())
        .thenReturn(
            EntityReadFixture.byId(
                (readId, readQuery) -> {
                  assertEquals(null, readQuery.uri());
                  assertEquals(fileId, readId);
                  assertEquals(Include.NON_DELETED, readQuery.includes().getDefaultInclude());
                  assertEquals(false, readQuery.fromCache());
                  return deleted.get() ? null : file;
                }));
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));
    fileWrite =
        updated -> {
          if (fileWriteAttempts.incrementAndGet() == 2) {
            finalWriteStarted.countDown();
            try {
              assertTrue(deleteCommitted.await(5, TimeUnit.SECONDS));
            } catch (InterruptedException exception) {
              Thread.currentThread().interrupt();
              throw new IllegalStateException(exception);
            }
            throw new PreconditionFailedException("Context file was deleted");
          }
        };

    CompletableFuture<Void> processing =
        CompletableFuture.runAsync(
            () -> service(Runnable::run, () -> assetService).process(fileId, contentId));

    assertTrue(finalWriteStarted.await(5, TimeUnit.SECONDS));
    deleted.set(true);
    deleteCommitted.countDown();
    processing.get(5, TimeUnit.SECONDS);

    assertEquals(2, fileWriteAttempts.get());
    assertEquals(2, fileUpdates.size());
    assertEquals(
        List.of(ProcessingStatus.Analyzing, ProcessingStatus.Processed),
        fileUpdates.stream().map(ContextFile::getProcessingStatus).toList());
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
    contentWrite =
        updated -> {
          int attempt = contentWriteAttempts.incrementAndGet();
          if (attempt >= 2 && attempt <= 4) {
            throw new PreconditionFailedException("Concurrent content update");
          }
        };

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    assertEquals(5, contentWriteAttempts.get());
    assertEquals(5, contentUpdates.size());
    assertEquals(ProcessingStatus.Processed, contentUpdates.getLast().getProcessingStatus());
    assertEquals(2, fileUpdates.size());
    assertEquals(ProcessingStatus.Processed, fileUpdates.getLast().getProcessingStatus());
  }

  @Test
  void processYieldsAndRequeuesAfterSustainedConflicts() throws Exception {
    AtomicBoolean conflict = new AtomicBoolean(true);
    AtomicInteger fileWriteAttempts = new AtomicInteger();
    AtomicReference<Runnable> requeued = new AtomicReference<>();
    fileWrite =
        updated -> {
          fileWriteAttempts.incrementAndGet();
          if (conflict.get()) {
            throw new PreconditionFailedException("Concurrent file update");
          }
        };
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
    assertEquals(2, contentUpdates.size());
    assertEquals(ProcessingStatus.Processed, contentUpdates.getLast().getProcessingStatus());
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
    assertEquals(2, fileUpdates.size());
    assertEquals(2, contentUpdates.size());

    assertEquals(ProcessingStatus.Analyzing, fileUpdates.get(0).getProcessingStatus());
    assertEquals(ProcessingStatus.Failed, fileUpdates.get(1).getProcessingStatus());
    assertNull(fileUpdates.get(1).getExtractedText());
    assertNull(fileUpdates.get(1).getPageCount());

    assertEquals(ProcessingStatus.Analyzing, contentUpdates.get(0).getProcessingStatus());
    assertEquals(ProcessingStatus.Failed, contentUpdates.get(1).getProcessingStatus());
    assertEquals(expectedReason, contentUpdates.get(1).getProcessingError());
    assertNull(contentUpdates.get(1).getExtractedText());
  }

  private void verifyImmediateFailureWith(String expectedReason) {
    assertEquals(1, fileUpdates.size());
    assertEquals(1, contentUpdates.size());

    ContextFile fileUpdate = fileUpdates.getFirst();
    assertEquals(ProcessingStatus.Failed, fileUpdate.getProcessingStatus());
    assertNull(fileUpdate.getExtractedText());
    assertNull(fileUpdate.getPageCount());

    ContextFileContent contentUpdate = contentUpdates.getFirst();
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

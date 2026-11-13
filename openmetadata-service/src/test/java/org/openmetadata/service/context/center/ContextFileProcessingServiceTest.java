package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.WebApplicationException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
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
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.context.ExtractionAvailability;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.events.consumer.ServerStopping;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.AssetRepository;
import org.openmetadata.service.jdbi3.ContextFileContentRepository;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.llm.LLMCompletionException;
import org.openmetadata.service.llm.NoopCompletionClient;
import org.openmetadata.service.util.RequestEntityCache;

@ExtendWith(MockitoExtension.class)
class ContextFileProcessingServiceTest {

  private static final String UPLOADER = "test.user";
  private static final String CLOSED_ASSET_SERVICE =
      "AssetService not initialized. Please make sure ObjectStorage is configured.";

  @Mock private ContextFileRepository repository;
  @Mock private ContextFileContentRepository contentRepository;
  @Mock private AssetRepository assetRepository;
  @Mock private AssetService assetService;
  @Mock private ContextFileTextExtractor textExtractor;
  @Mock private ContextMemoryExtractor memoryExtractor;
  @Mock private FileContextProcessingEngine fileEngine;
  @Mock private JobDAO jobDao;

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
        .when(repository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(file);
    lenient().when(contentRepository.getById(contentId)).thenReturn(content);
    lenient().when(assetRepository.getById("asset-1")).thenReturn(asset);
  }

  @AfterEach
  void resetGlobalState() {
    AiProviderHolder.reset();
    LLMClientHolder.setForTesting(null);
    ServerStopping.set(false);
  }

  @Test
  void defaultProcessingReadsTheRepositorysAssetStore() {
    file.setFileType(ContextFileType.CSV);
    when(repository.readAsset(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream(
                    "Osprey pallet weight cap,1150 kg per pallet".getBytes())));
    AiProvider provider = mock(AiProvider.class);
    when(provider.extractionAvailability())
        .thenReturn(unavailable(ExtractionAvailability.Reason.ExtractionDisabled));
    AiProviderHolder.setForTesting(provider);

    new ContextFileProcessingService(repository).process(fileId, contentId);

    verify(repository).readAsset(asset);
    verify(repository, times(2))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), eq(UPLOADER));
    assertEquals(ProcessingStatus.Processed, updatedFileCaptor.getValue().getProcessingStatus());
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
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), eq(UPLOADER));
    verify(contentRepository, times(2))
        .updateIfCurrent(isNull(), same(content), updatedContentCaptor.capture(), eq(UPLOADER));

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

  /** A file with no recorded editor is stamped as admin, as the extraction engines do. */
  @Test
  void processStampsAdminWhenTheFileHasNoEditor() throws Exception {
    file.setUpdatedBy(null);
    content.setUpdatedBy(null);
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    verify(repository, times(2))
        .updateIfCurrent(isNull(), same(file), any(), eq(Entity.ADMIN_USER_NAME));
    verify(contentRepository, times(2))
        .updateIfCurrent(isNull(), same(content), any(), eq(Entity.ADMIN_USER_NAME));
  }

  @Test
  void processKeepsMetadataEditedDuringTextExtraction() throws Exception {
    AtomicReference<ContextFile> stored = new AtomicReference<>(file);
    when(repository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenAnswer(
            ignored -> {
              ContextFile cached =
                  RequestEntityCache.getById(
                      Entity.CONTEXT_FILE, fileId, null, null, false, ContextFile.class);
              if (cached == null) {
                cached = JsonUtils.deepCopy(stored.get(), ContextFile.class);
                RequestEntityCache.putById(
                    Entity.CONTEXT_FILE, fileId, null, null, false, cached, ContextFile.class);
              }
              return cached;
            });
    when(repository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              stored.set(invocation.getArgument(2));
              RequestEntityCache.invalidate(Entity.CONTEXT_FILE, fileId, null);
              return null;
            });
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), any(ContextFile.class)))
        .thenAnswer(
            ignored -> {
              stored.set(
                  JsonUtils.deepCopy(stored.get(), ContextFile.class)
                      .withDescription("Current description")
                      .withShareConfig(
                          new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)));
              return ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3);
            });

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    assertEquals("Current description", stored.get().getDescription());
    assertEquals(MemoryVisibility.PRIVATE, stored.get().getShareConfig().getVisibility());
    assertEquals("Quarterly results", stored.get().getExtractedText());
    assertEquals(ProcessingStatus.Processed, stored.get().getProcessingStatus());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void processKeepsContentMetadataEditedDuringTextExtraction(boolean conflictOnResult)
      throws Exception {
    AtomicReference<ContextFileContent> stored = new AtomicReference<>(content);
    AtomicInteger resultWrites = new AtomicInteger();
    when(contentRepository.getById(contentId))
        .thenAnswer(
            ignored -> {
              ContextFileContent cached =
                  RequestEntityCache.getById(
                      Entity.CONTEXT_FILE_CONTENT,
                      contentId,
                      null,
                      null,
                      false,
                      ContextFileContent.class);
              if (cached == null) {
                cached = JsonUtils.deepCopy(stored.get(), ContextFileContent.class);
                RequestEntityCache.putById(
                    Entity.CONTEXT_FILE_CONTENT,
                    contentId,
                    null,
                    null,
                    false,
                    cached,
                    ContextFileContent.class);
              }
              return cached;
            });
    when(contentRepository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              ContextFileContent updated = invocation.getArgument(2);
              if (conflictOnResult
                  && updated.getProcessingStatus() == ProcessingStatus.Processed
                  && resultWrites.getAndIncrement() == 0) {
                stored.set(
                    JsonUtils.deepCopy(stored.get(), ContextFileContent.class)
                        .withDescription("Latest description"));
                throw new PreconditionFailedException("Concurrent content update");
              }
              stored.set(invocation.getArgument(2));
              RequestEntityCache.invalidate(Entity.CONTEXT_FILE_CONTENT, contentId, null);
              return null;
            });
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenAnswer(
            ignored -> {
              stored.set(
                  JsonUtils.deepCopy(stored.get(), ContextFileContent.class)
                      .withDescription("Current description"));
              return ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3);
            });

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    assertEquals(
        conflictOnResult ? "Latest description" : "Current description",
        stored.get().getDescription());
    assertEquals("Quarterly results", stored.get().getExtractedText());
    assertEquals(ProcessingStatus.Processed, stored.get().getProcessingStatus());
  }

  @Test
  void processStopsWhenTheHeadChangesBeforeTheFileUpdate() {
    AtomicReference<ContextFile> stored = new AtomicReference<>(file);
    UUID replacement = UUID.randomUUID();
    AtomicBoolean firstRead = new AtomicBoolean(true);
    when(repository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenAnswer(
            ignored -> {
              ContextFile snapshot = readCachedFile(stored);
              if (firstRead.getAndSet(false)) {
                stored.set(
                    JsonUtils.deepCopy(snapshot, ContextFile.class)
                        .withHeadContentId(replacement.toString()));
              }
              return snapshot;
            });

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    assertEquals(replacement.toString(), stored.get().getHeadContentId());
    assertEquals(ProcessingStatus.Uploaded, stored.get().getProcessingStatus());
    verify(repository, never()).updateIfCurrent(any(), any(), any(), anyString());
    verify(assetService, never()).read(any());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void processStopsWhenTheSourceChangesBeforeTheContentUpdate(boolean contentRemoved)
      throws Exception {
    AtomicReference<ContextFile> storedFile = new AtomicReference<>(file);
    AtomicReference<ContextFileContent> storedContent = new AtomicReference<>(content);
    UUID replacement = UUID.randomUUID();
    when(repository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenAnswer(ignored -> readCachedFile(storedFile));
    when(repository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              ContextFile updated = invocation.getArgument(2);
              RequestEntityCache.invalidate(Entity.CONTEXT_FILE, fileId, null);
              RequestEntityCache.putById(
                  Entity.CONTEXT_FILE, fileId, null, null, false, updated, ContextFile.class);
              if (contentRemoved) {
                storedFile.set(updated);
                storedContent.set(null);
              } else {
                storedFile.set(
                    JsonUtils.deepCopy(updated, ContextFile.class)
                        .withHeadContentId(replacement.toString())
                        .withProcessingStatus(ProcessingStatus.Uploaded));
              }
              return null;
            });
    when(contentRepository.getById(contentId)).thenAnswer(ignored -> storedContent.get());
    lenient()
        .when(contentRepository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              storedContent.set(invocation.getArgument(2));
              return null;
            });
    lenient()
        .when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    lenient()
        .when(textExtractor.extract(any(InputStream.class), any(ContextFile.class)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));

    service(Runnable::run, () -> assetService).process(fileId, contentId);

    assertEquals(
        contentRemoved ? contentId.toString() : replacement.toString(),
        storedFile.get().getHeadContentId());
    assertEquals(
        contentRemoved ? ProcessingStatus.Analyzing : ProcessingStatus.Uploaded,
        storedFile.get().getProcessingStatus());
    if (contentRemoved) {
      assertNull(storedContent.get());
    } else {
      assertEquals(ProcessingStatus.Uploaded, storedContent.get().getProcessingStatus());
    }
    verify(assetService, never()).read(any());
  }

  private ContextFile readCachedFile(AtomicReference<ContextFile> stored) {
    ContextFile cached =
        RequestEntityCache.getById(
            Entity.CONTEXT_FILE, fileId, null, null, false, ContextFile.class);
    if (cached == null) {
      cached = JsonUtils.deepCopy(stored.get(), ContextFile.class);
      RequestEntityCache.putById(
          Entity.CONTEXT_FILE, fileId, null, null, false, cached, ContextFile.class);
    }
    return cached;
  }

  @Test
  void processWithLlmEnabledRunsExtractionThenProcessed() throws Exception {
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));

    ContextFileProcessingService service = service(Runnable::run, () -> assetService, true);
    service.process(fileId, contentId);
    verify(jobDao)
        .enqueueFileMemoryJob(
            eq(fileId.toString()), anyString(), anyString(), anyString(), eq(true));
    service.runMemoryExtraction(fileId, contentId);

    // The shared engine owns derive/reconcile/stat-stamping (covered by its own tests); the
    // service is responsible for driving the status machine around it.
    verify(fileEngine).runExtraction(fileId);
    verify(repository, times(3))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    List<ContextFile> fileUpdates = updatedFileCaptor.getAllValues();
    assertEquals(ProcessingStatus.Analyzing, fileUpdates.get(0).getProcessingStatus());
    assertEquals(ProcessingStatus.ExtractingContext, fileUpdates.get(1).getProcessingStatus());
    assertEquals(ProcessingStatus.Processed, fileUpdates.get(2).getProcessingStatus());
  }

  @Test
  void providerUnavailableSkipsExtraction() throws Exception {
    // The LLM and memory extraction are on, so only the provider's answer can stop the stage.
    LLMClientHolder.setForTesting(new NoopCompletionClient());
    AiProvider provider = mock(AiProvider.class);
    when(provider.extractionAvailability())
        .thenReturn(
            new ExtractionAvailability()
                .withAvailable(false)
                .withReason(ExtractionAvailability.Reason.ProviderUnavailable));
    AiProviderHolder.setForTesting(provider);
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));

    // No gate is injected, so the service's production default decides.
    service(Runnable::run, () -> assetService, null).process(fileId, contentId);

    verify(repository, times(2))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    assertEquals(
        ProcessingStatus.Processed,
        updatedFileCaptor.getAllValues().getLast().getProcessingStatus());
    verify(jobDao, never())
        .enqueueFileMemoryJob(anyString(), anyString(), anyString(), anyString(), anyBoolean());
  }

  @Test
  void aLaterJobUsesTheExtractorThatHasSinceRecovered() {
    AtomicBoolean available = new AtomicBoolean();
    FileContextProcessingEngine unavailable = mock(FileContextProcessingEngine.class);
    when(unavailable.runExtraction(fileId))
        .thenThrow(new IllegalStateException("The AI platform is unavailable"));
    ContextFileProcessingService service =
        new ContextFileProcessingService(
            repository,
            assetService::read,
            Runnable::run,
            textExtractor,
            jobDao,
            () -> memoryExtractor,
            () -> new ExtractionAvailability().withAvailable(true),
            () -> available.get() ? fileEngine : unavailable);

    assertThrows(IllegalStateException.class, () -> service.runMemoryExtraction(fileId, contentId));
    available.set(true);
    service.runMemoryExtraction(fileId, contentId);

    verify(repository, times(2))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    assertEquals(
        ProcessingStatus.Failed, updatedFileCaptor.getAllValues().getFirst().getProcessingStatus());
    assertEquals(
        ProcessingStatus.Processed,
        updatedFileCaptor.getAllValues().getLast().getProcessingStatus());
  }

  @Test
  void memoryJobEnqueueFailureKeepsExtractedText() throws Exception {
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));
    file.setExtractedText("indexed text");
    content.setExtractedText("Quarterly results canonical");
    org.mockito.Mockito.doThrow(new IllegalStateException("queue unavailable"))
        .when(jobDao)
        .enqueueFileMemoryJob(anyString(), anyString(), anyString(), anyString(), eq(true));

    service(Runnable::run, () -> assetService, true).process(fileId, contentId);

    verify(repository, times(3))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    List<ContextFile> fileUpdates = updatedFileCaptor.getAllValues();
    assertEquals(ProcessingStatus.ExtractingContext, fileUpdates.get(1).getProcessingStatus());
    assertEquals(ProcessingStatus.Failed, fileUpdates.get(2).getProcessingStatus());
    assertEquals("indexed text", fileUpdates.get(2).getExtractedText());

    verify(contentRepository, times(3))
        .updateIfCurrent(isNull(), same(content), updatedContentCaptor.capture(), anyString());
    ContextFileContent failedContent = updatedContentCaptor.getAllValues().get(2);
    assertEquals(ProcessingStatus.Failed, failedContent.getProcessingStatus());
    assertEquals("Memory extraction could not be queued.", failedContent.getProcessingError());
    assertEquals("Quarterly results canonical", failedContent.getExtractedText());
  }

  @Test
  void llmFailureRecordsProcessingErrorAndKeepsExtractedText() throws Exception {
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));
    file.setExtractedText("indexed text");
    content.setExtractedText("Quarterly results canonical");
    org.mockito.Mockito.doThrow(new RuntimeException("provider exploded"))
        .when(fileEngine)
        .runExtraction(fileId);

    ContextFileProcessingService service = service(Runnable::run, () -> assetService, true);
    service.process(fileId, contentId);
    assertThrows(RuntimeException.class, () -> service.runMemoryExtraction(fileId, contentId));

    verify(repository, times(3))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    List<ContextFile> fileUpdates = updatedFileCaptor.getAllValues();
    assertEquals(ProcessingStatus.Failed, fileUpdates.get(2).getProcessingStatus());
    assertEquals("provider exploded", fileUpdates.get(2).getProcessingError());
    assertEquals("indexed text", fileUpdates.get(2).getExtractedText());

    verify(contentRepository, times(3))
        .updateIfCurrent(isNull(), same(content), updatedContentCaptor.capture(), anyString());
    ContextFileContent failedContent = updatedContentCaptor.getAllValues().get(2);
    assertEquals(ProcessingStatus.Failed, failedContent.getProcessingStatus());
    assertEquals("provider exploded", failedContent.getProcessingError());
    assertEquals("Quarterly results canonical", failedContent.getExtractedText());
  }

  @Test
  void anInterruptedFileExtractionStaysExtractingContext() throws Exception {
    stubTextExtraction();
    when(fileEngine.runExtraction(fileId))
        .thenAnswer(
            ignored -> {
              throw interruptedLlmCall();
            });
    ContextFileProcessingService service = service(Runnable::run, () -> assetService, true);
    service.process(fileId, contentId);

    try {
      assertThrows(
          LLMCompletionException.class, () -> service.runMemoryExtraction(fileId, contentId));
    } finally {
      Thread.interrupted();
    }

    verify(repository, times(2))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    assertEquals(
        ProcessingStatus.ExtractingContext,
        updatedFileCaptor.getAllValues().getLast().getProcessingStatus());
    verify(contentRepository, times(2))
        .updateIfCurrent(isNull(), same(content), updatedContentCaptor.capture(), anyString());
    assertEquals(
        ProcessingStatus.Processed,
        updatedContentCaptor.getAllValues().getLast().getProcessingStatus());
  }

  @Test
  void aRealLlmFailureStillMarksFailed() throws Exception {
    stubTextExtraction();
    LLMCompletionException failure =
        new LLMCompletionException(
            "Knowledge pill extraction failed for 1 of 1 chunks",
            new LLMCompletionException(
                "OpenAI completion failed due to IO error", new IOException("Connection reset")));
    when(fileEngine.runExtraction(fileId)).thenThrow(failure);
    ContextFileProcessingService service = service(Runnable::run, () -> assetService, true);
    service.process(fileId, contentId);

    assertThrows(
        LLMCompletionException.class, () -> service.runMemoryExtraction(fileId, contentId));

    verify(repository, times(3))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), anyString());
    ContextFile failed = updatedFileCaptor.getAllValues().getLast();
    assertEquals(ProcessingStatus.Failed, failed.getProcessingStatus());
    assertEquals(failure.getMessage(), failed.getProcessingError());
  }

  /** The read ran on another thread, so only the failure's cause records the interrupt. */
  @Test
  void anInterruptedTextStageIsFailedAsInterruptedByAStop() {
    file.setProcessingStatus(ProcessingStatus.Analyzing);
    content.setProcessingStatus(ProcessingStatus.Analyzing);
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.failedFuture(
                new IllegalStateException("Asset read interrupted", new InterruptedException())));

    service(Runnable::run, () -> assetService, true).process(fileId, contentId);

    verifyFailedWith(ContextFileProcessingService.INTERRUPTED_BY_STOP);
    verifyNoMemoryJob();
  }

  @ParameterizedTest
  @EnumSource(
      value = ProcessingStatus.class,
      names = {"Processed", "ExtractingContext"})
  void aStoppedTextRunPreservesAResultAnotherRunFinished(ProcessingStatus peerStatus) {
    AtomicReference<ContextFile> storedFile = new AtomicReference<>(file);
    AtomicReference<ContextFileContent> storedContent = new AtomicReference<>(content);
    when(repository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenAnswer(ignored -> storedFile.get());
    when(contentRepository.getById(contentId)).thenAnswer(ignored -> storedContent.get());
    when(repository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              storedFile.set(invocation.getArgument(2));
              return null;
            });
    when(contentRepository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              storedContent.set(invocation.getArgument(2));
              return null;
            });
    when(assetService.read(asset))
        .thenAnswer(
            ignored -> {
              storedContent.set(
                  JsonUtils.deepCopy(storedContent.get(), ContextFileContent.class)
                      .withProcessingStatus(peerStatus)
                      .withExtractedText("Peer result"));
              storedFile.set(
                  JsonUtils.deepCopy(storedFile.get(), ContextFile.class)
                      .withProcessingStatus(peerStatus)
                      .withExtractedText("Peer result"));
              return CompletableFuture.failedFuture(new InterruptedException("Server is stopping"));
            });

    service(Runnable::run, () -> assetService, true).process(fileId, contentId);

    assertEquals(peerStatus, storedFile.get().getProcessingStatus());
    assertEquals(peerStatus, storedContent.get().getProcessingStatus());
    assertEquals("Peer result", storedFile.get().getExtractedText());
    assertEquals("Peer result", storedContent.get().getExtractedText());
  }

  /** The asset service's own shutdown hook closes object storage under running text extraction. */
  @Test
  void theAssetServiceClosingDuringAServerStopFailsTheFileAsInterrupted() {
    file.setProcessingStatus(ProcessingStatus.Analyzing);
    content.setProcessingStatus(ProcessingStatus.Analyzing);
    ServerStopping.set(true);

    service(Runnable::run, closedAssetService(), true).process(fileId, contentId);

    verifyFailedWith(ContextFileProcessingService.INTERRUPTED_BY_STOP);
    verifyNoMemoryJob();
  }

  @Test
  void theAssetServiceFailingWhileTheServerRunsStillMarksTheFileFailed() {
    service(Runnable::run, closedAssetService()).process(fileId, contentId);

    verifyFailedWith(CLOSED_ASSET_SERVICE);
  }

  /** A failure the run determines itself, rather than one it throws, keeps its own reason. */
  @Test
  void aGenuineTextFailureWhileTheServerStopsKeepsItsOwnMessage() {
    ServerStopping.set(true);
    when(assetService.read(asset)).thenReturn(CompletableFuture.completedFuture(null));

    service(Runnable::run, () -> assetService, true).process(fileId, contentId);

    verifyFailedWith("Unable to read file content from object storage");
  }

  /** What {@code AssetServiceFactory.getService()} throws once its shutdown hook closed it. */
  private static Supplier<AssetService> closedAssetService() {
    return () -> {
      throw new IllegalStateException(CLOSED_ASSET_SERVICE);
    };
  }

  private void verifyNoMemoryJob() {
    verify(jobDao, never())
        .enqueueFileMemoryJob(anyString(), anyString(), anyString(), anyString(), anyBoolean());
  }

  private void stubTextExtraction() throws IOException {
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), same(file)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));
  }

  /** Fails as the LLM clients do when a stop interrupts them: flag re-set, interrupt as cause. */
  private static LLMCompletionException interruptedLlmCall() {
    Thread.currentThread().interrupt();
    return new LLMCompletionException(
        "Knowledge pill extraction failed for 1 of 1 chunks",
        new LLMCompletionException(
            "OpenAI completion was interrupted", new InterruptedException()));
  }

  @Test
  void recoverInterruptedProcessingResubmitsTransientFiles() {
    ContextFile analyzing = transientFile(ProcessingStatus.Analyzing);
    ContextFile extracting = transientFile(ProcessingStatus.ExtractingContext);
    ContextFile uploaded = transientFile(ProcessingStatus.Uploaded);
    ContextFile processed = transientFile(ProcessingStatus.Processed);
    ContextFile invalid =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withHeadContentId("invalid-content-id")
            .withProcessingStatus(ProcessingStatus.Uploaded);
    ContextFile noContent =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withProcessingStatus(ProcessingStatus.Analyzing);
    when(repository.listAll(any(), any()))
        .thenReturn(List.of(invalid, analyzing, extracting, uploaded, processed, noContent));
    List<Runnable> queued = new ArrayList<>();

    int resubmitted = service(queued::add, () -> assetService).recoverInterruptedProcessing();

    assertEquals(3, resubmitted);
    assertEquals(2, queued.size());
    verify(jobDao)
        .enqueueFileMemoryJob(
            eq(extracting.getId().toString()), anyString(), anyString(), anyString(), eq(true));
  }

  @Test
  void memoryStageContentionQueuesRetryDespiteRunningJob() {
    when(repository.updateIfCurrent(isNull(), same(file), any(ContextFile.class), anyString()))
        .thenThrow(new PreconditionFailedException("Concurrent file update"));

    service(Runnable::run, () -> assetService, true).runMemoryExtraction(fileId, contentId);

    verify(jobDao)
        .enqueueFileMemoryJob(
            eq(fileId.toString()), anyString(), anyString(), anyString(), eq(false));
  }

  @Test
  void memoryStatsContentionQueuesRetryDespiteRunningJob() {
    when(fileEngine.runExtraction(fileId))
        .thenThrow(
            new ContextProcessingEngine.ConditionalUpdateExhaustedException(
                Entity.CONTEXT_FILE, fileId));

    service(Runnable::run, () -> assetService, true).runMemoryExtraction(fileId, contentId);

    verify(jobDao)
        .enqueueFileMemoryJob(
            eq(fileId.toString()), anyString(), anyString(), anyString(), eq(false));
    verify(repository, never()).updateIfCurrent(any(), any(), any(), anyString());
  }

  /** A memory-stage failure keeps its text, so a retry re-runs memory extraction on it alone. */
  @Test
  void aFileThatFailedExtractingMemoriesRetriesThatStageOnItsKeptText() {
    failedWith("Knowledge pill extraction did not process every source chunk", "Quarterly");
    List<Runnable> textRuns = new ArrayList<>();

    ContextFile requested =
        service(textRuns::add, () -> assetService, true).requestExtraction(fileId);

    ContextFile stamped = stampedAs(UPLOADER);
    assertEquals(ProcessingStatus.ExtractingContext, stamped.getProcessingStatus());
    assertNull(stamped.getProcessingError());
    assertEquals("indexed text", stamped.getExtractedText());
    assertEquals(ProcessingStatus.ExtractingContext, requested.getProcessingStatus());
    verifyMemoryJobQueuedEvenBesideARunningOne();
    assertTrue(textRuns.isEmpty(), "the kept text is not extracted again");
  }

  /** A text-stage failure cleared the text, so a retry starts over at text extraction. */
  @Test
  void aFileThatFailedExtractingTextRetriesTextExtraction() throws Exception {
    failedWith("Unable to read file content from object storage", null);
    List<Runnable> textRuns = new ArrayList<>();
    when(assetService.read(asset))
        .thenReturn(
            CompletableFuture.completedFuture(
                new ByteArrayInputStream("Quarterly results".getBytes())));
    when(textExtractor.extract(any(InputStream.class), any(ContextFile.class)))
        .thenReturn(ContextFileTextExtractor.ExtractionResult.processed("Quarterly results", 3));

    service(textRuns::add, () -> assetService, true).requestExtraction(fileId);
    assertEquals(1, textRuns.size(), "text extraction is queued, not run on the request");
    textRuns.getFirst().run();

    verify(repository, times(3))
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), eq(UPLOADER));
    ContextFile stamped = updatedFileCaptor.getAllValues().getFirst();
    assertEquals(ProcessingStatus.Uploaded, stamped.getProcessingStatus());
    assertNull(stamped.getProcessingError());
    verify(textExtractor).extract(any(InputStream.class), any(ContextFile.class));
  }

  /** A file processed while extraction was off kept its text, so Extract runs memory extraction. */
  @Test
  void aFileUploadedWhileExtractionWasOffRunsMemoryExtraction() {
    file.withProcessingStatus(ProcessingStatus.Processed).withExtractedText("indexed text");
    content.withProcessingStatus(ProcessingStatus.Processed).withExtractedText("Quarterly");
    when(repository.getContentById(contentId.toString())).thenReturn(content);
    List<Runnable> textRuns = new ArrayList<>();

    service(textRuns::add, () -> assetService, true).requestExtraction(fileId);

    assertEquals(ProcessingStatus.ExtractingContext, stampedAs(UPLOADER).getProcessingStatus());
    verifyMemoryJobQueuedEvenBesideARunningOne();
    assertTrue(textRuns.isEmpty());
  }

  @ParameterizedTest
  @EnumSource(ExtractionAvailability.Reason.class)
  void aRequestWhileExtractionIsUnavailableWritesNothingAndSaysWhy(
      ExtractionAvailability.Reason reason) {
    failedWith("provider exploded", "Quarterly");
    ContextFileProcessingService service =
        service(Runnable::run, () -> assetService, () -> unavailable(reason));

    WebApplicationException refused =
        assertThrows(WebApplicationException.class, () -> service.requestExtraction(fileId));

    assertEquals(409, refused.getResponse().getStatus());
    assertEquals("Memory extraction is unavailable: " + reason.value(), refused.getMessage());
    verifyNothingWritten();
  }

  @ParameterizedTest
  @EnumSource(
      value = ProcessingStatus.class,
      names = {"Uploaded", "Analyzing", "ExtractingContext"})
  void aFileAlreadyQueuedOrBeingExtractedIsRefused(ProcessingStatus status) {
    file.withProcessingStatus(status).withExtractedText("indexed text");

    assertRefused(ExtractionRequests.ALREADY_REQUESTED);
  }

  @ParameterizedTest
  @EnumSource(
      value = ProcessingStatus.class,
      names = {"Processed", "Unsupported"})
  void aFileAlreadyExtractedOrWithNothingToExtractIsRefused(ProcessingStatus status) {
    file.withProcessingStatus(status)
        .withExtractedText("indexed text")
        .withExtractionStats(new ExtractionStats().withSourceHash("checksum"));

    assertRefused(ExtractionRequests.NOT_EXTRACTABLE);
  }

  /** A file created through the metadata API has no status at all, and nothing to extract. */
  @Test
  void aFileWithoutAStatusIsRefused() {
    file.withProcessingStatus(null).withHeadContentId(null);

    assertRefused(ExtractionRequests.NOT_EXTRACTABLE);
  }

  /** A Collate chat attachment can be Failed, yet it has no content snapshot to extract from. */
  @Test
  void aFailedFileWithoutAContentSnapshotIsRefused() {
    file.withProcessingStatus(ProcessingStatus.Failed).withHeadContentId(null);

    assertRefused(ExtractionRequests.NOT_EXTRACTABLE);
  }

  @Test
  void aFileWhoseContentSnapshotIsGoneIsRefused() {
    file.withProcessingStatus(ProcessingStatus.Failed);
    when(repository.getContentById(contentId.toString()))
        .thenThrow(EntityNotFoundException.byId(contentId.toString()));

    assertRefused(ExtractionRequests.NOT_EXTRACTABLE);
  }

  /** Two requests read one Failed file: the stamp lets one through, and the other then sees it. */
  @Test
  void aRequestThatLosesTheStampToAnotherIsRefused() {
    failedWith("provider exploded", "Quarterly");
    ContextFile stampedByTheOther =
        JsonUtils.deepCopy(file, ContextFile.class)
            .withProcessingStatus(ProcessingStatus.ExtractingContext);
    when(repository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(file, stampedByTheOther);
    when(repository.updateIfCurrent(isNull(), same(file), any(ContextFile.class), anyString()))
        .thenThrow(new PreconditionFailedException("Concurrent update"));
    ContextFileProcessingService service = service(Runnable::run, () -> assetService, true);

    WebApplicationException refused =
        assertThrows(WebApplicationException.class, () -> service.requestExtraction(fileId));

    assertEquals(ExtractionRequests.ALREADY_REQUESTED, refused.getMessage());
    verify(jobDao, never())
        .enqueueFileMemoryJob(anyString(), anyString(), anyString(), anyString(), anyBoolean());
  }

  /** A queue that cannot take the memory job leaves the file Failed, its text kept, and 503s. */
  @Test
  void aFileTheQueueCannotTakeIsLeftFailedToRetry() {
    failedWith("provider exploded", "Quarterly");
    memoryQueueRefuses();

    assertQueueRefused(service(Runnable::run, () -> assetService, true), QUEUE_FAILED);

    List<ContextFile> stamps = fileStamps();
    assertEquals(
        List.of(ProcessingStatus.ExtractingContext, ProcessingStatus.Failed),
        stamps.stream().map(ContextFile::getProcessingStatus).toList());
    assertEquals(QUEUE_FAILED, stamps.getLast().getProcessingError());
    assertEquals("indexed text", stamps.getLast().getExtractedText());
  }

  /** A full text-extraction executor leaves the file Failed too, and 503s. */
  @Test
  void aFileTheTextQueueCannotTakeIsLeftFailedToRetry() {
    failedWith("Unable to read file content from object storage", null);
    Executor full =
        task -> {
          throw new RejectedExecutionException("queue full");
        };

    assertQueueRefused(service(full, () -> assetService, true), TEXT_QUEUE_FULL);

    List<ContextFile> stamps = fileStamps();
    assertEquals(
        List.of(ProcessingStatus.Uploaded, ProcessingStatus.Failed),
        stamps.stream().map(ContextFile::getProcessingStatus).toList());
    assertEquals(TEXT_QUEUE_FULL, stamps.getLast().getProcessingError());
  }

  /** Recording the refusal gets more than one write budget: no job is left to record it later. */
  @Test
  void aFileWhoseFailureLosesToContentionIsStillLeftFailed() {
    failedWith("provider exploded", "Quarterly");
    memoryQueueRefuses();
    AtomicInteger writes =
        fileWritesThatLoseRaces(2, ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS + 1);

    assertQueueRefused(service(Runnable::run, () -> assetService, true), QUEUE_FAILED);

    assertEquals(ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS + 2, writes.get());
    ContextFile recorded = fileStamps().getLast();
    assertEquals(ProcessingStatus.Failed, recorded.getProcessingStatus());
    assertEquals(QUEUE_FAILED, recorded.getProcessingError());
  }

  /** A failure no budget can record is still answered 503, never 500. */
  @Test
  void aFileWhoseFailureCannotBeRecordedStillAnswers503() {
    failedWith("provider exploded", "Quarterly");
    memoryQueueRefuses();
    AtomicInteger writes = fileWritesThatLoseRaces(2, Integer.MAX_VALUE);

    assertQueueRefused(service(Runnable::run, () -> assetService, true), QUEUE_FAILED);

    assertEquals(
        1
            + ExtractionRequests.FAILURE_RECORD_ROUNDS
                * ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS,
        writes.get());
  }

  /** Contention that outlasts a text run, then a full executor, still leave the file Failed. */
  @Test
  void aContendedTextRunTheExecutorCannotRequeueIsStillLeftFailed() {
    int budget = ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS;
    AtomicInteger writes = fileWritesThatLoseRaces(1, 2 * budget);
    Executor full =
        task -> {
          throw new RejectedExecutionException("queue full");
        };

    service(full, () -> assetService).process(fileId, contentId);

    assertEquals(2 * budget + 1, writes.get(), "the failure is recorded after one more budget");
    ContextFile recorded = fileStamps().getLast();
    assertEquals(ProcessingStatus.Failed, recorded.getProcessingStatus());
    assertEquals(
        "Concurrent updates prevented text extraction. Please retry later.",
        recorded.getProcessingError());
  }

  private static final String QUEUE_FAILED = ExtractionRequests.QUEUE_FAILED;
  private static final String TEXT_QUEUE_FULL = "Text extraction queue is full.";

  private void memoryQueueRefuses() {
    doThrow(new IllegalStateException("queue unavailable"))
        .when(jobDao)
        .enqueueFileMemoryJob(anyString(), anyString(), anyString(), anyString(), eq(false));
  }

  /** Counts file writes; those numbered {@code first} to {@code last} lose to a concurrent edit. */
  private AtomicInteger fileWritesThatLoseRaces(int first, int last) {
    AtomicInteger writes = new AtomicInteger();
    when(repository.updateIfCurrent(isNull(), same(file), any(ContextFile.class), anyString()))
        .thenAnswer(
            invocation -> {
              int write = writes.incrementAndGet();
              if (write >= first && write <= last) {
                throw new PreconditionFailedException("Concurrent file update");
              }
              return null;
            });
    return writes;
  }

  private List<ContextFile> fileStamps() {
    verify(repository, atLeastOnce())
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), eq(UPLOADER));
    return updatedFileCaptor.getAllValues();
  }

  private void assertQueueRefused(ContextFileProcessingService service, String message) {
    ServiceUnavailableException refused =
        assertThrows(ServiceUnavailableException.class, () -> service.requestExtraction(fileId));

    assertEquals(503, refused.getResponse().getStatus());
    assertEquals(message, refused.getMessage());
  }

  private void failedWith(String error, String snapshotText) {
    file.withProcessingStatus(ProcessingStatus.Failed)
        .withProcessingError(error)
        .withExtractedText(snapshotText == null ? null : "indexed text");
    content
        .withProcessingStatus(ProcessingStatus.Failed)
        .withProcessingError(error)
        .withExtractedText(snapshotText);
    lenient().when(repository.getContentById(contentId.toString())).thenReturn(content);
  }

  private ContextFile stampedAs(String editor) {
    verify(repository)
        .updateIfCurrent(isNull(), same(file), updatedFileCaptor.capture(), eq(editor));
    return updatedFileCaptor.getValue();
  }

  /** The stamp, not the queue, refuses a second request: a RUNNING job may be a failed run ending. */
  private void verifyMemoryJobQueuedEvenBesideARunningOne() {
    verify(jobDao)
        .enqueueFileMemoryJob(
            eq(fileId.toString()),
            eq(ContextMemoryExtractionJobHandler.Args.file(fileId, contentId).jobKey()),
            anyString(),
            eq(Entity.ADMIN_USER_NAME),
            eq(false));
  }

  private void assertRefused(String message) {
    ContextFileProcessingService service = service(Runnable::run, () -> assetService, true);

    WebApplicationException refused =
        assertThrows(WebApplicationException.class, () -> service.requestExtraction(fileId));

    assertEquals(409, refused.getResponse().getStatus());
    assertEquals(message, refused.getMessage());
    verifyNothingWritten();
  }

  private void verifyNothingWritten() {
    verify(repository, never()).updateIfCurrent(any(), any(), any(), anyString());
    verify(jobDao, never())
        .enqueueFileMemoryJob(anyString(), anyString(), anyString(), anyString(), anyBoolean());
  }

  private ContextFile transientFile(ProcessingStatus status) {
    return new ContextFile()
        .withId(UUID.randomUUID())
        .withHeadContentId(UUID.randomUUID().toString())
        .withProcessingStatus(status);
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

    verifyImmediateFailureWith(TEXT_QUEUE_FULL);
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
    assertEquals(expectedReason, fileUpdates.get(1).getProcessingError());
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

  private ContextFileProcessingService service(
      Executor executor, Supplier<AssetService> assetServiceSupplier) {
    return service(executor, assetServiceSupplier, false);
  }

  private ContextFileProcessingService service(
      Executor executor, Supplier<AssetService> assetServiceSupplier, boolean llmEnabled) {
    return service(
        executor,
        assetServiceSupplier,
        () ->
            llmEnabled
                ? available()
                : unavailable(ExtractionAvailability.Reason.ExtractionDisabled));
  }

  private ContextFileProcessingService service(
      Executor executor,
      Supplier<AssetService> assetServiceSupplier,
      Supplier<ExtractionAvailability> availability) {
    return new ContextFileProcessingService(
        repository,
        asset -> {
          AssetService storage = assetServiceSupplier.get();
          return storage == null ? null : storage.read(asset);
        },
        executor,
        textExtractor,
        jobDao,
        () -> memoryExtractor,
        availability,
        () -> fileEngine);
  }

  private static ExtractionAvailability available() {
    return new ExtractionAvailability().withAvailable(true);
  }

  private static ExtractionAvailability unavailable(ExtractionAvailability.Reason reason) {
    return new ExtractionAvailability().withAvailable(false).withReason(reason);
  }
}

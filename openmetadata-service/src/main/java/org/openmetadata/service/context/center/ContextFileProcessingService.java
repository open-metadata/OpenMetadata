package org.openmetadata.service.context.center;

import static org.openmetadata.service.context.center.ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS;
import static org.openmetadata.service.jdbi3.ContextFileContentRepository.CONTEXT_FILE_CONTENT_ENTITY;
import static org.openmetadata.service.jdbi3.ContextFileRepository.CONTEXT_FILE_ENTITY;

import java.io.InputStream;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.context.ExtractionAvailability;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.attachments.AssetServiceFactory;
import org.openmetadata.service.context.center.ContextProcessingEngine.ConditionalUpdateExhaustedException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * Orchestrates asynchronous processing of an uploaded {@link ContextFile}: text extraction
 * (Analyzing) followed by LLM knowledge-pill extraction (ExtractingContext), ending at Processed.
 * Text extraction runs on a bounded pool; the LLM stage uses the shared persistent background job
 * queue with article memory extraction. All entity persistence goes through conditional updates so
 * a concurrent writer never has its change clobbered; exhausted contention requeues the stage.
 */
@Slf4j
public class ContextFileProcessingService {
  private static final long CONDITIONAL_UPDATE_RETRY_DELAY_MILLIS = 10;
  private static final String TEXT_QUEUE_FULL = "Text extraction queue is full.";
  private static final String CONTENDED_TEXT =
      "Concurrent updates prevented text extraction. Please retry later.";
  private final ContextFileRepository repository;
  private final Supplier<AssetService> assetServiceSupplier;
  private final Executor executor;
  private final ContextFileTextExtractor textExtractor;
  private final JobDAO jobDao;
  private final Supplier<DocumentMemoryExtractor> memoryExtractorSupplier;
  private final Supplier<ExtractionAvailability> availabilitySupplier;
  private final Supplier<FileContextProcessingEngine> fileEngineSupplier;
  private volatile FileContextProcessingEngine fileEngine;

  public ContextFileProcessingService(ContextFileRepository repository) {
    this(
        repository,
        AssetServiceFactory::getService,
        DEFAULT_EXECUTOR,
        new ContextFileTextExtractor(),
        Entity.getJobDAO(),
        () -> AiProviderHolder.get().documentExtractor(),
        null,
        null);
  }

  ContextFileProcessingService(
      ContextFileRepository repository,
      Supplier<AssetService> assetServiceSupplier,
      Executor executor,
      ContextFileTextExtractor textExtractor,
      JobDAO jobDao,
      Supplier<DocumentMemoryExtractor> memoryExtractorSupplier,
      Supplier<ExtractionAvailability> availabilitySupplier,
      Supplier<FileContextProcessingEngine> fileEngineSupplier) {
    this.repository = repository;
    this.assetServiceSupplier = assetServiceSupplier;
    this.executor = executor;
    this.textExtractor = textExtractor;
    this.jobDao = jobDao;
    this.memoryExtractorSupplier = memoryExtractorSupplier;
    this.availabilitySupplier =
        availabilitySupplier != null
            ? availabilitySupplier
            : () -> AiProviderHolder.get().extractionAvailability();
    this.fileEngineSupplier = fileEngineSupplier;
  }

  /**
   * Shared text-extraction pool. Kept separate from {@code
   * AsyncService.getExecutorService()} because {@link #process(UUID, UUID)} blocks on {@code
   * AssetService.read(...).join()} for S3/Azure reads, which are themselves scheduled on
   * AsyncService — sharing the pool would starve those read tasks (and potentially deadlock) once
   * every thread is busy running extractions.
   *
   * <p>Held {@code static final} so every production instance reuses one pool — tests that
   * instantiate the service repeatedly no longer leak a new pool each construction. Threads are
   * daemons, so the pools never block JVM shutdown.
   */
  private static final Executor DEFAULT_EXECUTOR =
      createBoundedExecutor("context-file-extraction-");

  // An EnumSet: a file created without a status must read as not transient, not throw.
  private static final Set<ProcessingStatus> TRANSIENT_STATUSES =
      Collections.unmodifiableSet(
          EnumSet.of(
              ProcessingStatus.Uploaded,
              ProcessingStatus.Analyzing,
              ProcessingStatus.ExtractingContext));

  private static Executor createBoundedExecutor(String threadPrefix) {
    int threads = Math.max(2, Runtime.getRuntime().availableProcessors() / 2);
    ThreadFactory threadFactory =
        new ThreadFactory() {
          private final AtomicInteger counter = new AtomicInteger();

          @Override
          public Thread newThread(Runnable r) {
            Thread t = new Thread(r, threadPrefix + counter.incrementAndGet());
            t.setDaemon(true);
            return t;
          }
        };
    // Bounded queue + AbortPolicy so an overloaded server rejects new work rather than
    // accumulating an unbounded backlog on the heap. The RejectedExecutionException handling in
    // submit(...) turns the rejection into a Failed processing status, so callers see a clear
    // "retry later" signal instead of silent buildup.
    int queueCapacity = Math.max(64, threads * 8);
    return new ThreadPoolExecutor(
        threads,
        threads,
        0L,
        TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(queueCapacity),
        threadFactory,
        new ThreadPoolExecutor.AbortPolicy());
  }

  public void submit(UUID fileId, UUID contentId) {
    if (!queueText(fileId, contentId)) {
      ExtractionRequests.recordFailure(
          CONTEXT_FILE_ENTITY, fileId, () -> applyFailure(fileId, contentId, TEXT_QUEUE_FULL));
    }
  }

  /** Whether the text-extraction executor took the file: a full one rejects it. */
  private boolean queueText(UUID fileId, UUID contentId) {
    boolean queued = true;
    try {
      executor.execute(() -> process(fileId, contentId));
    } catch (RejectedExecutionException e) {
      LOG.warn(
          "Skipping text extraction for file {} because the async executor rejected it", fileId, e);
      queued = false;
    }
    return queued;
  }

  /**
   * Starts or retries a failed or never-extracted file's extraction at the stage its snapshot lacks:
   * text extraction when it has no text, memory extraction otherwise. The status it stamps refuses
   * a second request until the run settles.
   */
  public ContextFile requestExtraction(UUID fileId) {
    ExtractionRequests.requireAvailable(availabilitySupplier.get());
    ContextFile requested = stampRequested(fileId);
    UUID contentId = UUID.fromString(requested.getHeadContentId());
    if (requested.getProcessingStatus() == ProcessingStatus.Uploaded) {
      requireQueuedText(fileId, contentId);
    } else {
      requireQueuedMemories(fileId, contentId);
    }
    return requested;
  }

  private void requireQueuedText(UUID fileId, UUID contentId) {
    if (!queueText(fileId, contentId)) {
      throw ExtractionRequests.queueRefused(
          CONTEXT_FILE_ENTITY,
          fileId,
          TEXT_QUEUE_FULL,
          () -> applyFailure(fileId, contentId, TEXT_QUEUE_FULL));
    }
  }

  /** The stamp refuses duplicates; a RUNNING job may be the failed run still finishing. */
  private void requireQueuedMemories(UUID fileId, UUID contentId) {
    if (!queueMemoryJob(fileId, contentId, false)) {
      throw ExtractionRequests.queueRefused(
          CONTEXT_FILE_ENTITY,
          fileId,
          ExtractionRequests.QUEUE_FAILED,
          () -> applyFailure(fileId, contentId, ExtractionRequests.QUEUE_FAILED, false));
    }
  }

  private ContextFile stampRequested(UUID fileId) {
    ContextFile requested;
    try {
      requested = writeFile(fileId, this::requestedStage);
    } catch (ConditionalUpdateExhaustedException e) {
      throw ExtractionRequests.changedWhileRequested();
    }
    if (requested == null) {
      throw ExtractionRequests.changedWhileRequested();
    }
    return requested;
  }

  private ContextFile requestedStage(ContextFile current) {
    ContextFileContent snapshot = requireRequestableSnapshot(current);
    ContextFile requested = JsonUtils.deepCopy(current, ContextFile.class);
    requested.setProcessingStatus(
        MemoryExtractionState.hasText(snapshot.getExtractedText())
            ? ProcessingStatus.ExtractingContext
            : ProcessingStatus.Uploaded);
    requested.setProcessingError(null);
    return requested;
  }

  private ContextFileContent requireRequestableSnapshot(ContextFile file) {
    if (TRANSIENT_STATUSES.contains(file.getProcessingStatus())) {
      throw ExtractionRequests.alreadyRequested();
    }
    ContextFileContent snapshot = isRequestable(file) ? headSnapshot(file) : null;
    if (snapshot == null) {
      throw ExtractionRequests.notExtractable();
    }
    return snapshot;
  }

  private static boolean isRequestable(ContextFile file) {
    return file.getProcessingStatus() == ProcessingStatus.Failed
        || MemoryExtractionState.neverExtracted(file);
  }

  /** The current content snapshot, or null for a file without one, such as a chat attachment. */
  private ContextFileContent headSnapshot(ContextFile file) {
    ContextFileContent snapshot = null;
    try {
      snapshot = repository.getContentById(file.getHeadContentId());
    } catch (EntityNotFoundException e) {
      LOG.debug("Context file {} lost its content snapshot", file.getId(), e);
    }
    return snapshot;
  }

  /**
   * Requeues files a previous server shutdown left in a transient processing state. Without this, a
   * file interrupted mid-pipeline stays Uploaded/Analyzing/ExtractingContext forever, since
   * processing only ever starts at upload time.
   */
  public int recoverInterruptedProcessing() {
    int resubmitted = 0;
    try {
      List<ContextFile> files =
          repository.listAll(repository.getFields(""), new ListFilter(Include.NON_DELETED));
      for (ContextFile file : files) {
        if (isInterrupted(file)) {
          try {
            UUID contentId = UUID.fromString(file.getHeadContentId());
            if (file.getProcessingStatus() == ProcessingStatus.ExtractingContext) {
              submitMemoryExtraction(file.getId(), contentId);
            } else {
              submit(file.getId(), contentId);
            }
            resubmitted++;
          } catch (RuntimeException e) {
            LOG.error("Failed to recover interrupted context file {}", file.getId(), e);
          }
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to recover interrupted context file processing", e);
    }
    if (resubmitted > 0) {
      LOG.info("Resubmitted {} context files interrupted by a previous shutdown", resubmitted);
    }
    return resubmitted;
  }

  private boolean isInterrupted(ContextFile file) {
    return file.getHeadContentId() != null
        && TRANSIENT_STATUSES.contains(file.getProcessingStatus());
  }

  void process(UUID fileId, UUID contentId) {
    RequestEntityCache.clear();
    try {
      processInternal(fileId, contentId);
    } catch (ConditionalUpdateExhaustedException e) {
      requeueAfterConditionalUpdateContention(fileId, contentId);
    } finally {
      RequestEntityCache.clear();
    }
  }

  private void requeueAfterConditionalUpdateContention(UUID fileId, UUID contentId) {
    try {
      executor.execute(() -> process(fileId, contentId));
      LOG.debug("Requeued text extraction for file {} after concurrent updates", fileId);
    } catch (RejectedExecutionException e) {
      LOG.warn("Unable to requeue text extraction for file {} after concurrent updates", fileId, e);
      ExtractionRequests.recordFailure(
          CONTEXT_FILE_ENTITY, fileId, () -> applyFailure(fileId, contentId, CONTENDED_TEXT));
    }
  }

  private void processInternal(UUID fileId, UUID contentId) {
    ContextFile file = getFile(fileId);
    if (file == null || !contentId.toString().equals(file.getHeadContentId())) {
      return;
    }
    if (!markAnalyzing(fileId, contentId)) {
      return;
    }
    ProcessingStatus textStatus = extractText(fileId, contentId);
    if (shouldExtractContext(textStatus)) {
      submitMemoryExtraction(fileId, contentId);
    }
  }

  private boolean markAnalyzing(UUID fileId, UUID contentId) {
    if (!updateFile(
        fileId,
        current -> {
          if (!contentId.toString().equals(current.getHeadContentId())) {
            return null;
          }
          ContextFile updated = JsonUtils.deepCopy(current, ContextFile.class);
          updated.setProcessingStatus(ProcessingStatus.Analyzing);
          updated.setProcessingError(null);
          return updated;
        })) {
      return false;
    }
    return updateContent(
        contentId,
        current -> {
          // Re-read the file inside the content updater so we don't mark an older content
          // "Analyzing" when headContentId changed concurrently. Without this guard, a no-op
          // updateFile above would still be followed by a status update on the now-stale content,
          // leaving it stuck once the later head-check early-returns.
          ContextFile currentHead = getFile(fileId);
          if (currentHead == null || !contentId.toString().equals(currentHead.getHeadContentId())) {
            return null;
          }
          ContextFileContent updated = JsonUtils.deepCopy(current, ContextFileContent.class);
          updated.setProcessingStatus(ProcessingStatus.Analyzing);
          updated.setProcessingError(null);
          return updated;
        });
  }

  /**
   * Runs the text-extraction stage and returns the resulting text status, or {@code null} when the
   * run was abandoned (stale content, missing entities, or a conditional update that lost to a
   * concurrent writer).
   */
  private ProcessingStatus extractText(UUID fileId, UUID contentId) {
    try {
      ContextFile currentFile = getFile(fileId);
      ContextFileContent currentContent = getContent(contentId);
      if (currentFile == null
          || currentContent == null
          || !contentId.toString().equals(currentFile.getHeadContentId())) {
        return null;
      }

      AssetService assetService = assetServiceSupplier.get();
      if (assetService == null) {
        applyFailure(fileId, contentId, "Object storage is not configured for text extraction");
        return ProcessingStatus.Failed;
      }

      Asset asset = repository.getAssetRepository().getById(currentContent.getAssetId());
      try (InputStream inputStream = assetService.read(asset).join()) {
        if (inputStream == null) {
          applyFailure(fileId, contentId, "Unable to read file content from object storage");
          return ProcessingStatus.Failed;
        }
        ContextFileTextExtractor.ExtractionResult result =
            textExtractor.extract(inputStream, currentFile);
        return applyTextResult(fileId, contentId, result) ? result.processingStatus() : null;
      }
    } catch (Throwable t) {
      if (t instanceof ConditionalUpdateExhaustedException exhausted) {
        throw exhausted;
      }
      if (t instanceof VirtualMachineError vmError) {
        throw vmError;
      }
      LOG.error("Failed to extract text for file {} content {}", fileId, contentId, t);
      applyFailure(fileId, contentId, describeFailure(t));
      return ProcessingStatus.Failed;
    }
  }

  private void submitMemoryExtraction(UUID fileId, UUID contentId) {
    submitMemoryExtraction(fileId, contentId, false);
  }

  private void submitMemoryExtraction(UUID fileId, UUID contentId, boolean retry) {
    if (!queueMemoryJob(fileId, contentId, !retry)) {
      ExtractionRequests.recordFailure(
          CONTEXT_FILE_ENTITY,
          fileId,
          () -> applyFailure(fileId, contentId, ExtractionRequests.QUEUE_FAILED, false));
    }
  }

  /** Whether the persistent queue took the file's memory job, or already holds one for it. */
  private boolean queueMemoryJob(UUID fileId, UUID contentId, boolean includeRunning) {
    boolean queued = true;
    try {
      ContextMemoryExtractionJobHandler.Args args =
          ContextMemoryExtractionJobHandler.Args.file(fileId, contentId);
      jobDao.enqueueFileMemoryJob(
          fileId.toString(),
          args.jobKey(),
          JsonUtils.pojoToJson(args),
          Entity.ADMIN_USER_NAME,
          includeRunning);
    } catch (RuntimeException e) {
      LOG.error("Unable to queue knowledge pill extraction for file {}", fileId, e);
      queued = false;
    }
    return queued;
  }

  void runMemoryExtraction(UUID fileId, UUID contentId) {
    RequestEntityCache.clear();
    try {
      runMemoryExtractionInternal(fileId, contentId);
    } catch (ConditionalUpdateExhaustedException e) {
      submitMemoryExtraction(fileId, contentId, true);
    } finally {
      RequestEntityCache.clear();
    }
  }

  private void runMemoryExtractionInternal(UUID fileId, UUID contentId) {
    ContextFile file = getFile(fileId);
    if (file == null || !contentId.toString().equals(file.getHeadContentId())) {
      return;
    }
    try {
      // The shared engine skips the LLM when the content hash is unchanged, derives pills
      // otherwise, and reconciles them against the file's existing pills (preserving identity and
      // retrieval telemetry) rather than a wholesale delete-and-recreate.
      fileEngine().runExtraction(fileId);
      markProcessed(fileId, contentId);
    } catch (ConditionalUpdateExhaustedException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Knowledge pill extraction failed for file {}", fileId, e);
      applyFailure(fileId, contentId, describeFailure(e), false);
      if (e instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw new IllegalStateException(e);
    }
  }

  private FileContextProcessingEngine fileEngine() {
    FileContextProcessingEngine engine = fileEngine;
    if (engine == null) {
      engine = buildFileEngine();
    }
    return engine;
  }

  private synchronized FileContextProcessingEngine buildFileEngine() {
    if (fileEngine == null) {
      fileEngine = fileEngineSupplier != null ? fileEngineSupplier.get() : defaultFileEngine();
    }
    return fileEngine;
  }

  private FileContextProcessingEngine defaultFileEngine() {
    ContextMemoryRepository memoryRepository =
        (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
    Supplier<VectorIndexService> vectors =
        () -> Entity.getSearchRepository().getVectorIndexService();
    SemanticMemoryDuplicateFinder duplicateFinder =
        AiProviderHolder.get()
            .duplicateJudge()
            .map(judge -> new SemanticMemoryDuplicateFinder(memoryRepository, vectors, judge))
            .orElseGet(() -> SemanticMemoryDuplicateFinder.exactOnly(memoryRepository, vectors));
    return new FileContextProcessingEngine(
        repository,
        memoryExtractorSupplier.get(),
        new ContextMemoryReconciler(memoryRepository, duplicateFinder));
  }

  private void markProcessed(UUID fileId, UUID contentId) {
    updateFile(
        fileId,
        current -> {
          if (!contentId.toString().equals(current.getHeadContentId())) {
            return null;
          }
          ContextFile updated = JsonUtils.deepCopy(current, ContextFile.class);
          updated.setProcessingStatus(ProcessingStatus.Processed);
          updated.setProcessingError(null);
          return updated;
        });
  }

  private String describeFailure(Throwable t) {
    return t.getMessage() == null || t.getMessage().isBlank() ? t.toString() : t.getMessage();
  }

  private boolean applyTextResult(
      UUID fileId, UUID contentId, ContextFileTextExtractor.ExtractionResult result) {
    if (!updateContent(
        contentId,
        current -> {
          ContextFileContent updated = JsonUtils.deepCopy(current, ContextFileContent.class);
          updated.setProcessingStatus(result.processingStatus());
          updated.setProcessingError(result.processingError());
          updated.setExtractedText(result.extractedText());
          return updated;
        })) {
      return false;
    }

    ProcessingStatus fileStatus = fileStatusAfterText(result.processingStatus());
    return updateFile(
        fileId,
        current -> {
          if (!contentId.toString().equals(current.getHeadContentId())) {
            return null;
          }
          ContextFile updated = JsonUtils.deepCopy(current, ContextFile.class);
          updated.setProcessingStatus(fileStatus);
          updated.setProcessingError(result.processingError());
          updated.setExtractedText(result.indexedText());
          updated.setPageCount(result.pageCount());
          return updated;
        });
  }

  private ProcessingStatus fileStatusAfterText(ProcessingStatus textStatus) {
    ProcessingStatus result = textStatus;
    if (shouldExtractContext(textStatus)) {
      result = ProcessingStatus.ExtractingContext;
    }
    return result;
  }

  /**
   * Whether text extraction should be followed by LLM knowledge-pill extraction. The gate is a
   * single injected supplier, the active provider's availability when none is given, so the status
   * machine stays unit testable without a live configuration.
   */
  private boolean shouldExtractContext(ProcessingStatus textStatus) {
    return textStatus == ProcessingStatus.Processed
        && AiProviderHolder.isAvailable(availabilitySupplier.get());
  }

  private void applyFailure(UUID fileId, UUID contentId, String reason) {
    applyFailure(fileId, contentId, reason, true);
  }

  /**
   * Marks the content and file Failed with {@code reason}. {@code clearExtractedText} is false for
   * failures that happen after a successful text extraction (the knowledge-pill stage), so the
   * already-extracted text survives for indexing and retries.
   */
  private void applyFailure(
      UUID fileId, UUID contentId, String reason, boolean clearExtractedText) {
    if (!updateContent(
        contentId,
        current -> {
          ContextFileContent updated = JsonUtils.deepCopy(current, ContextFileContent.class);
          updated.setProcessingStatus(ProcessingStatus.Failed);
          updated.setProcessingError(reason);
          if (clearExtractedText) {
            updated.setExtractedText(null);
          }
          return updated;
        })) {
      return;
    }

    updateFile(
        fileId,
        current -> {
          if (!contentId.toString().equals(current.getHeadContentId())) {
            return null;
          }
          ContextFile updated = JsonUtils.deepCopy(current, ContextFile.class);
          updated.setProcessingStatus(ProcessingStatus.Failed);
          updated.setProcessingError(reason);
          if (clearExtractedText) {
            updated.setExtractedText(null);
            updated.setPageCount(null);
          }
          return updated;
        });
  }

  private ContextFile getFile(UUID fileId) {
    try {
      return repository.get(null, fileId, repository.getFields(""), Include.NON_DELETED, false);
    } catch (Exception e) {
      return null;
    }
  }

  private ContextFileContent getContent(UUID contentId) {
    try {
      return repository.getContentRepository().getById(contentId);
    } catch (Exception e) {
      return null;
    }
  }

  private boolean updateFile(UUID fileId, Function<ContextFile, ContextFile> updater) {
    return writeFile(fileId, updater) != null;
  }

  /** The file as {@code updater} rewrote it, or null when the file is gone or nothing was written. */
  private ContextFile writeFile(UUID fileId, Function<ContextFile, ContextFile> updater) {
    for (int attempt = 1; attempt <= MAX_CONDITIONAL_UPDATE_ATTEMPTS; attempt++) {
      try (var ignored = FreshReadScope.enter()) {
        ContextFile current = getFile(fileId);
        if (current == null) {
          return null;
        }
        ContextFile updated = updater.apply(current);
        if (updated == null) {
          return null;
        }
        repository.updateIfCurrent(
            null, current, updated, ContextProcessingEngine.lastEditorOf(current));
        return updated;
      } catch (PreconditionFailedException e) {
        LOG.debug("Context file {} changed during extraction update", fileId);
        RequestEntityCache.invalidate(CONTEXT_FILE_ENTITY, fileId, null);
        if (attempt < MAX_CONDITIONAL_UPDATE_ATTEMPTS
            && !waitForConditionalUpdateRetry(CONTEXT_FILE_ENTITY, fileId)) {
          return null;
        }
      }
    }
    throw new ConditionalUpdateExhaustedException(CONTEXT_FILE_ENTITY, fileId);
  }

  private boolean updateContent(
      UUID contentId, Function<ContextFileContent, ContextFileContent> updater) {
    for (int attempt = 1; attempt <= MAX_CONDITIONAL_UPDATE_ATTEMPTS; attempt++) {
      try (var ignored = FreshReadScope.enter()) {
        ContextFileContent current = getContent(contentId);
        if (current == null) {
          return false;
        }
        ContextFileContent updated = updater.apply(current);
        if (updated == null) {
          return false;
        }
        repository
            .getContentRepository()
            .updateIfCurrent(null, current, updated, ContextProcessingEngine.lastEditorOf(current));
        return true;
      } catch (PreconditionFailedException e) {
        LOG.debug("Context file content {} changed during extraction update", contentId);
        RequestEntityCache.invalidate(CONTEXT_FILE_CONTENT_ENTITY, contentId, null);
        if (attempt < MAX_CONDITIONAL_UPDATE_ATTEMPTS
            && !waitForConditionalUpdateRetry(CONTEXT_FILE_CONTENT_ENTITY, contentId)) {
          return false;
        }
      }
    }
    throw new ConditionalUpdateExhaustedException(CONTEXT_FILE_CONTENT_ENTITY, contentId);
  }

  private boolean waitForConditionalUpdateRetry(String entityType, UUID entityId) {
    try {
      TimeUnit.MILLISECONDS.sleep(CONDITIONAL_UPDATE_RETRY_DELAY_MILLIS);
      return true;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while retrying {} {} extraction update", entityType, entityId);
      return false;
    }
  }
}

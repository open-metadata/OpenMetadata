package org.openmetadata.service.drive;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.io.InputStream;
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
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.attachments.AssetServiceFactory;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.util.AISettingsUtil;

/**
 * Orchestrates asynchronous processing of an uploaded {@link ContextFile}: text extraction
 * (Analyzing) followed by LLM knowledge-pill extraction (ExtractingContext), ending at Processed.
 * The two stages run on separate pools — text extraction is CPU-bound, the LLM step is
 * network-bound and seconds-long, so mixing them would starve the text pool.
 */
@Slf4j
public class ContextFileProcessingService {
  private final ContextFileRepository repository;
  private final Supplier<AssetService> assetServiceSupplier;
  private final Executor executor;
  private final ContextFileTextExtractor textExtractor;
  private final Executor llmExecutor;
  private final Supplier<ContextMemoryExtractor> memoryExtractorSupplier;
  private final Supplier<Boolean> llmEnabledSupplier;
  private final Supplier<FileContextProcessingEngine> fileEngineSupplier;
  private volatile FileContextProcessingEngine fileEngine;

  public ContextFileProcessingService(ContextFileRepository repository) {
    this(
        repository,
        AssetServiceFactory::getService,
        DEFAULT_EXECUTOR,
        new ContextFileTextExtractor(),
        LLM_EXECUTOR,
        ContextFileProcessingService::buildDefaultExtractor,
        () ->
            LLMClientHolder.isEnabled()
                && AISettingsUtil.isFileExtractionEnabled(AISettingsUtil.get()),
        null);
  }

  ContextFileProcessingService(
      ContextFileRepository repository,
      Supplier<AssetService> assetServiceSupplier,
      Executor executor,
      ContextFileTextExtractor textExtractor,
      Executor llmExecutor,
      Supplier<ContextMemoryExtractor> memoryExtractorSupplier,
      Supplier<Boolean> llmEnabledSupplier,
      Supplier<FileContextProcessingEngine> fileEngineSupplier) {
    this.repository = repository;
    this.assetServiceSupplier = assetServiceSupplier;
    this.executor = executor;
    this.textExtractor = textExtractor;
    this.llmExecutor = llmExecutor;
    this.memoryExtractorSupplier = memoryExtractorSupplier;
    this.llmEnabledSupplier = llmEnabledSupplier;
    this.fileEngineSupplier = fileEngineSupplier;
  }

  /**
   * CPU-bound text-extraction pool (see the class comment for why it is kept off AsyncService).
   * Bounded queue + AbortPolicy so an overloaded server rejects new work instead of accumulating an
   * unbounded backlog; the rejection is turned into a Failed status by {@link #submit}.
   */
  private static final Executor DEFAULT_EXECUTOR =
      createBoundedExecutor("context-file-extraction-");

  /** Separate network-bound pool for LLM completion so slow calls never starve text extraction. */
  private static final Executor LLM_EXECUTOR = createBoundedExecutor("context-memory-extraction-");

  private static final Set<ProcessingStatus> TRANSIENT_STATUSES =
      Set.of(
          ProcessingStatus.Uploaded,
          ProcessingStatus.Analyzing,
          ProcessingStatus.ExtractingContext);

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

  private static ContextMemoryExtractor buildDefaultExtractor() {
    return new ContextMemoryExtractor(LLMClientHolder.get());
  }

  public void submit(UUID fileId, UUID contentId) {
    try {
      executor.execute(() -> process(fileId, contentId));
    } catch (RejectedExecutionException e) {
      LOG.warn("Skipping processing for file {} because the async executor rejected it", fileId, e);
      applyFailure(fileId, contentId, "Processing queue is full. Please retry later.");
    }
  }

  /**
   * Requeues files a previous server shutdown left in a transient processing state. Without this,
   * a file interrupted mid-pipeline stays Uploaded/Analyzing/ExtractingContext forever, since
   * processing only ever starts at upload time.
   */
  public int recoverInterruptedProcessing() {
    int resubmitted = 0;
    try {
      List<ContextFile> files =
          repository.listAll(repository.getFields(""), new ListFilter(Include.NON_DELETED));
      for (ContextFile file : files) {
        if (isInterrupted(file)) {
          submit(file.getId(), UUID.fromString(file.getHeadContentId()));
          resubmitted++;
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
    ContextFile file = getFile(fileId);
    if (file != null && contentId.toString().equals(file.getHeadContentId())) {
      markAnalyzing(fileId, contentId);
      ProcessingStatus textStatus = extractText(fileId, contentId);
      if (shouldExtractContext(textStatus)) {
        submitMemoryExtraction(fileId, contentId);
      }
    }
  }

  private void submitMemoryExtraction(UUID fileId, UUID contentId) {
    try {
      llmExecutor.execute(() -> runMemoryExtraction(fileId, contentId));
    } catch (RejectedExecutionException e) {
      LOG.warn(
          "Skipping knowledge pill extraction for file {} because the LLM executor rejected it",
          fileId,
          e);
      applyFailure(
          fileId, contentId, "Knowledge pill extraction queue is full. Please retry later.", false);
    }
  }

  private void markAnalyzing(UUID fileId, UUID contentId) {
    updateFile(
        fileId,
        current -> {
          if (!contentId.toString().equals(current.getHeadContentId())) {
            return null;
          }
          ContextFile updated = JsonUtils.deepCopy(current, ContextFile.class);
          updated.setProcessingStatus(ProcessingStatus.Analyzing);
          updated.setProcessingError(null);
          return updated;
        });
    updateContent(
        contentId,
        current -> {
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
        applyTextResult(fileId, contentId, result);
        return result.processingStatus();
      }
    } catch (Throwable t) {
      if (t instanceof VirtualMachineError vmError) {
        throw vmError;
      }
      LOG.error("Failed to extract text for file {} content {}", fileId, contentId, t);
      applyFailure(fileId, contentId, describeFailure(t));
      return ProcessingStatus.Failed;
    }
  }

  private void runMemoryExtraction(UUID fileId, UUID contentId) {
    ContextFile file = getFile(fileId);
    if (file == null || !contentId.toString().equals(file.getHeadContentId())) {
      return;
    }
    try {
      // The shared engine skips the LLM when the content hash is unchanged, derives pills
      // otherwise, and reconciles them against the file's existing pills (preserving identity and
      // retrieval telemetry) rather than the previous wholesale delete-and-recreate.
      fileEngine().runExtraction(fileId);
      markProcessed(fileId, contentId);
    } catch (Exception e) {
      LOG.error("Knowledge pill extraction failed for file {}", fileId, e);
      applyFailure(fileId, contentId, describeFailure(e), false);
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
    return new FileContextProcessingEngine(
        repository, memoryExtractorSupplier.get(), new ContextMemoryReconciler(memoryRepository));
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

  private void applyTextResult(
      UUID fileId, UUID contentId, ContextFileTextExtractor.ExtractionResult result) {
    updateContent(
        contentId,
        current -> {
          ContextFileContent updated = JsonUtils.deepCopy(current, ContextFileContent.class);
          updated.setProcessingStatus(result.processingStatus());
          updated.setProcessingError(result.processingError());
          updated.setExtractedText(result.extractedText());
          return updated;
        });

    ProcessingStatus fileStatus = fileStatusAfterText(result.processingStatus());
    updateFile(
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
   * Whether text extraction should be followed by LLM knowledge-pill extraction. The {@code
   * llmEnabledSupplier} carries the full gate (LLM availability AND the AISettings file-extraction
   * toggle in production); keeping it a single injected supplier makes the status machine unit
   * testable without a live settings cache.
   */
  private boolean shouldExtractContext(ProcessingStatus textStatus) {
    return textStatus == ProcessingStatus.Processed
        && Boolean.TRUE.equals(llmEnabledSupplier.get());
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
    LOG.error("Processing failed for file {} content {}: {}", fileId, contentId, reason);
    updateContent(
        contentId,
        current -> {
          ContextFileContent updated = JsonUtils.deepCopy(current, ContextFileContent.class);
          updated.setProcessingStatus(ProcessingStatus.Failed);
          updated.setProcessingError(reason);
          if (clearExtractedText) {
            updated.setExtractedText(null);
          }
          return updated;
        });

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

  private void updateFile(
      UUID fileId, java.util.function.Function<ContextFile, ContextFile> updater) {
    ContextFile current = getFile(fileId);
    if (current == null) {
      return;
    }
    ContextFile updated = updater.apply(current);
    if (updated == null) {
      return;
    }
    repository.update(null, current, updated, ADMIN_USER_NAME);
  }

  private void updateContent(
      UUID contentId, java.util.function.Function<ContextFileContent, ContextFileContent> updater) {
    ContextFileContent current = getContent(contentId);
    if (current == null) {
      return;
    }
    ContextFileContent updated = updater.apply(current);
    if (updated == null) {
      return;
    }
    repository.getContentRepository().update(null, current, updated, ADMIN_USER_NAME);
  }
}

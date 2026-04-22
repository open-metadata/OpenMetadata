package org.openmetadata.service.drive;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.io.InputStream;
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
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.attachments.AssetServiceFactory;
import org.openmetadata.service.jdbi3.ContextFileRepository;

@Slf4j
public class ContextFileExtractionService {
  private final ContextFileRepository repository;
  private final Supplier<AssetService> assetServiceSupplier;
  private final Executor executor;
  private final ContextFileTextExtractor textExtractor;

  public ContextFileExtractionService(ContextFileRepository repository) {
    this(
        repository,
        AssetServiceFactory::getService,
        DEFAULT_EXECUTOR,
        new ContextFileTextExtractor());
  }

  /**
   * Single shared thread pool for text extraction. Kept separate from
   * {@code AsyncService.getExecutorService()} because {@link #process(UUID, UUID)}
   * blocks on {@code AssetService.read(...).join()} for S3/Azure reads, which are
   * themselves scheduled on AsyncService — sharing the pool would starve those read
   * tasks (and potentially deadlock) once every thread is busy running extractions.
   *
   * <p>Held {@code static final} so every production {@link ContextFileExtractionService}
   * instance reuses one pool — tests that instantiate the service repeatedly no longer
   * leak a new pool each construction. Threads are daemons, so the pool never blocks
   * JVM shutdown; explicit lifecycle management isn't required.
   */
  private static final Executor DEFAULT_EXECUTOR = createDefaultExtractionExecutor();

  private static Executor createDefaultExtractionExecutor() {
    int threads = Math.max(2, Runtime.getRuntime().availableProcessors() / 2);
    ThreadFactory threadFactory =
        new ThreadFactory() {
          private final AtomicInteger counter = new AtomicInteger();

          @Override
          public Thread newThread(Runnable r) {
            Thread t = new Thread(r, "context-file-extraction-" + counter.incrementAndGet());
            t.setDaemon(true);
            return t;
          }
        };
    // Bounded queue + AbortPolicy so an overloaded server rejects new extractions
    // rather than accumulating an unbounded backlog on the heap. The RejectedExecutionException
    // handling in submit(...) below turns the rejection into a Failed processing status
    // on the content, so callers see a clear "retry later" signal instead of silent buildup.
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

  ContextFileExtractionService(
      ContextFileRepository repository,
      Supplier<AssetService> assetServiceSupplier,
      Executor executor,
      ContextFileTextExtractor textExtractor) {
    this.repository = repository;
    this.assetServiceSupplier = assetServiceSupplier;
    this.executor = executor;
    this.textExtractor = textExtractor;
  }

  public void submit(UUID fileId, UUID contentId) {
    try {
      executor.execute(() -> process(fileId, contentId));
    } catch (RejectedExecutionException e) {
      LOG.warn(
          "Skipping text extraction for file {} because the async executor rejected it", fileId, e);
      applyFailure(fileId, contentId, "Text extraction queue is full. Please retry later.");
    }
  }

  void process(UUID fileId, UUID contentId) {
    ContextFile file = getFile(fileId);
    if (file == null || !contentId.toString().equals(file.getHeadContentId())) {
      return;
    }

    updateFile(
        fileId,
        current -> {
          if (!contentId.toString().equals(current.getHeadContentId())) {
            return null;
          }
          ContextFile updated = JsonUtils.deepCopy(current, ContextFile.class);
          updated.setProcessingStatus(ProcessingStatus.Analyzing);
          return updated;
        });
    updateContent(
        contentId,
        current -> {
          // Re-read the file inside the content updater so we don't mark an
          // older content "Analyzing" when headContentId changed concurrently.
          // Without this guard, a no-op updateFile above would still be followed
          // by a status update on the now-stale content, leaving it stuck once
          // the later head-check early-returns.
          ContextFile currentHead = getFile(fileId);
          if (currentHead == null
              || !contentId.toString().equals(currentHead.getHeadContentId())) {
            return null;
          }
          ContextFileContent updated = JsonUtils.deepCopy(current, ContextFileContent.class);
          updated.setProcessingStatus(ProcessingStatus.Analyzing);
          updated.setProcessingError(null);
          return updated;
        });

    try {
      ContextFile currentFile = getFile(fileId);
      ContextFileContent currentContent = getContent(contentId);
      if (currentFile == null
          || currentContent == null
          || !contentId.toString().equals(currentFile.getHeadContentId())) {
        return;
      }

      AssetService assetService = assetServiceSupplier.get();
      if (assetService == null) {
        applyFailure(fileId, contentId, "Object storage is not configured for text extraction");
        return;
      }

      Asset asset = repository.getAssetRepository().getById(currentContent.getAssetId());
      try (InputStream inputStream = assetService.read(asset).join()) {
        if (inputStream == null) {
          applyFailure(fileId, contentId, "Unable to read file content from object storage");
          return;
        }
        ContextFileTextExtractor.ExtractionResult result =
            textExtractor.extract(inputStream, currentFile);
        applyResult(fileId, contentId, result);
      }
    } catch (Throwable t) {
      if (t instanceof VirtualMachineError vmError) {
        throw vmError;
      }
      LOG.error("Failed to extract text for file {} content {}", fileId, contentId, t);
      applyFailure(fileId, contentId, describeFailure(t));
    }
  }

  private String describeFailure(Throwable t) {
    return t.getMessage() == null || t.getMessage().isBlank() ? t.toString() : t.getMessage();
  }

  private void applyResult(
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

    updateFile(
        fileId,
        current -> {
          if (!contentId.toString().equals(current.getHeadContentId())) {
            return null;
          }
          ContextFile updated = JsonUtils.deepCopy(current, ContextFile.class);
          updated.setProcessingStatus(result.processingStatus());
          updated.setExtractedText(result.indexedText());
          updated.setPageCount(result.pageCount());
          return updated;
        });
  }

  private void applyFailure(UUID fileId, UUID contentId, String reason) {
    updateContent(
        contentId,
        current -> {
          ContextFileContent updated = JsonUtils.deepCopy(current, ContextFileContent.class);
          updated.setProcessingStatus(ProcessingStatus.Failed);
          updated.setProcessingError(reason);
          updated.setExtractedText(null);
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
          updated.setExtractedText(null);
          updated.setPageCount(null);
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

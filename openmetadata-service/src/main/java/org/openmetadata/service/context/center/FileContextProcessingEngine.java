package org.openmetadata.service.context.center;

import java.util.UUID;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.resources.drive.ContextFileVisibility;

/**
 * {@link ContextProcessingEngine} for ContextFile sources. The source text is the current content
 * snapshot's canonical extracted text; the hash is that snapshot's stored checksum. An unchanged
 * snapshot skips processing, and a new file with an already-extracted checksum reuses its memories.
 */
public class FileContextProcessingEngine extends ContextProcessingEngine {
  private final ContextFileRepository fileRepository;

  public FileContextProcessingEngine(
      ContextFileRepository fileRepository,
      DocumentMemoryExtractor extractor,
      ContextMemoryReconciler reconciler) {
    super(extractor, reconciler);
    this.fileRepository = fileRepository;
  }

  @Override
  protected Source loadSource(UUID fileId) {
    Source source = null;
    ContextFile file = getFile(fileId);
    if (file != null && file.getHeadContentId() != null) {
      ContextFileContent content = fileRepository.getContentById(file.getHeadContentId());
      if (content != null) {
        // Empty extracted text still yields a source so a file whose content became empty
        // reconciles to an empty pill set (archiving stale pills) rather than being skipped.
        String text = content.getExtractedText() == null ? "" : content.getExtractedText();
        String hash =
            content.getChecksum() != null ? content.getChecksum() : content.getId().toString();
        source = new Source(text, hash, file.getEntityReference());
      }
    }
    return source;
  }

  @Override
  protected ExtractionOutcome reuseExisting(UUID fileId, Source source) {
    if (loadStats(fileId) != null) {
      return null;
    }
    // Reused memories stay anchored to the prior file, so a restricted prior would hide them from
    // readers of this one.
    for (ContextFile prior : fileRepository.listByExtractedSourceHash(source.hash(), fileId)) {
      if (prior.getProcessingStatus() != ProcessingStatus.Processed
          || prior.getExtractionStats() == null
          || !ContextFileVisibility.isOrgWide(prior)) {
        continue;
      }
      ContextMemoryReconciler.ReconcileResult reused =
          reconciler.reuseExtractedFrom(source.sourceRef(), prior.getEntityReference());
      if (reused != null) {
        ExtractionStats stats =
            new ExtractionStats()
                .withChunksTotal(prior.getExtractionStats().getChunksTotal())
                .withChunksProcessed(prior.getExtractionStats().getChunksProcessed())
                .withPillsCreated(0)
                .withLastExtractedAt(System.currentTimeMillis())
                .withSourceHash(source.hash());
        stampStats(fileId, stats);
        return ExtractionOutcome.processed(stats, reused);
      }
    }
    return null;
  }

  @Override
  protected ExtractionStats loadStats(UUID fileId) {
    ContextFile file = getFile(fileId);
    return file == null ? null : file.getExtractionStats();
  }

  @Override
  protected void stampStats(UUID fileId, ExtractionStats stats) {
    ContextFile current = getFile(fileId);
    if (current != null) {
      ContextFile updated = JsonUtils.deepCopy(current, ContextFile.class);
      updated.setExtractionStats(stats);
      fileRepository.update(null, current, updated, Entity.ADMIN_USER_NAME);
    }
  }

  @Override
  protected String entityType() {
    return Entity.CONTEXT_FILE;
  }

  @Override
  protected ContextMemorySourceType sourceType() {
    return ContextMemorySourceType.FILE_EXTRACTION;
  }

  private ContextFile getFile(UUID fileId) {
    ContextFile result = null;
    try {
      result =
          fileRepository.get(
              null, fileId, fileRepository.getFields(""), Include.NON_DELETED, false);
    } catch (EntityNotFoundException e) {
      // A deleted file is a legitimate skip; any other failure (DB outage, ...) must propagate so
      // the caller records a Failed run instead of silently marking the file Processed.
      result = null;
    }
    return result;
  }
}

package org.openmetadata.service.drive;

import java.util.UUID;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextFileRepository;

/**
 * {@link ContextProcessingEngine} for ContextFile sources. The source text is the current content
 * snapshot's canonical extracted text; the hash is that snapshot's stored checksum, so re-uploading
 * identical bytes is short-circuited by the hash gate.
 */
public class FileContextProcessingEngine extends ContextProcessingEngine {
  private final ContextFileRepository fileRepository;

  public FileContextProcessingEngine(
      ContextFileRepository fileRepository,
      ContextMemoryExtractor extractor,
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
    } catch (Exception e) {
      result = null;
    }
    return result;
  }
}

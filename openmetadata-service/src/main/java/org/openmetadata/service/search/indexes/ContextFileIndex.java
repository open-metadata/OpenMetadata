package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.context.center.MemoryExtractionState.NEVER_EXTRACTED;

import java.util.Map;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.service.Entity;
import org.openmetadata.service.context.center.MemoryExtractionState;

public class ContextFileIndex implements TaggableIndex {
  final ContextFile file;

  public ContextFileIndex(ContextFile file) {
    this.file = file;
  }

  @Override
  public Object getEntity() {
    return file;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.CONTEXT_FILE;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("fileType", file.getFileType());
    doc.put("fileSize", file.getFileSize());
    doc.put("fileExtension", file.getFileExtension());
    doc.put("contentType", file.getContentType());
    doc.put("processingStatus", file.getProcessingStatus());
    // Computed here: the entity a write indexes carries no value, or a stale one.
    doc.put(NEVER_EXTRACTED, MemoryExtractionState.neverExtracted(file));
    doc.put("sourceType", file.getSourceType());
    // What ContextMemorySearchVisibility filters on. A file with no shareConfig stamps a null
    // visibility, which that filter reads as unrestricted — the same answer the REST guard gives.
    doc.putAll(ContextMemoryIndex.shareConfigFields(file.getShareConfig()));
    if (!nullOrEmpty(file.getExtractedText())) {
      doc.put("extractedText", file.getExtractedText());
    }
    if (file.getFolder() != null) {
      doc.put("folder", getEntityWithDisplayName(file.getFolder()));
    }
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("fileExtension", 3.0f);
    fields.put("extractedText", 2.0f);
    return fields;
  }
}

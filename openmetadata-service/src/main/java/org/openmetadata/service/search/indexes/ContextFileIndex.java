package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Map;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.service.Entity;

public class ContextFileIndex implements SearchIndex {
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
    doc.put("entityType", Entity.CONTEXT_FILE);
    doc.put("deleted", file.getDeleted() != null ? file.getDeleted() : Boolean.FALSE);
    if (file.getOwners() != null) {
      doc.put("owners", file.getOwners());
    }
    if (file.getVotes() != null) {
      int up = file.getVotes().getUpVotes() != null ? file.getVotes().getUpVotes() : 0;
      int down = file.getVotes().getDownVotes() != null ? file.getVotes().getDownVotes() : 0;
      doc.put("totalVotes", up - down);
    }
    doc.put("fileType", file.getFileType());
    doc.put("fileSize", file.getFileSize());
    doc.put("fileExtension", file.getFileExtension());
    doc.put("contentType", file.getContentType());
    doc.put("processingStatus", file.getProcessingStatus());
    doc.put("sourceType", file.getSourceType());
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

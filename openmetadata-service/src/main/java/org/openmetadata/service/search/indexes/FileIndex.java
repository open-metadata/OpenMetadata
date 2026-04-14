package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.service.Entity;

public class FileIndex implements DataAssetIndex {
  final Set<String> excludeFileFields = Set.of("changeDescription", "incrementalChangeDescription");
  final File file;

  public FileIndex(File file) {
    this.file = file;
  }

  @Override
  public Object getEntity() {
    return file;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.FILE;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFileFields;
  }

  @Override
  public Object getIndexServiceType() {
    return file.getServiceType();
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("directory", getEntityWithDisplayName(file.getDirectory()));
    doc.put("fileType", file.getFileType());
    doc.put("mimeType", file.getMimeType());
    doc.put("fileExtension", file.getFileExtension());
    doc.put("path", file.getPath());
    doc.put("size", file.getSize());
    doc.put("checksum", file.getChecksum());
    doc.put("isShared", file.getIsShared());
    doc.put("fileVersion", file.getFileVersion());
    doc.put("createdTime", file.getCreatedTime());
    doc.put("modifiedTime", file.getModifiedTime());
    doc.put("lastModifiedBy", getEntityWithDisplayName(file.getLastModifiedBy()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("path", 5.0f);
    fields.put("fileType", 3.0f);
    fields.put("mimeType", 2.0f);
    fields.put("fileExtension", 3.0f);
    return fields;
  }
}

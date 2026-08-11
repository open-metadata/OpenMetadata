package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.service.Entity;

public class DirectoryIndex implements DataAssetIndex {
  final Set<String> excludeDirectoryFields =
      Set.of("children", "changeDescription", "incrementalChangeDescription");
  final Directory directory;

  public DirectoryIndex(Directory directory) {
    this.directory = directory;
  }

  @Override
  public Object getEntity() {
    return directory;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DIRECTORY;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeDirectoryFields;
  }

  @Override
  public Object getIndexServiceType() {
    return directory.getServiceType();
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("parent", getEntityWithDisplayName(directory.getParent()));
    doc.put("directoryType", directory.getDirectoryType());
    doc.put("path", directory.getPath());
    doc.put("isShared", directory.getIsShared());
    doc.put("numberOfFiles", directory.getNumberOfFiles());
    doc.put("numberOfSubDirectories", directory.getNumberOfSubDirectories());
    doc.put("totalSize", directory.getTotalSize());
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("path", 5.0f);
    fields.put("directoryType", 3.0f);
    return fields;
  }
}

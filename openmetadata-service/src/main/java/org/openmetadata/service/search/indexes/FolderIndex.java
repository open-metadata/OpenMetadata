package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.service.Entity;

public class FolderIndex implements TaggableIndex {
  final Folder folder;

  public FolderIndex(Folder folder) {
    this.folder = folder;
  }

  @Override
  public Object getEntity() {
    return folder;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.FOLDER;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (folder.getParent() != null) {
      doc.put("parent", getEntityWithDisplayName(folder.getParent()));
    }
    // Default to 0 when the entity hasn't had its children recomputed yet (e.g. just-created
    // folders). Storing null as a long/integer in ES indexes as `missing` and breaks
    // numeric range/sort queries that assume the field is always present.
    doc.put("childrenCount", folder.getChildrenCount() != null ? folder.getChildrenCount() : 0);
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

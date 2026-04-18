package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.service.Entity;

public class FolderIndex implements SearchIndex {
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
    doc.put("entityType", Entity.FOLDER);
    doc.put("deleted", folder.getDeleted() != null ? folder.getDeleted() : Boolean.FALSE);
    if (folder.getOwners() != null) {
      doc.put("owners", folder.getOwners());
    }
    if (folder.getParent() != null) {
      doc.put("parent", getEntityWithDisplayName(folder.getParent()));
    }
    doc.put("childrenCount", folder.getChildrenCount());
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

package org.openmetadata.service.search.indexes;

import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.service.Entity;

public class FolderIndex implements TaggableIndex {
  final Folder folder;

  public FolderIndex(Folder folder) {
    this.folder = folder;
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(TaggableIndex.super.getRequiredReindexFields());
    fields.add(Entity.FIELD_PARENT);
    return Collections.unmodifiableSet(fields);
  }

  @Override
  public Object getEntity() {
    return folder;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.FOLDER;
  }

  /**
   * No {@code childrenCount}: the files a folder shows depend on who reads it, so the count is
   * computed per caller on read (ADR:2026-11-03-context-center-listings-show-and-count-only-what-the-caller-may-read).
   */
  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (folder.getParent() != null) {
      doc.put("parent", getEntityWithDisplayName(folder.getParent()));
    }
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

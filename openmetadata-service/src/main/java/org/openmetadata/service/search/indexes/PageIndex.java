package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

public class PageIndex implements SearchIndex {
  final Page page;

  public PageIndex(Page page) {
    this.page = page;
  }

  @Override
  public Object getEntity() {
    return page;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.PAGE;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("fqnDepth", calculateFqnDepth(page.getFullyQualifiedName()));
    // Pages are hard-deleted (not soft-deleted), so always appear as not-deleted in search
    doc.put("deleted", Boolean.FALSE);
    return doc;
  }

  int calculateFqnDepth(String fullyQualifiedName) {
    if (fullyQualifiedName == null || fullyQualifiedName.isEmpty()) {
      return 0;
    }
    return FullyQualifiedName.split(fullyQualifiedName).length;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

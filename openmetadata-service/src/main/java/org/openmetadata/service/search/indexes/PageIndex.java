package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.jdbi3.KnowledgePageRepository.KNOWLEDGE_PAGE_ENTITY;

import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Page;
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
    return KNOWLEDGE_PAGE_ENTITY;
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(SearchIndex.super.getRequiredReindexFields());
    fields.add("parent");
    fields.add("children");
    fields.add("editors");
    fields.add("relatedEntities");
    return Collections.unmodifiableSet(fields);
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("fqnDepth", calculateFqnDepth(page.getFullyQualifiedName()));
    // Override common deleted field: pages are hard-deleted (not soft-deleted),
    // so they should always appear as not-deleted in the search index
    doc.put("deleted", Boolean.FALSE);
    return doc;
  }

  public static int calculateFqnDepth(String fullyQualifiedName) {
    if (fullyQualifiedName == null || fullyQualifiedName.isEmpty()) {
      return 0;
    }
    return FullyQualifiedName.split(fullyQualifiedName).length;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

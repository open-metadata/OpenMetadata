package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.service.Entity;

public record DomainIndex(Domain domain) implements TaggableIndex, LineageIndex {
  private static final Set<String> excludeFields = Set.of("assets");

  @Override
  public Object getEntity() {
    return domain;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DOMAIN;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

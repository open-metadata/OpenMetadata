package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.service.Entity;

public record DataProductIndex(DataProduct dataProduct) implements TaggableIndex, LineageIndex {
  private static final Set<String> excludeFields = Set.of("assets");

  @Override
  public Object getEntity() {
    return dataProduct;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DATA_PRODUCT;
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

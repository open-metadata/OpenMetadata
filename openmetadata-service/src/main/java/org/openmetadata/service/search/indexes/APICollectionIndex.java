package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.service.Entity;

public record APICollectionIndex(APICollection apiCollection) implements SearchIndex {

  @Override
  public Object getEntity() {
    return apiCollection;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(apiCollection, Entity.API_COLLCECTION);
    doc.putAll(commonAttributes);
    return doc;
  }
}

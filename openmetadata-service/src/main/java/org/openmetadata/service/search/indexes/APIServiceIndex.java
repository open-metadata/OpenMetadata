package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.service.Entity;

public record APIServiceIndex(org.openmetadata.schema.entity.services.ApiService apiService)
    implements SearchIndex {

  @Override
  public Object getEntity() {
    return apiService;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(apiService, Entity.API_SERVICE);
    doc.putAll(commonAttributes);
    SearchIndex.populateLineageData(doc, apiService.getEntityReference());
    return doc;
  }
}

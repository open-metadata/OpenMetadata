package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.service.Entity;

public record MetadataServiceIndex(MetadataService metadataService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return metadataService;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(metadataService, Entity.METADATA_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(metadataService.getEntityReference()));
    return doc;
  }
}

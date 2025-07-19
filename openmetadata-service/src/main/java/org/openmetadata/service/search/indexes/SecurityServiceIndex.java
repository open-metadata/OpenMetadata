package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.service.Entity;

public record SecurityServiceIndex(SecurityService securityService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return securityService;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(securityService, Entity.SECURITY_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(securityService.getEntityReference()));
    return doc;
  }
} 
package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.service.Entity;

public record MessagingServiceIndex(MessagingService messagingService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return messagingService;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(messagingService, Entity.MESSAGING_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(messagingService.getEntityReference()));
    return doc;
  }
}

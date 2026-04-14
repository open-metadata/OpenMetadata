package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.service.Entity;

public record MessagingServiceIndex(MessagingService messagingService)
    implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return messagingService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.MESSAGING_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}

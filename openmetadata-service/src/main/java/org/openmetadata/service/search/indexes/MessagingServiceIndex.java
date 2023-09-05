package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.service.util.JsonUtils;

public class MessagingServiceIndex implements ElasticSearchIndex {

  final MessagingService messagingService;

  public MessagingServiceIndex(MessagingService messagingService) {
    this.messagingService = messagingService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(messagingService);
    return doc;
  }
}

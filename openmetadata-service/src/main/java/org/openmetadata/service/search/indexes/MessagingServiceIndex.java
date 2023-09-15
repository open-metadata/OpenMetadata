package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class MessagingServiceIndex implements ElasticSearchIndex {

  final MessagingService messagingService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public MessagingServiceIndex(MessagingService messagingService) {
    this.messagingService = messagingService;
  }

  public Map<String, Object> buildESDoc() {
    if (messagingService.getOwner() != null) {
      EntityReference owner = messagingService.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      messagingService.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(messagingService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(messagingService.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(messagingService.getFullyQualifiedName()).weight(5).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.MESSAGING_SERVICE);
    return doc;
  }
}

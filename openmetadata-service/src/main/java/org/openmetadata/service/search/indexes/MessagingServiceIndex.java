package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class MessagingServiceIndex implements SearchIndex {

  final MessagingService messagingService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public MessagingServiceIndex(MessagingService messagingService) {
    this.messagingService = messagingService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(messagingService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(messagingService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(messagingService.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            messagingService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.MESSAGING_SERVICE);
    doc.put("owner", getEntityWithDisplayName(messagingService.getOwner()));
    doc.put("domain", getEntityWithDisplayName(messagingService.getDomain()));
    return doc;
  }
}

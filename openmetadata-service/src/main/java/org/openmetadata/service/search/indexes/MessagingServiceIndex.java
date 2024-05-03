package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record MessagingServiceIndex(MessagingService messagingService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return messagingService;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(messagingService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(messagingService.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            messagingService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.MESSAGING_SERVICE);
    doc.put("owner", getEntityWithDisplayName(messagingService.getOwner()));
    doc.put("domain", getEntityWithDisplayName(messagingService.getDomain()));
    doc.put("followers", SearchIndexUtils.parseFollowers(messagingService.getFollowers()));
    return doc;
  }
}

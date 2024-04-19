package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public record MessagingServiceIndex(MessagingService messagingService) implements SearchIndex {
  private static final List<String> excludeFields = List.of("changeDescription");

  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(messagingService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(messagingService.getFullyQualifiedName()).weight(5).build());
    return suggest;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(messagingService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(messagingService, Entity.MESSAGING_SERVICE);
    doc.putAll(commonAttributes);
    return doc;
  }
}

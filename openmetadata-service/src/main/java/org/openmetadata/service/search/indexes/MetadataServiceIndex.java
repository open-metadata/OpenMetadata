package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public record MetadataServiceIndex(MetadataService metadataService) implements SearchIndex {

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(metadataService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(metadataService.getFullyQualifiedName()).weight(5).build());
    return suggest;
  }

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

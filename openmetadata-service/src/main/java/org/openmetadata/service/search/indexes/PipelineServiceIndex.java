package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record PipelineServiceIndex(PipelineService pipelineService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return pipelineService;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(pipelineService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(pipelineService.getFullyQualifiedName()).weight(5).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.PIPELINE_SERVICE);
    doc.put(
        "fqnParts",
        getFQNParts(
            pipelineService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("owner", getEntityWithDisplayName(pipelineService.getOwner()));
    doc.put("followers", SearchIndexUtils.parseFollowers(pipelineService.getFollowers()));
    return doc;
  }
}

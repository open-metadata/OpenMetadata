package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class PipelineServiceIndex implements SearchIndex {

  final PipelineService pipelineService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public PipelineServiceIndex(PipelineService pipelineService) {
    this.pipelineService = pipelineService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(pipelineService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(pipelineService.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(pipelineService.getFullyQualifiedName()).weight(5).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.PIPELINE_SERVICE);
    doc.put(
        "fqnParts",
        getFQNParts(
            pipelineService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("owner", getOwnerWithDisplayName(pipelineService.getOwner()));
    return doc;
  }
}

package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class ClassificationIndex implements SearchIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final Classification classification;

  public ClassificationIndex(Classification classification) {
    this.classification = classification;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(classification);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(classification.getName()).weight(10).build());
    suggest.add(SearchSuggest.builder().input(classification.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            classification.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.CLASSIFICATION);
    doc.put("owner", getOwnerWithDisplayName(classification.getOwner()));
    return doc;
  }
}

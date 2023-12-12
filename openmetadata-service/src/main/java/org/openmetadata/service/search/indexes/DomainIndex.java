package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class DomainIndex implements SearchIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final Domain domain;

  public DomainIndex(Domain domain) {
    this.domain = domain;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(domain);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(domain.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(domain.getFullyQualifiedName()).weight(5).build());
    doc.put(
      "fqnParts",
      getFQNParts(
        domain.getFullyQualifiedName(),
        suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())
      )
    );
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DOMAIN);
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

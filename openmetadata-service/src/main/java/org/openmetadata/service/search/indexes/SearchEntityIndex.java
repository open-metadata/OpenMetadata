package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class SearchEntityIndex implements SearchIndex {

  final org.openmetadata.schema.entity.data.SearchIndex searchIndex;

  private static final List<String> excludeFields = List.of("changeDescription");

  public SearchEntityIndex(org.openmetadata.schema.entity.data.SearchIndex searchIndex) {
    this.searchIndex = searchIndex;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(searchIndex);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(searchIndex.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(searchIndex.getFullyQualifiedName()).weight(5).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.SEARCH_INDEX);
    doc.put(
        "fqnParts",
        getFQNParts(
            searchIndex.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.SEARCH_INDEX, searchIndex));
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("owner", getEntityWithDisplayName(searchIndex.getOwner()));
    doc.put("service", getEntityWithDisplayName(searchIndex.getService()));
    doc.put("lineage", SearchIndex.getLineageData(searchIndex.getEntityReference()));
    doc.put("domain", getEntityWithDisplayName(searchIndex.getDomain()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("fields.name", 2.0f);
    fields.put("fields.children.description", 1.0f);
    fields.put("fields.children.name", 2.0f);
    return fields;
  }
}

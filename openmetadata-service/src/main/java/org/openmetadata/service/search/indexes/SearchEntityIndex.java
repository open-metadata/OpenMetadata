package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME_PARTS;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;

import java.util.ArrayList;
import java.util.HashMap;
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
    doc.put("domain", getEntityWithDisplayName(searchIndex.getDomain()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 15.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(FIELD_NAME, 15.0f);
    fields.put(FIELD_NAME_NGRAM, 1.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 25.0f);
    fields.put(NAME_KEYWORD, 25.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 10.0f);
    fields.put(FIELD_DESCRIPTION, 1.0f);
    fields.put("fields.name", 2.0f);
    fields.put("fields.children.description", 1.0f);
    fields.put("fields.children.name", 2.0f);
    return fields;
  }
}

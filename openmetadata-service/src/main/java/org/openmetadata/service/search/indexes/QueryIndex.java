package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.search.EntityBuilderConstant.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class QueryIndex implements SearchIndex {
  final List<String> excludeTopicFields = List.of("changeDescription");
  final Query query;

  public QueryIndex(Query query) {
    this.query = query;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(query);
    List<SearchSuggest> suggest = new ArrayList<>();
    if (query.getDisplayName() != null) {
      suggest.add(SearchSuggest.builder().input(query.getName()).weight(10).build());
    }
    SearchIndexUtils.removeNonIndexableFields(doc, excludeTopicFields);

    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.QUERY, query));
    doc.put("displayName", query.getDisplayName() != null ? query.getDisplayName() : "");
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("followers", SearchIndexUtils.parseFollowers(query.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.QUERY);
    doc.put(
        "fqnParts",
        getFQNParts(
            query.getFullyQualifiedName(), suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 10.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(QUERY, 10.0f);
    fields.put(QUERY_NGRAM, 1.0f);
    fields.put(FIELD_DESCRIPTION, 1.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 10.0f);
    return fields;
  }
}

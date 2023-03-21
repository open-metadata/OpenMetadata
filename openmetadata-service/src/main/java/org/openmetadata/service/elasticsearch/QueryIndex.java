package org.openmetadata.service.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

public class QueryIndex implements ElasticSearchIndex {
  final List<String> excludeTopicFields = List.of("changeDescription");
  final Query query;

  public QueryIndex(Query query) {
    this.query = query;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(query);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(query.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(query.getName()).weight(10).build());
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeTopicFields);

    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.QUERY, query));
    doc.put("displayName", query.getDisplayName() != null ? query.getDisplayName() : query.getName());
    doc.put("tags", parseTags.tags);
    doc.put("tier", parseTags.tierTag);
    doc.put("followers", ElasticSearchIndexUtils.parseFollowers(query.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.QUERY);
    return doc;
  }
}

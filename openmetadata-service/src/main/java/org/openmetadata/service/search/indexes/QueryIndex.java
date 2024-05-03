package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.search.EntityBuilderConstant.QUERY_NGRAM;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public class QueryIndex implements SearchIndex {
  final Query query;

  public QueryIndex(Query query) {
    this.query = query;
  }

  @Override
  public Object getEntity() {
    return query;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    if (query.getDisplayName() != null) {
      suggest.add(SearchSuggest.builder().input(query.getName()).weight(10).build());
    }
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.QUERY, query));
    doc.put("displayName", query.getDisplayName() != null ? query.getDisplayName() : "");
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("followers", SearchIndexUtils.parseFollowers(query.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.QUERY);
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(query.getVotes())
            ? 0
            : query.getVotes().getUpVotes() - query.getVotes().getDownVotes());
    doc.put(
        "fqnParts",
        getFQNParts(
            query.getFullyQualifiedName(), suggest.stream().map(SearchSuggest::getInput).toList()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put(QUERY, 10.0f);
    fields.put(QUERY_NGRAM, 1.0f);
    return fields;
  }
}

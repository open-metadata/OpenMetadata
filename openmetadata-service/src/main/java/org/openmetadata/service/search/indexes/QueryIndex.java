package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.search.EntityBuilderConstant.QUERY_NGRAM;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class QueryIndex implements SearchIndex {
  final Query query;

  public QueryIndex(Query query) {
    this.query = query;
  }

  @Override
  public Object getEntity() {
    return query;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.QUERY, query));
    Map<String, Object> commonAttributes = getCommonAttributesMap(query, Entity.QUERY);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("classificationTags", parseTags.getClassificationTags());
    doc.put("glossaryTags", parseTags.getGlossaryTags());

    // Add votes with only counts (not voter lists) to reduce index size
    // The full votes object with voter lists is excluded by DEFAULT_EXCLUDED_FIELDS
    if (query.getVotes() != null) {
      Map<String, Object> votesMap = new HashMap<>();
      votesMap.put("upVotes", query.getVotes().getUpVotes());
      votesMap.put("downVotes", query.getVotes().getDownVotes());
      doc.put("votes", votesMap);
    }

    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put(QUERY, 10.0f);
    fields.put(QUERY_NGRAM, 1.0f);
    return fields;
  }
}

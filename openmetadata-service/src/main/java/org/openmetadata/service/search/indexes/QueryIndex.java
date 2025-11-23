package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.search.EntityBuilderConstant.QUERY_NGRAM;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
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

  @Override
  public Set<String> getExcludedFields() {
    // Allow votes to be indexed for queries, but exclude changeDescription
    Set<String> excludedFields = new HashSet<>(SearchIndex.DEFAULT_EXCLUDED_FIELDS);
    excludedFields.remove("votes");
    return excludedFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.QUERY, query));
    Map<String, Object> commonAttributes = getCommonAttributesMap(query, Entity.QUERY);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("classificationTags", parseTags.getClassificationTags());
    doc.put("glossaryTags", parseTags.getGlossaryTags());

    // Explicitly add votes to the search document
    if (query.getVotes() != null) {
      doc.put("votes", query.getVotes());
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

package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record SearchEntityIndex(org.openmetadata.schema.entity.data.SearchIndex searchIndex)
    implements SearchIndex {

  @Override
  public Object getEntity() {
    return searchIndex;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(searchIndex.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(searchIndex.getFullyQualifiedName()).weight(5).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.SEARCH_INDEX);
    doc.put(
        "fqnParts",
        getFQNParts(
            searchIndex.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.SEARCH_INDEX, searchIndex));
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("owner", getEntityWithDisplayName(searchIndex.getOwner()));
    doc.put("service", getEntityWithDisplayName(searchIndex.getService()));
    doc.put("followers", SearchIndexUtils.parseFollowers(searchIndex.getFollowers()));
    doc.put("lineage", SearchIndex.getLineageData(searchIndex.getEntityReference()));
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(searchIndex.getVotes())
            ? 0
            : searchIndex.getVotes().getUpVotes() - searchIndex.getVotes().getDownVotes());
    doc.put("domain", getEntityWithDisplayName(searchIndex.getDomain()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("fields.name", 7.0f);
    fields.put("fields.name.keyword", 50f);
    fields.put("fields.children.description", 1.0f);
    fields.put("fields.children.name", 7.0f);
    fields.put("fields.children.name.keyword", 5.0f);
    return fields;
  }
}

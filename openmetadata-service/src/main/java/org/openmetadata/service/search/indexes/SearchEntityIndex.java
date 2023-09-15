package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class SearchEntityIndex implements ElasticSearchIndex {

  final org.openmetadata.schema.entity.data.SearchIndex searchIndex;

  private static final List<String> excludeFields = List.of("changeDescription");

  public SearchEntityIndex(org.openmetadata.schema.entity.data.SearchIndex searchIndex) {
    this.searchIndex = searchIndex;
  }

  public Map<String, Object> buildESDoc() {
    if (searchIndex.getOwner() != null) {
      EntityReference owner = searchIndex.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      searchIndex.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(searchIndex);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(searchIndex.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(searchIndex.getFullyQualifiedName()).weight(5).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.SEARCH_INDEX);
    return doc;
  }
}

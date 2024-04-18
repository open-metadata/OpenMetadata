package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public record StoredProcedureIndex(StoredProcedure storedProcedure) implements SearchIndex {
  private static final List<String> excludeFields = List.of("changeDescription");

  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(
        SearchSuggest.builder().input(storedProcedure.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(storedProcedure.getName()).weight(10).build());
    return suggest;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(storedProcedure);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(storedProcedure, Entity.STORED_PROCEDURE);
    doc.putAll(commonAttributes);
    ParseTags parseTags =
        new ParseTags(Entity.getEntityTags(Entity.STORED_PROCEDURE, storedProcedure));
    doc.put("tags", parseTags.getTags());
    doc.put("lineage", SearchIndex.getLineageData(storedProcedure.getEntityReference()));
    doc.put("tier", parseTags.getTierTag());
    doc.put("service", getEntityWithDisplayName(storedProcedure.getService()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

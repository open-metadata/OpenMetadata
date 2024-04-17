package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public record DatabaseSchemaIndex(DatabaseSchema databaseSchema) implements SearchIndex {
  private static final List<String> excludeFields = List.of("changeDescription");

  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(databaseSchema.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(databaseSchema.getFullyQualifiedName()).weight(5).build());
    return suggest;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(databaseSchema);
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(databaseSchema, Entity.DATABASE_SCHEMA);
    doc.putAll(commonAttributes);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}

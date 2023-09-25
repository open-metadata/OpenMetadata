package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class DatabaseSchemaIndex implements ElasticSearchIndex {
  final DatabaseSchema databaseSchema;

  private static final List<String> excludeFields = List.of("changeDescription");

  public DatabaseSchemaIndex(DatabaseSchema databaseSchema) {
    this.databaseSchema = databaseSchema;
  }

  public Map<String, Object> buildESDoc() {
    if (databaseSchema.getOwner() != null) {
      EntityReference owner = databaseSchema.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      databaseSchema.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(databaseSchema);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(databaseSchema.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(databaseSchema.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            databaseSchema.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DATABASE_SCHEMA);
    return doc;
  }
}

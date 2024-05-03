package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record DatabaseSchemaIndex(DatabaseSchema databaseSchema) implements SearchIndex {

  @Override
  public Object getEntity() {
    return databaseSchema;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(databaseSchema.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(databaseSchema.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            databaseSchema.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DATABASE_SCHEMA);
    doc.put("owner", getEntityWithDisplayName(databaseSchema.getOwner()));
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(databaseSchema.getVotes())
            ? 0
            : databaseSchema.getVotes().getUpVotes() - databaseSchema.getVotes().getDownVotes());
    doc.put("domain", getEntityWithDisplayName(databaseSchema.getDomain()));
    doc.put("followers", SearchIndexUtils.parseFollowers(databaseSchema.getFollowers()));
    return doc;
  }
}

package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record DatabaseIndex(Database database) implements SearchIndex {

  @Override
  public Object getEntity() {
    return database;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(database.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(database.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            database.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DATABASE);
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(database.getVotes())
            ? 0
            : database.getVotes().getUpVotes() - database.getVotes().getDownVotes());
    doc.put("owner", getEntityWithDisplayName(database.getOwner()));
    doc.put("domain", getEntityWithDisplayName(database.getDomain()));
    doc.put("followers", SearchIndexUtils.parseFollowers(database.getFollowers()));
    return doc;
  }
}

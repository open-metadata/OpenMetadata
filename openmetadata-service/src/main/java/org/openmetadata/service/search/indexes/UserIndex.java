package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public class UserIndex implements SearchIndex {
  final User user;
  final Set<String> excludeFields = Set.of("owns", "follows", "authenticationMechanism");

  public UserIndex(User user) {
    this.user = user;
  }

  @Override
  public Object getEntity() {
    return user;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(user.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(user.getDisplayName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            user.getFullyQualifiedName(), suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.USER);
    doc.put(
        "displayName",
        CommonUtil.nullOrEmpty(user.getDisplayName()) ? user.getName() : user.getDisplayName());
    if (user.getIsBot() == null) {
      doc.put("isBot", false);
    }
    doc.put("followers", SearchIndexUtils.parseFollowers(user.getFollowers()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

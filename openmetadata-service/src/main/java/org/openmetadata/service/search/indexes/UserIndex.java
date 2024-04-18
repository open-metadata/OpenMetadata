package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class UserIndex implements SearchIndex {
  final User user;
  final List<String> excludeFields =
      List.of("owns", "changeDescription", "follows", "authenticationMechanism");

  public UserIndex(User user) {
    this.user = user;
  }

  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(user.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(user.getDisplayName()).weight(10).build());
    return suggest;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(user);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    Map<String, Object> commonAttributes = getCommonAttributesMap(user, Entity.USER);
    doc.putAll(commonAttributes);
    doc.put(
        "displayName",
        CommonUtil.nullOrEmpty(user.getDisplayName()) ? user.getName() : user.getDisplayName());
    if (user.getIsBot() == null) {
      doc.put("isBot", false);
    }
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

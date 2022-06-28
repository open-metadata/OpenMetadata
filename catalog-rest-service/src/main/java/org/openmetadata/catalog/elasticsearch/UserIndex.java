package org.openmetadata.catalog.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.util.JsonUtils;

public class UserIndex {
  User user;
  final List<String> excludeFields = List.of("owns", "changeDescription");

  public UserIndex(User user) {
    this.user = user;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(user);
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(user.getName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(user.getDisplayName()).weight(10).build());
    doc.remove("owns");
    doc.remove("follows");
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.USER);
    return doc;
  }
}

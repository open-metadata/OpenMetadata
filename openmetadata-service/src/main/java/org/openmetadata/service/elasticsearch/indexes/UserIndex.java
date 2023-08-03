package org.openmetadata.service.elasticsearch.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexUtils;
import org.openmetadata.service.elasticsearch.models.ElasticSearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class UserIndex implements ElasticSearchIndex {
  final User user;
  final List<String> excludeFields = List.of("owns", "changeDescription", "follows", "authenticationMechanism");

  public UserIndex(User user) {
    this.user = user;
  }

  public Map<String, Object> buildESDoc() {
    if (CommonUtil.nullOrEmpty(user.getDisplayName())) {
      user.setDisplayName(user.getName());
    }
    if (user.getIsBot() == null) {
      user.setIsBot(false);
    }
    Map<String, Object> doc = JsonUtils.getMap(user);
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(user.getName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(user.getDisplayName()).weight(10).build());

    doc.put("suggest", suggest);
    doc.put("entityType", Entity.USER);
    return doc;
  }
}

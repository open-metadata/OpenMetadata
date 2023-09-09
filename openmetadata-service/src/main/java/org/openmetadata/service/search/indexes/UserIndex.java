package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
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
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(user.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(user.getDisplayName()).weight(10).build());

    doc.put("suggest", suggest);
    doc.put("entityType", Entity.USER);
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 3.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 5.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(FIELD_NAME, 2.0f);
    fields.put(NAME_KEYWORD, 3.0f);
    return fields;
  }
}

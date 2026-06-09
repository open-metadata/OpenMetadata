package org.openmetadata.service.search.indexes;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;

public class UserIndex implements SearchIndex {
  final User user;
  final Set<String> excludeFields = Set.of("owns", "follows", "authenticationMechanism");

  public UserIndex(User user) {
    this.user = user;
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(SearchIndex.super.getRequiredReindexFields());
    fields.add("teams");
    fields.add("roles");
    fields.add("inheritedRoles");
    return java.util.Collections.unmodifiableSet(fields);
  }

  @Override
  public Object getEntity() {
    return user;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.USER;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (user.getIsBot() == null) {
      doc.put("isBot", false);
    }
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("email", 5.0f);
    fields.put("email.keyword", 10.0f);
    return fields;
  }
}

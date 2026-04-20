package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.service.Entity;

public class RoleIndex implements SearchIndex {
  final Role role;
  final Set<String> excludeFields = Set.of("users", "teams");

  public RoleIndex(Role role) {
    this.role = role;
  }

  @Override
  public Object getEntity() {
    return role;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.ROLE;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}

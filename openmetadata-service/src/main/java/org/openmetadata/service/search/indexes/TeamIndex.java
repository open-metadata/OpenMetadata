package org.openmetadata.service.search.indexes;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.service.Entity;

public class TeamIndex implements SearchIndex {
  final Team team;
  final Set<String> excludeFields = Set.of("owns", "users", "defaultRoles", "inheritedRoles");

  public TeamIndex(Team team) {
    this.team = team;
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(SearchIndex.super.getRequiredReindexFields());
    fields.add("parents");
    return java.util.Collections.unmodifiableSet(fields);
  }

  @Override
  public Object getEntity() {
    return team;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(team, Entity.TEAM);
    doc.putAll(commonAttributes);
    doc.put("isBot", false);
    return doc;
  }
}

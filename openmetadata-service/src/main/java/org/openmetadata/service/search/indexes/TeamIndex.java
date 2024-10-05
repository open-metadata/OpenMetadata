package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public class TeamIndex implements SearchIndex {
  final Team team;
  final Set<String> excludeFields = Set.of("owns");

  public TeamIndex(Team team) {
    this.team = team;
  }

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(team.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(team.getDisplayName()).weight(10).build());
    return suggest;
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

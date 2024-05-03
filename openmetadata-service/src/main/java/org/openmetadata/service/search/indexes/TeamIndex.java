package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public class TeamIndex implements SearchIndex {
  final Team team;
  final Set<String> excludeFields = Set.of("owns");

  public TeamIndex(Team team) {
    this.team = team;
  }

  @Override
  public Object getEntity() {
    return team;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(team.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(team.getDisplayName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            team.getFullyQualifiedName(), suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TEAM);
    doc.put("isBot", false);
    doc.put(
        "displayName",
        CommonUtil.nullOrEmpty(team.getDisplayName()) ? team.getName() : team.getDisplayName());
    doc.put("followers", SearchIndexUtils.parseFollowers(team.getFollowers()));
    return doc;
  }
}

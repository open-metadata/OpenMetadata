package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class TeamIndex implements SearchIndex {
  final Team team;
  final List<String> excludeFields = List.of("owns", "changeDescription");

  public TeamIndex(Team team) {
    this.team = team;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(team);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(team.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(team.getDisplayName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            team.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TEAM);
    doc.put(
        "displayName",
        CommonUtil.nullOrEmpty(team.getDisplayName()) ? team.getName() : team.getDisplayName());
    return doc;
  }
}

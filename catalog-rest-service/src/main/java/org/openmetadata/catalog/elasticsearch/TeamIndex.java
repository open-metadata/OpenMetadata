package org.openmetadata.catalog.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.util.JsonUtils;

public class TeamIndex implements ElasticSearchIndex {
  Team team;
  final List<String> excludeFields = List.of("owns", "changeDescription");

  public TeamIndex(Team team) {
    this.team = team;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(team);
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(team.getName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(team.getDisplayName()).weight(10).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TEAM);
    return doc;
  }
}

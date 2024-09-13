package org.openmetadata.service.search.security;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.queries.OMQueryBuilder;

public class ConditionCollector {

  private List<OMQueryBuilder> mustConditions = new ArrayList<>();
  private List<OMQueryBuilder> shouldConditions = new ArrayList<>();
  private List<OMQueryBuilder> mustNotConditions = new ArrayList<>();

  // Add must conditions (AND)
  public void addMust(OMQueryBuilder query) {
    if (query != null && !query.isEmpty()) {
      mustConditions.add(query);
    }
  }

  public void addMust(List<OMQueryBuilder> queries) {
    for (OMQueryBuilder query : queries) {
      addMust(query); // Delegate to addMust for each query
    }
  }

  // Add should conditions (OR)
  public void addShould(OMQueryBuilder query) {
    if (query != null && !query.isEmpty()) {
      shouldConditions.add(query);
    }
  }

  public void addShould(List<OMQueryBuilder> queries) {
    for (OMQueryBuilder query : queries) {
      addShould(query);
    }
  }

  // Add mustNot conditions (NOT)
  public void addMustNot(OMQueryBuilder query) {
    if (query != null && !query.isEmpty()) {
      mustNotConditions.add(query);
    }
  }

  // Process all collected conditions into a flat query structure
  public OMQueryBuilder buildFinalQuery() {
    OMQueryBuilder finalQuery = new ElasticQueryBuilder();

    // Add AND conditions
    if (!mustConditions.isEmpty()) {
      finalQuery.must(mustConditions);
    }

    // Add OR conditions
    if (!shouldConditions.isEmpty()) {
      finalQuery.should(shouldConditions).minimumShouldMatch(1);
    }

    // Add NOT conditions
    if (!mustNotConditions.isEmpty()) {
      for (OMQueryBuilder query : mustNotConditions) {
        finalQuery.mustNot(query);
      }
    }

    return finalQuery.isEmpty() ? null : finalQuery; // Return null if no valid conditions
  }
}

package org.openmetadata.service.search;

import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.queries.OMQueryBuilder;

public class QueryBuilderService {

  public OMQueryBuilder buildFinalQuery(ConditionCollector collector) {
    OMQueryBuilder mainQuery = new ElasticQueryBuilder();

    // Add must conditions
    if (!collector.getMustConditions().isEmpty()) {
      mainQuery.must(collector.getMustConditions());
    }

    // Add should conditions
    if (!collector.getShouldConditions().isEmpty()) {
      mainQuery.should(collector.getShouldConditions());
      mainQuery.minimumShouldMatch(1); // Ensure at least one OR condition matches
    }

    // Add mustNot conditions
    for (OMQueryBuilder mustNotCondition : collector.getMustNotConditions()) {
      mainQuery.mustNot(mustNotCondition);
    }

    return mainQuery;
  }
}

package org.openmetadata.search.aggregation;

import org.openmetadata.search.SearchAggregationNode;

public interface OMSearchAggregation {

  void createAggregation(SearchAggregationNode node);

  default boolean isPipelineAggregation() {
    return false;
  }

  void addSubAggregation(OMSearchAggregation subAggregation);

  <T> T build(Class<T> targetType);

  String getName();

  String getType();
}

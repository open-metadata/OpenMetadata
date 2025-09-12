package org.openmetadata.search.aggregation;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.search.SearchAggregationNode;

public interface OMSearchAggregationFactory {

  OMSearchAggregation createAggregation(String type);

  default List<OMSearchAggregation> buildAggregationTree(SearchAggregationNode node) {
    List<OMSearchAggregation> aggregations = new ArrayList<>();
    buildAggregation(node, null, aggregations);
    return aggregations;
  }

  default void buildAggregation(
      SearchAggregationNode node,
      OMSearchAggregation parentAggregation,
      List<OMSearchAggregation> rootAggregations) {

    String type = node.getType();
    if ("root".equals(type)) {
      for (SearchAggregationNode child : node.getChildren()) {
        buildAggregation(child, null, rootAggregations);
      }
      return;
    }

    OMSearchAggregation aggregation = createAggregation(type);
    aggregation.createAggregation(node);

    if (parentAggregation != null) {
      parentAggregation.addSubAggregation(aggregation);
    } else {
      rootAggregations.add(aggregation);
    }

    for (SearchAggregationNode child : node.getChildren()) {
      buildAggregation(child, aggregation, rootAggregations);
    }
  }
}

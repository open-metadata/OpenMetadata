package org.openmetadata.search.aggregation.opensearch;

import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.search.SearchAggregationNode;
import org.openmetadata.search.aggregation.OMSearchAggregation;

@Getter
@Setter
public abstract class OpenSearchBaseAggregation implements OMSearchAggregation {
  protected String name;
  protected String type;
  protected Map<String, Object> subAggregations = new HashMap<>();

  public OpenSearchBaseAggregation(String type) {
    this.type = type;
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  public void addSubAggregation(OMSearchAggregation subAggregation) {
    if (subAggregation instanceof OpenSearchBaseAggregation openSearchSub) {
      subAggregations.put(openSearchSub.getName(), openSearchSub.build(Object.class));
    }
  }

  @Override
  public String getType() {
    return type;
  }

  @Override
  public String getName() {
    return name;
  }

  @Override
  @SuppressWarnings("unchecked")
  public <T> T build(Class<T> targetType) {
    // For now, return null - this would need proper OpenSearch aggregation building
    return null;
  }

  protected abstract void buildSpecificAggregation(SearchAggregationNode node);
}

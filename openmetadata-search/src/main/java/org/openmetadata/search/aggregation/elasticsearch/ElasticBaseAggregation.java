package org.openmetadata.search.aggregation.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.search.SearchAggregationNode;
import org.openmetadata.search.aggregation.OMSearchAggregation;

@Getter
@Setter
public abstract class ElasticBaseAggregation implements OMSearchAggregation {
  protected String name;
  protected String type;
  protected Map<String, Aggregation> subAggregations = new HashMap<>();
  protected Aggregation.Builder aggregationBuilder;

  public ElasticBaseAggregation(String type) {
    this.type = type;
  }

  @Override
  public void addSubAggregation(OMSearchAggregation subAggregation) {
    if (subAggregation instanceof ElasticBaseAggregation elasticSub) {
      subAggregations.put(elasticSub.getName(), elasticSub.build(Aggregation.class));
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
    if (targetType.isAssignableFrom(Aggregation.class)) {
      Aggregation agg = aggregationBuilder.build();
      // Sub-aggregations would need to be added based on the specific aggregation type
      return (T) agg;
    }
    throw new IllegalArgumentException("Unsupported target type: " + targetType);
  }

  protected abstract void buildSpecificAggregation(SearchAggregationNode node);
}

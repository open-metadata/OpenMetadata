package org.openmetadata.search.query.builder.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import java.util.HashMap;
import java.util.Map;
import org.openmetadata.search.query.builder.OMAggregationBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilder;

public class ElasticAggregationBuilder implements OMAggregationBuilder {
  private Aggregation.Builder aggregationBuilder;
  private final Map<String, Aggregation> subAggregations = new HashMap<>();

  public ElasticAggregationBuilder() {
    this.aggregationBuilder = new Aggregation.Builder();
  }

  @Override
  public OMAggregationBuilder terms(String field) {
    aggregationBuilder.terms(t -> t.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder histogram(String field, double interval) {
    aggregationBuilder.histogram(h -> h.field(field).interval(interval));
    return this;
  }

  @Override
  public OMAggregationBuilder dateHistogram(String field, String interval) {
    aggregationBuilder.dateHistogram(dh -> dh.field(field).fixedInterval(fi -> fi.time(interval)));
    return this;
  }

  @Override
  public OMAggregationBuilder range(String field) {
    aggregationBuilder.range(r -> r.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder dateRange(String field) {
    aggregationBuilder.dateRange(dr -> dr.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder filter(OMQueryBuilder filter) {
    ElasticQueryBuilder elasticFilter = (ElasticQueryBuilder) filter;
    aggregationBuilder.filter(elasticFilter.build(Query.class));
    return this;
  }

  @Override
  public OMAggregationBuilder nested(String path) {
    aggregationBuilder.nested(n -> n.path(path));
    return this;
  }

  @Override
  public OMAggregationBuilder reverseNested() {
    aggregationBuilder.reverseNested(rn -> rn);
    return this;
  }

  @Override
  public OMAggregationBuilder sum(String field) {
    aggregationBuilder.sum(s -> s.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder avg(String field) {
    aggregationBuilder.avg(a -> a.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder min(String field) {
    aggregationBuilder.min(m -> m.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder max(String field) {
    aggregationBuilder.max(m -> m.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder count(String field) {
    aggregationBuilder.valueCount(vc -> vc.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder stats(String field) {
    aggregationBuilder.stats(s -> s.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder extendedStats(String field) {
    aggregationBuilder.extendedStats(es -> es.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder percentiles(String field) {
    aggregationBuilder.percentiles(p -> p.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder cardinality(String field) {
    aggregationBuilder.cardinality(c -> c.field(field));
    return this;
  }

  @Override
  public OMAggregationBuilder topHits() {
    aggregationBuilder.topHits(th -> th);
    return this;
  }

  @Override
  public OMAggregationBuilder subAggregation(String name, OMAggregationBuilder aggregation) {
    ElasticAggregationBuilder elasticAgg = (ElasticAggregationBuilder) aggregation;
    subAggregations.put(name, elasticAgg.build(Aggregation.class));
    return this;
  }

  @Override
  public OMAggregationBuilder size(int size) {
    // Size handling depends on aggregation type
    return this;
  }

  @Override
  public OMAggregationBuilder minDocCount(long minDocCount) {
    // Min doc count handling depends on aggregation type
    return this;
  }

  @Override
  public OMAggregationBuilder missing(Object missing) {
    // Missing value handling depends on aggregation type
    return this;
  }

  @Override
  public OMAggregationBuilder order(String key, boolean ascending) {
    // Order handling depends on aggregation type
    return this;
  }

  @Override
  public OMAggregationBuilder format(String format) {
    // Format handling depends on aggregation type
    return this;
  }

  @Override
  public OMAggregationBuilder timeZone(String timeZone) {
    // Time zone handling depends on aggregation type
    return this;
  }

  @Override
  public OMAggregationBuilder script(String script, Map<String, Object> params) {
    // Script handling depends on aggregation type
    return this;
  }

  @Override
  @SuppressWarnings("unchecked")
  public <T> T build(Class<T> targetType) {
    if (targetType.isAssignableFrom(Aggregation.class)) {
      Aggregation agg = aggregationBuilder.build();
      // Add sub-aggregations if any
      if (!subAggregations.isEmpty()) {
        // This would need proper implementation to add sub-aggregations
      }
      return (T) agg;
    }
    throw new IllegalArgumentException("Unsupported target type: " + targetType);
  }
}

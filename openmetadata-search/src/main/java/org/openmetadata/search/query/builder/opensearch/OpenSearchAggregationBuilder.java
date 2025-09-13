package org.openmetadata.search.query.builder.opensearch;

import java.util.Map;
import org.openmetadata.search.query.builder.OMAggregationBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilder;

public class OpenSearchAggregationBuilder implements OMAggregationBuilder {

  @Override
  public OMAggregationBuilder terms(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder histogram(String field, double interval) {
    return this;
  }

  @Override
  public OMAggregationBuilder dateHistogram(String field, String interval) {
    return this;
  }

  @Override
  public OMAggregationBuilder range(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder dateRange(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder filter(OMQueryBuilder filter) {
    return this;
  }

  @Override
  public OMAggregationBuilder nested(String path) {
    return this;
  }

  @Override
  public OMAggregationBuilder reverseNested() {
    return this;
  }

  @Override
  public OMAggregationBuilder sum(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder avg(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder min(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder max(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder count(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder stats(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder extendedStats(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder percentiles(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder cardinality(String field) {
    return this;
  }

  @Override
  public OMAggregationBuilder topHits() {
    return this;
  }

  @Override
  public OMAggregationBuilder subAggregation(String name, OMAggregationBuilder aggregation) {
    return this;
  }

  @Override
  public OMAggregationBuilder size(int size) {
    return this;
  }

  @Override
  public OMAggregationBuilder minDocCount(long minDocCount) {
    return this;
  }

  @Override
  public OMAggregationBuilder missing(Object missing) {
    return this;
  }

  @Override
  public OMAggregationBuilder order(String key, boolean ascending) {
    return this;
  }

  @Override
  public OMAggregationBuilder format(String format) {
    return this;
  }

  @Override
  public OMAggregationBuilder timeZone(String timeZone) {
    return this;
  }

  @Override
  public OMAggregationBuilder script(String script, Map<String, Object> params) {
    return this;
  }

  @Override
  @SuppressWarnings("unchecked")
  public <T> T build(Class<T> targetType) {
    // Stub implementation
    return null;
  }
}

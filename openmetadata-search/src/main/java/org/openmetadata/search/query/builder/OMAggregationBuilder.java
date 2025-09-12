package org.openmetadata.search.query.builder;

import java.util.Map;

public interface OMAggregationBuilder {

  OMAggregationBuilder terms(String field);

  OMAggregationBuilder histogram(String field, double interval);

  OMAggregationBuilder dateHistogram(String field, String interval);

  OMAggregationBuilder range(String field);

  OMAggregationBuilder dateRange(String field);

  OMAggregationBuilder filter(OMQueryBuilder filter);

  OMAggregationBuilder nested(String path);

  OMAggregationBuilder reverseNested();

  OMAggregationBuilder sum(String field);

  OMAggregationBuilder avg(String field);

  OMAggregationBuilder min(String field);

  OMAggregationBuilder max(String field);

  OMAggregationBuilder count(String field);

  OMAggregationBuilder stats(String field);

  OMAggregationBuilder extendedStats(String field);

  OMAggregationBuilder percentiles(String field);

  OMAggregationBuilder cardinality(String field);

  OMAggregationBuilder topHits();

  OMAggregationBuilder subAggregation(String name, OMAggregationBuilder aggregation);

  OMAggregationBuilder size(int size);

  OMAggregationBuilder minDocCount(long minDocCount);

  OMAggregationBuilder missing(Object missing);

  OMAggregationBuilder order(String key, boolean ascending);

  OMAggregationBuilder format(String format);

  OMAggregationBuilder timeZone(String timeZone);

  OMAggregationBuilder script(String script, Map<String, Object> params);

  <T> T build(Class<T> targetType);
}

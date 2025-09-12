package org.openmetadata.search.query.builder;

import java.util.List;

public interface OMQueryBuilderFactory {

  OMQueryBuilder matchNoneQuery();

  OMQueryBuilder matchAllQuery();

  OMQueryBuilder boolQuery();

  OMQueryBuilder termQuery(String field, Object value);

  OMQueryBuilder termsQuery(String field, List<Object> values);

  OMQueryBuilder matchQuery(String field, Object value);

  OMQueryBuilder multiMatchQuery(Object value, String... fields);

  OMQueryBuilder rangeQuery(String field);

  OMRangeQueryBuilder range(String field);

  OMQueryBuilder existsQuery(String field);

  OMQueryBuilder prefixQuery(String field, String prefix);

  OMQueryBuilder wildcardQuery(String field, String wildcard);

  OMQueryBuilder fuzzyQuery(String field, String value);

  OMQueryBuilder regexpQuery(String field, String regexp);

  OMQueryBuilder queryStringQuery(String queryString);

  OMQueryBuilder simpleQueryStringQuery(String queryString);

  OMQueryBuilder nestedQuery(String path, OMQueryBuilder query, String scoreMode);

  OMFunctionScoreQueryBuilder functionScore();

  OMFunctionScoreQueryBuilder functionScore(OMQueryBuilder query);

  OMQueryBuilder constantScoreQuery(OMQueryBuilder query);

  OMQueryBuilder disMaxQuery();

  OMAggregationBuilder aggregation(String name, String type);

  OMSearchSourceBuilder searchSource();

  OMHighlightBuilder highlight();
}

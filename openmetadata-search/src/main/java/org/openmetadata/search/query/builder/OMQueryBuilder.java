package org.openmetadata.search.query.builder;

import java.util.List;

public interface OMQueryBuilder {

  boolean isEmpty();

  boolean isMatchNone();

  boolean isMatchAll();

  OMQueryBuilder must(List<OMQueryBuilder> queries);

  OMQueryBuilder should(List<OMQueryBuilder> queries);

  OMQueryBuilder mustNot(List<OMQueryBuilder> queries);

  OMQueryBuilder must(OMQueryBuilder query);

  OMQueryBuilder should(OMQueryBuilder query);

  OMQueryBuilder mustNot(OMQueryBuilder query);

  boolean hasClauses();

  OMQueryBuilder matchQuery(String field, Object value);

  OMQueryBuilder multiMatchQuery(Object value, String... fields);

  OMQueryBuilder termQuery(String field, Object value);

  OMQueryBuilder termsQuery(String field, List<Object> values);

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

  OMQueryBuilder boolQuery();

  OMFunctionScoreQueryBuilder functionScore();

  OMQueryBuilder constantScoreQuery(OMQueryBuilder query);

  OMQueryBuilder disMaxQuery();

  OMQueryBuilder boost(float boost);

  OMQueryBuilder minimumShouldMatch(String minimumShouldMatch);

  <T> T build(Class<T> targetType);
}

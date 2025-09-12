package org.openmetadata.search.query.builder.opensearch;

import java.util.List;
import org.openmetadata.search.query.builder.OMAggregationBuilder;
import org.openmetadata.search.query.builder.OMFunctionScoreQueryBuilder;
import org.openmetadata.search.query.builder.OMHighlightBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilderFactory;
import org.openmetadata.search.query.builder.OMRangeQueryBuilder;
import org.openmetadata.search.query.builder.OMSearchSourceBuilder;

public class OpenSearchQueryBuilderFactory implements OMQueryBuilderFactory {

  @Override
  public OMQueryBuilder matchNoneQuery() {
    // Implementation similar to Elasticsearch but using OpenSearch classes
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder matchAllQuery() {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder boolQuery() {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder termQuery(String field, Object value) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder termsQuery(String field, List<Object> values) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder matchQuery(String field, Object value) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder multiMatchQuery(Object value, String... fields) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder rangeQuery(String field) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMRangeQueryBuilder range(String field) {
    return new OpenSearchRangeQueryBuilder(field);
  }

  @Override
  public OMQueryBuilder existsQuery(String field) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder prefixQuery(String field, String prefix) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder wildcardQuery(String field, String wildcard) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder fuzzyQuery(String field, String value) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder regexpQuery(String field, String regexp) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder queryStringQuery(String queryString) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder simpleQueryStringQuery(String queryString) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder nestedQuery(String path, OMQueryBuilder query, String scoreMode) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMFunctionScoreQueryBuilder functionScore() {
    return new OpenSearchFunctionScoreQueryBuilder();
  }

  @Override
  public OMFunctionScoreQueryBuilder functionScore(OMQueryBuilder query) {
    return new OpenSearchFunctionScoreQueryBuilder();
  }

  @Override
  public OMQueryBuilder constantScoreQuery(OMQueryBuilder query) {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMQueryBuilder disMaxQuery() {
    return new OpenSearchQueryBuilder();
  }

  @Override
  public OMAggregationBuilder aggregation(String name, String type) {
    return new OpenSearchAggregationBuilder();
  }

  @Override
  public OMSearchSourceBuilder searchSource() {
    return new OpenSearchSearchSourceBuilder();
  }

  @Override
  public OMHighlightBuilder highlight() {
    return new OpenSearchHighlightBuilder();
  }
}

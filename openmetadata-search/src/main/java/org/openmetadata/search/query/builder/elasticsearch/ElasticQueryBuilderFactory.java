package org.openmetadata.search.query.builder.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.query_dsl.QueryBuilders;
import java.util.List;
import org.openmetadata.search.query.builder.OMAggregationBuilder;
import org.openmetadata.search.query.builder.OMFunctionScoreQueryBuilder;
import org.openmetadata.search.query.builder.OMHighlightBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilderFactory;
import org.openmetadata.search.query.builder.OMRangeQueryBuilder;
import org.openmetadata.search.query.builder.OMSearchSourceBuilder;

public class ElasticQueryBuilderFactory implements OMQueryBuilderFactory {

  @Override
  public OMQueryBuilder matchNoneQuery() {
    return new ElasticQueryBuilder(
        QueryBuilders.bool()
            .mustNot(QueryBuilders.matchAll().build()._toQuery())
            .build()
            ._toQuery());
  }

  @Override
  public OMQueryBuilder matchAllQuery() {
    return new ElasticQueryBuilder(QueryBuilders.matchAll().build()._toQuery());
  }

  @Override
  public OMQueryBuilder boolQuery() {
    return new ElasticQueryBuilder(QueryBuilders.bool().build()._toQuery());
  }

  @Override
  public OMQueryBuilder termQuery(String field, Object value) {
    return new ElasticQueryBuilder(
        QueryBuilders.term().field(field).value(value.toString()).build()._toQuery());
  }

  @Override
  public OMQueryBuilder termsQuery(String field, List<Object> values) {
    List<String> stringValues = values.stream().map(Object::toString).toList();
    return new ElasticQueryBuilder(
        QueryBuilders.terms().field(field).terms(t -> t.value(stringValues)).build()._toQuery());
  }

  @Override
  public OMQueryBuilder matchQuery(String field, Object value) {
    return new ElasticQueryBuilder(
        QueryBuilders.match().field(field).query(value.toString()).build()._toQuery());
  }

  @Override
  public OMQueryBuilder multiMatchQuery(Object value, String... fields) {
    return new ElasticQueryBuilder(
        QueryBuilders.multiMatch()
            .query(value.toString())
            .fields(List.of(fields))
            .build()
            ._toQuery());
  }

  @Override
  public OMQueryBuilder rangeQuery(String field) {
    return new ElasticQueryBuilder(QueryBuilders.range().field(field).build()._toQuery());
  }

  @Override
  public OMRangeQueryBuilder range(String field) {
    return new ElasticRangeQueryBuilder(field);
  }

  @Override
  public OMQueryBuilder existsQuery(String field) {
    return new ElasticQueryBuilder(QueryBuilders.exists().field(field).build()._toQuery());
  }

  @Override
  public OMQueryBuilder prefixQuery(String field, String prefix) {
    return new ElasticQueryBuilder(
        QueryBuilders.prefix().field(field).value(prefix).build()._toQuery());
  }

  @Override
  public OMQueryBuilder wildcardQuery(String field, String wildcard) {
    return new ElasticQueryBuilder(
        QueryBuilders.wildcard().field(field).value(wildcard).build()._toQuery());
  }

  @Override
  public OMQueryBuilder fuzzyQuery(String field, String value) {
    return new ElasticQueryBuilder(
        QueryBuilders.fuzzy().field(field).value(value).build()._toQuery());
  }

  @Override
  public OMQueryBuilder regexpQuery(String field, String regexp) {
    return new ElasticQueryBuilder(
        QueryBuilders.regexp().field(field).value(regexp).build()._toQuery());
  }

  @Override
  public OMQueryBuilder queryStringQuery(String queryString) {
    return new ElasticQueryBuilder(
        QueryBuilders.queryString().query(queryString).build()._toQuery());
  }

  @Override
  public OMQueryBuilder simpleQueryStringQuery(String queryString) {
    return new ElasticQueryBuilder(
        QueryBuilders.simpleQueryString().query(queryString).build()._toQuery());
  }

  @Override
  public OMQueryBuilder nestedQuery(String path, OMQueryBuilder query, String scoreMode) {
    ElasticQueryBuilder elasticQuery = (ElasticQueryBuilder) query;
    return new ElasticQueryBuilder(
        QueryBuilders.nested()
            .path(path)
            .query(
                elasticQuery.build(
                    es.co.elastic.clients.elasticsearch._types.query_dsl.Query.class))
            .build()
            ._toQuery());
  }

  @Override
  public OMFunctionScoreQueryBuilder functionScore() {
    return new ElasticFunctionScoreQueryBuilder();
  }

  @Override
  public OMFunctionScoreQueryBuilder functionScore(OMQueryBuilder query) {
    ElasticFunctionScoreQueryBuilder builder = new ElasticFunctionScoreQueryBuilder();
    return builder.query(query);
  }

  @Override
  public OMQueryBuilder constantScoreQuery(OMQueryBuilder query) {
    ElasticQueryBuilder elasticQuery = (ElasticQueryBuilder) query;
    return new ElasticQueryBuilder(
        QueryBuilders.constantScore()
            .filter(
                elasticQuery.build(
                    es.co.elastic.clients.elasticsearch._types.query_dsl.Query.class))
            .build()
            ._toQuery());
  }

  @Override
  public OMQueryBuilder disMaxQuery() {
    return new ElasticQueryBuilder(QueryBuilders.disMax().build()._toQuery());
  }

  @Override
  public OMAggregationBuilder aggregation(String name, String type) {
    return new ElasticAggregationBuilder();
  }

  @Override
  public OMSearchSourceBuilder searchSource() {
    return new ElasticSearchSourceBuilder();
  }

  @Override
  public OMHighlightBuilder highlight() {
    return new ElasticHighlightBuilder();
  }
}

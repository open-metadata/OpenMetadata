package org.openmetadata.service.search.elasticsearch.queries;

import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import org.openmetadata.service.search.queries.OMQueryBuilder;


public class ElasticQueryBuilder implements OMQueryBuilder {
  private BoolQueryBuilder boolQuery;

  public ElasticQueryBuilder() {
    this.boolQuery = QueryBuilders.boolQuery();
  }

  public ElasticQueryBuilder(BoolQueryBuilder boolQuery) {
    this.boolQuery = boolQuery;
  }

  @Override
  public OMQueryBuilder boolQuery() {
    return new ElasticQueryBuilder(); // Create and return a new instance
  }
  @Override
  public OMQueryBuilder must(OMQueryBuilder query) {
    if (query instanceof ElasticQueryBuilder) {
      boolQuery.must(((ElasticQueryBuilder) query).boolQuery);
    }
    return this;
  }

  @Override
  public OMQueryBuilder should(OMQueryBuilder query) {
    if (query instanceof ElasticQueryBuilder) {
      boolQuery.should(((ElasticQueryBuilder) query).boolQuery);
    }
    return this;
  }

  @Override
  public OMQueryBuilder mustNot(OMQueryBuilder query) {
    if (query instanceof ElasticQueryBuilder) {
      boolQuery.mustNot(((ElasticQueryBuilder) query).boolQuery);
    }
    return this;
  }

  @Override
  public OMQueryBuilder termQuery(String field, String value) {
    BoolQueryBuilder subQuery = QueryBuilders.boolQuery().must(QueryBuilders.termQuery(field, value));
    return new ElasticQueryBuilder(subQuery);
  }

  @Override
  public OMQueryBuilder existsQuery(String field) {
    BoolQueryBuilder subQuery = QueryBuilders.boolQuery().must(QueryBuilders.existsQuery(field));
    return new ElasticQueryBuilder(subQuery);
  }

  @Override
  public OMQueryBuilder minimumShouldMatch(int count) {
    boolQuery.minimumShouldMatch(count);
    return this;
  }

  @Override
  public Object build() {
    return boolQuery;
  }
}
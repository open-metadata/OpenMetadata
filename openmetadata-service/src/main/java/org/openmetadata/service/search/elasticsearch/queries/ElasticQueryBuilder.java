package org.openmetadata.service.search.elasticsearch.queries;

import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.MatchAllQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import java.util.List;
import org.openmetadata.service.search.queries.OMQueryBuilder;

public class ElasticQueryBuilder implements OMQueryBuilder {
  private QueryBuilder query;

  public ElasticQueryBuilder() {
    // Default constructor
  }

  @Override
  public boolean isEmpty() {
    return query == null;
  }

  @Override
  public boolean isMatchNone() {
    // Check if the query is a bool query with must_not match_all
    if (query instanceof BoolQueryBuilder boolQuery) {
      return boolQuery.must().isEmpty()
          && boolQuery.should().isEmpty()
          && boolQuery.mustNot().size() == 1
          && boolQuery.mustNot().get(0) instanceof MatchAllQueryBuilder;
    }
    return false;
  }

  @Override
  public boolean isMatchAll() {
    return query instanceof MatchAllQueryBuilder;
  }

  @Override
  public OMQueryBuilder must(List<OMQueryBuilder> queries) {
    BoolQueryBuilder boolQuery = getOrCreateBoolQuery();
    for (OMQueryBuilder q : queries) {
      ElasticQueryBuilder eqb = (ElasticQueryBuilder) q;
      boolQuery.must(eqb.build());
    }
    this.query = boolQuery;
    return this;
  }

  @Override
  public OMQueryBuilder should(List<OMQueryBuilder> queries) {
    BoolQueryBuilder boolQuery = getOrCreateBoolQuery();
    for (OMQueryBuilder q : queries) {
      ElasticQueryBuilder eqb = (ElasticQueryBuilder) q;
      boolQuery.should(eqb.build());
    }
    this.query = boolQuery;
    return this;
  }

  @Override
  public OMQueryBuilder mustNot(List<OMQueryBuilder> queries) {
    BoolQueryBuilder boolQuery = getOrCreateBoolQuery();
    for (OMQueryBuilder q : queries) {
      ElasticQueryBuilder eqb = (ElasticQueryBuilder) q;
      boolQuery.mustNot(eqb.build());
    }
    this.query = boolQuery;
    return this;
  }

  @Override
  public OMQueryBuilder must(OMQueryBuilder query) {
    return must(List.of(query));
  }

  @Override
  public OMQueryBuilder should(OMQueryBuilder query) {
    return should(List.of(query));
  }

  @Override
  public boolean hasClauses() {
    if (query instanceof BoolQueryBuilder boolQuery) {
      return !boolQuery.must().isEmpty()
          || !boolQuery.should().isEmpty()
          || !boolQuery.mustNot().isEmpty();
    }
    return query != null;
  }

  public QueryBuilder build() {
    return query;
  }

  public ElasticQueryBuilder setQuery(QueryBuilder query) {
    this.query = query;
    return this;
  }

  // Helper methods

  public ElasticQueryBuilder matchNoneQuery() {
    this.query = QueryBuilders.boolQuery().mustNot(QueryBuilders.matchAllQuery());
    return this;
  }

  public ElasticQueryBuilder matchAllQuery() {
    this.query = QueryBuilders.matchAllQuery();
    return this;
  }

  public ElasticQueryBuilder boolQuery() {
    this.query = QueryBuilders.boolQuery();
    return this;
  }

  public ElasticQueryBuilder termQuery(String field, String value) {
    this.query = QueryBuilders.termQuery(field, value);
    return this;
  }

  public ElasticQueryBuilder termsQuery(String field, List<String> values) {
    this.query = QueryBuilders.termsQuery(field, values);
    return this;
  }

  public ElasticQueryBuilder existsQuery(String field) {
    this.query = QueryBuilders.existsQuery(field);
    return this;
  }

  private BoolQueryBuilder getOrCreateBoolQuery() {
    if (query instanceof BoolQueryBuilder) {
      return (BoolQueryBuilder) query;
    } else {
      BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
      if (query != null) {
        boolQuery.must(query);
      }
      return boolQuery;
    }
  }
}

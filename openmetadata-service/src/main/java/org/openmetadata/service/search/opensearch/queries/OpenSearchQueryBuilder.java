package org.openmetadata.service.search.opensearch.queries;

import java.util.List;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import os.org.opensearch.index.query.BoolQueryBuilder;
import os.org.opensearch.index.query.MatchAllQueryBuilder;
import os.org.opensearch.index.query.QueryBuilder;
import os.org.opensearch.index.query.QueryBuilders;

public class OpenSearchQueryBuilder implements OMQueryBuilder {
  private QueryBuilder query;

  public OpenSearchQueryBuilder() {
    // Default constructor
  }

  public OpenSearchQueryBuilder(QueryBuilder query) {
    this.query = query;
  }

  @Override
  public boolean isEmpty() {
    return query == null;
  }

  @Override
  public boolean isMatchNone() {
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
      OpenSearchQueryBuilder eqb = (OpenSearchQueryBuilder) q;
      boolQuery.must(eqb.build());
    }
    this.query = boolQuery;
    return this;
  }

  @Override
  public OMQueryBuilder should(List<OMQueryBuilder> queries) {
    BoolQueryBuilder boolQuery = getOrCreateBoolQuery();
    for (OMQueryBuilder q : queries) {
      OpenSearchQueryBuilder eqb = (OpenSearchQueryBuilder) q;
      boolQuery.should(eqb.build());
    }
    this.query = boolQuery;
    return this;
  }

  @Override
  public OMQueryBuilder mustNot(List<OMQueryBuilder> queries) {
    BoolQueryBuilder boolQuery = getOrCreateBoolQuery();
    for (OMQueryBuilder q : queries) {
      OpenSearchQueryBuilder eqb = (OpenSearchQueryBuilder) q;
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

  public OpenSearchQueryBuilder setQuery(QueryBuilder query) {
    this.query = query;
    return this;
  }

  // Helper methods

  public OpenSearchQueryBuilder matchNoneQuery() {
    this.query = QueryBuilders.boolQuery().mustNot(QueryBuilders.matchAllQuery());
    return this;
  }

  public OpenSearchQueryBuilder matchAllQuery() {
    this.query = QueryBuilders.matchAllQuery();
    return this;
  }

  public OpenSearchQueryBuilder boolQuery() {
    this.query = QueryBuilders.boolQuery();
    return this;
  }

  public OpenSearchQueryBuilder termQuery(String field, String value) {
    this.query = QueryBuilders.termQuery(field, value);
    return this;
  }

  public OpenSearchQueryBuilder termsQuery(String field, List<String> values) {
    this.query = QueryBuilders.termsQuery(field, values);
    return this;
  }

  public OpenSearchQueryBuilder existsQuery(String field) {
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

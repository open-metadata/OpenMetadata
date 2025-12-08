package org.openmetadata.service.search.opensearch.queries;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import os.org.opensearch.client.opensearch._types.query_dsl.BoolQuery;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

public class OpenSearchQueryBuilder implements OMQueryBuilder {
  private Query query;

  public OpenSearchQueryBuilder() {
    // Default constructor
  }

  public OpenSearchQueryBuilder(Query query) {
    this.query = query;
  }

  @Override
  public boolean isEmpty() {
    return query == null;
  }

  @Override
  public boolean isMatchNone() {
    if (query != null && query.isBool()) {
      BoolQuery boolQuery = query.bool();
      return boolQuery.must().isEmpty()
          && boolQuery.should().isEmpty()
          && boolQuery.mustNot().size() == 1
          && boolQuery.mustNot().get(0).isMatchAll();
    }
    return false;
  }

  @Override
  public boolean isMatchAll() {
    return query != null && query.isMatchAll();
  }

  @Override
  public OMQueryBuilder must(List<OMQueryBuilder> queries) {
    List<Query> queryList = new ArrayList<>();
    for (OMQueryBuilder q : queries) {
      OpenSearchQueryBuilder osqb = (OpenSearchQueryBuilder) q;
      if (osqb.query != null) {
        queryList.add(osqb.query);
      }
    }

    if (!queryList.isEmpty()) {
      BoolQuery.Builder boolBuilder = getOrCreateBoolQueryBuilder();
      boolBuilder.must(queryList);
      this.query = Query.of(q -> q.bool(boolBuilder.build()));
    }
    return this;
  }

  @Override
  public OMQueryBuilder should(List<OMQueryBuilder> queries) {
    List<Query> queryList = new ArrayList<>();
    for (OMQueryBuilder q : queries) {
      OpenSearchQueryBuilder osqb = (OpenSearchQueryBuilder) q;
      if (osqb.query != null) {
        queryList.add(osqb.query);
      }
    }

    if (!queryList.isEmpty()) {
      BoolQuery.Builder boolBuilder = getOrCreateBoolQueryBuilder();
      boolBuilder.should(queryList);
      this.query = Query.of(q -> q.bool(boolBuilder.build()));
    }
    return this;
  }

  @Override
  public OMQueryBuilder mustNot(List<OMQueryBuilder> queries) {
    List<Query> queryList = new ArrayList<>();
    for (OMQueryBuilder q : queries) {
      OpenSearchQueryBuilder osqb = (OpenSearchQueryBuilder) q;
      if (osqb.query != null) {
        queryList.add(osqb.query);
      }
    }

    if (!queryList.isEmpty()) {
      BoolQuery.Builder boolBuilder = getOrCreateBoolQueryBuilder();
      boolBuilder.mustNot(queryList);
      this.query = Query.of(q -> q.bool(boolBuilder.build()));
    }
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
    if (query != null && query.isBool()) {
      BoolQuery boolQuery = query.bool();
      return !boolQuery.must().isEmpty()
          || !boolQuery.should().isEmpty()
          || !boolQuery.mustNot().isEmpty();
    }
    return query != null;
  }

  public Query build() {
    return query;
  }

  public Query buildV2() {
    return query;
  }

  public OpenSearchQueryBuilder setQuery(Query query) {
    this.query = query;
    return this;
  }

  // Helper methods

  public OpenSearchQueryBuilder matchNoneQuery() {
    this.query = Query.of(q -> q.bool(b -> b.mustNot(mn -> mn.matchAll(m -> m))));
    return this;
  }

  public OpenSearchQueryBuilder matchAllQuery() {
    this.query = Query.of(q -> q.matchAll(m -> m));
    return this;
  }

  public OpenSearchQueryBuilder boolQuery() {
    this.query = Query.of(q -> q.bool(b -> b));
    return this;
  }

  public OpenSearchQueryBuilder termQuery(String field, String value) {
    this.query = Query.of(q -> q.term(t -> t.field(field).value(v -> v.stringValue(value))));
    return this;
  }

  public OpenSearchQueryBuilder termsQuery(String field, List<String> values) {
    this.query =
        Query.of(
            q ->
                q.terms(
                    t ->
                        t.field(field)
                            .terms(
                                tv ->
                                    tv.value(
                                        values.stream()
                                            .map(
                                                os.org.opensearch.client.opensearch._types
                                                        .FieldValue
                                                    ::of)
                                            .toList()))));
    return this;
  }

  public OpenSearchQueryBuilder existsQuery(String field) {
    this.query = Query.of(q -> q.exists(e -> e.field(field)));
    return this;
  }

  private BoolQuery.Builder getOrCreateBoolQueryBuilder() {
    if (query != null && query.isBool()) {
      // Create a new builder with existing clauses
      BoolQuery existingBool = query.bool();
      BoolQuery.Builder builder = new BoolQuery.Builder();
      builder.must(existingBool.must());
      builder.should(existingBool.should());
      builder.mustNot(existingBool.mustNot());
      builder.filter(existingBool.filter());
      if (existingBool.minimumShouldMatch() != null) {
        builder.minimumShouldMatch(existingBool.minimumShouldMatch());
      }
      return builder;
    } else {
      BoolQuery.Builder boolBuilder = new BoolQuery.Builder();
      if (query != null) {
        boolBuilder.must(query);
      }
      return boolBuilder;
    }
  }
}

package org.openmetadata.service.search.elasticsearch.queries;

import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.service.search.queries.OMQueryBuilder;

public class ElasticQueryBuilder implements OMQueryBuilder {
  private Query query;

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
      ElasticQueryBuilder eqb = (ElasticQueryBuilder) q;
      if (eqb.query != null) {
        queryList.add(eqb.query);
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
      ElasticQueryBuilder eqb = (ElasticQueryBuilder) q;
      if (eqb.query != null) {
        queryList.add(eqb.query);
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
      ElasticQueryBuilder eqb = (ElasticQueryBuilder) q;
      if (eqb.query != null) {
        queryList.add(eqb.query);
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

  public ElasticQueryBuilder setQuery(Query query) {
    this.query = query;
    return this;
  }

  // Helper methods

  public ElasticQueryBuilder matchNoneQuery() {
    this.query = Query.of(q -> q.bool(b -> b.mustNot(mn -> mn.matchAll(m -> m))));
    return this;
  }

  public ElasticQueryBuilder matchAllQuery() {
    this.query = Query.of(q -> q.matchAll(m -> m));
    return this;
  }

  public ElasticQueryBuilder boolQuery() {
    this.query = Query.of(q -> q.bool(b -> b));
    return this;
  }

  public ElasticQueryBuilder termQuery(String field, String value) {
    this.query = Query.of(q -> q.term(t -> t.field(field).value(value)));
    return this;
  }

  public ElasticQueryBuilder termsQuery(String field, List<String> values) {
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
                                                es.co.elastic.clients.elasticsearch._types
                                                        .FieldValue
                                                    ::of)
                                            .toList()))));
    return this;
  }

  public ElasticQueryBuilder existsQuery(String field) {
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

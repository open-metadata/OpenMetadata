package org.openmetadata.search.query.builder.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch._types.query_dsl.QueryBuilders;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.query.builder.OMFunctionScoreQueryBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilder;
import org.openmetadata.search.query.builder.OMRangeQueryBuilder;

@Slf4j
public class ElasticQueryBuilder implements OMQueryBuilder {
  private Query query;

  public ElasticQueryBuilder() {
    // Default constructor
  }

  public ElasticQueryBuilder(Query query) {
    this.query = query;
  }

  @Override
  public boolean isEmpty() {
    return query == null;
  }

  @Override
  public boolean isMatchNone() {
    if (query != null && query.bool() != null) {
      BoolQuery boolQuery = query.bool();
      return boolQuery.must().isEmpty()
          && boolQuery.should().isEmpty()
          && boolQuery.mustNot().size() == 1
          && boolQuery.mustNot().get(0).matchAll() != null;
    }
    return false;
  }

  @Override
  public boolean isMatchAll() {
    return query != null && query.matchAll() != null;
  }

  @Override
  public OMQueryBuilder must(List<OMQueryBuilder> queries) {
    BoolQuery.Builder boolBuilder = getOrCreateBoolQuery();
    for (OMQueryBuilder q : queries) {
      ElasticQueryBuilder eqb = (ElasticQueryBuilder) q;
      boolBuilder.must(eqb.build(Query.class));
    }
    this.query = boolBuilder.build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder should(List<OMQueryBuilder> queries) {
    BoolQuery.Builder boolBuilder = getOrCreateBoolQuery();
    for (OMQueryBuilder q : queries) {
      ElasticQueryBuilder eqb = (ElasticQueryBuilder) q;
      boolBuilder.should(eqb.build(Query.class));
    }
    this.query = boolBuilder.build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder mustNot(List<OMQueryBuilder> queries) {
    BoolQuery.Builder boolBuilder = getOrCreateBoolQuery();
    for (OMQueryBuilder q : queries) {
      ElasticQueryBuilder eqb = (ElasticQueryBuilder) q;
      boolBuilder.mustNot(eqb.build(Query.class));
    }
    this.query = boolBuilder.build()._toQuery();
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
  public OMQueryBuilder mustNot(OMQueryBuilder query) {
    return mustNot(List.of(query));
  }

  @Override
  public boolean hasClauses() {
    if (query != null && query.bool() != null) {
      BoolQuery boolQuery = query.bool();
      return !boolQuery.must().isEmpty()
          || !boolQuery.should().isEmpty()
          || !boolQuery.mustNot().isEmpty();
    }
    return query != null;
  }

  @Override
  public OMQueryBuilder matchQuery(String field, Object value) {
    this.query = QueryBuilders.match().field(field).query(value.toString()).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder multiMatchQuery(Object value, String... fields) {
    this.query =
        QueryBuilders.multiMatch()
            .query(value.toString())
            .fields(List.of(fields))
            .build()
            ._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder termQuery(String field, Object value) {
    this.query = QueryBuilders.term().field(field).value(value.toString()).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder termsQuery(String field, List<Object> values) {
    List<String> stringValues = values.stream().map(Object::toString).toList();
    this.query =
        QueryBuilders.terms().field(field).terms(t -> t.value(stringValues)).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder rangeQuery(String field) {
    this.query = QueryBuilders.range().field(field).build()._toQuery();
    return this;
  }

  @Override
  public OMRangeQueryBuilder range(String field) {
    return new ElasticRangeQueryBuilder(field);
  }

  @Override
  public OMQueryBuilder existsQuery(String field) {
    this.query = QueryBuilders.exists().field(field).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder prefixQuery(String field, String prefix) {
    this.query = QueryBuilders.prefix().field(field).value(prefix).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder wildcardQuery(String field, String wildcard) {
    this.query = QueryBuilders.wildcard().field(field).value(wildcard).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder fuzzyQuery(String field, String value) {
    this.query = QueryBuilders.fuzzy().field(field).value(value).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder regexpQuery(String field, String regexp) {
    this.query = QueryBuilders.regexp().field(field).value(regexp).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder queryStringQuery(String queryString) {
    this.query = QueryBuilders.queryString().query(queryString).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder simpleQueryStringQuery(String queryString) {
    this.query = QueryBuilders.simpleQueryString().query(queryString).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder nestedQuery(String path, OMQueryBuilder query, String scoreMode) {
    ElasticQueryBuilder elasticQuery = (ElasticQueryBuilder) query;
    this.query =
        QueryBuilders.nested().path(path).query(elasticQuery.build(Query.class)).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder boolQuery() {
    this.query = QueryBuilders.bool().build()._toQuery();
    return this;
  }

  @Override
  public OMFunctionScoreQueryBuilder functionScore() {
    return new ElasticFunctionScoreQueryBuilder();
  }

  @Override
  public OMQueryBuilder constantScoreQuery(OMQueryBuilder query) {
    ElasticQueryBuilder elasticQuery = (ElasticQueryBuilder) query;
    this.query =
        QueryBuilders.constantScore().filter(elasticQuery.build(Query.class)).build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder disMaxQuery() {
    this.query = QueryBuilders.disMax().build()._toQuery();
    return this;
  }

  @Override
  public OMQueryBuilder boost(float boost) {
    if (query != null) {
      // Note: boost handling would need to be implemented per query type
      log.warn("Boost modification not yet implemented for existing queries");
    }
    return this;
  }

  @Override
  public OMQueryBuilder minimumShouldMatch(String minimumShouldMatch) {
    if (query != null && query.bool() != null) {
      // Would need to rebuild the bool query with minimum should match
      log.warn("Minimum should match modification not yet implemented for existing bool queries");
    }
    return this;
  }

  @Override
  @SuppressWarnings("unchecked")
  public <T> T build(Class<T> targetType) {
    if (targetType.isAssignableFrom(Query.class)) {
      return (T) query;
    }
    throw new IllegalArgumentException("Unsupported target type: " + targetType);
  }

  private BoolQuery.Builder getOrCreateBoolQuery() {
    if (query != null && query.bool() != null) {
      BoolQuery existing = query.bool();
      return new BoolQuery.Builder()
          .must(existing.must())
          .should(existing.should())
          .mustNot(existing.mustNot())
          .filter(existing.filter());
    } else {
      BoolQuery.Builder builder = new BoolQuery.Builder();
      if (query != null) {
        builder.must(query);
      }
      return builder;
    }
  }
}

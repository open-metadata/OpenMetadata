package org.openmetadata.service.search.elasticsearch.queries;

import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import java.util.List;
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
  public OMQueryBuilder must(List<OMQueryBuilder> queries) {
    for (OMQueryBuilder query : queries) {
      if (query instanceof ElasticQueryBuilder) {
        boolQuery.must(((ElasticQueryBuilder) query).boolQuery);
      }
    }
    return this;
  }

  @Override
  public OMQueryBuilder must(OMQueryBuilder query) {
    if (query instanceof ElasticQueryBuilder) {
      boolQuery.must(((ElasticQueryBuilder) query).boolQuery);
    }
    return this;
  }

  @Override
  public OMQueryBuilder should(List<OMQueryBuilder> queries) {
    for (OMQueryBuilder query : queries) {
      if (query instanceof ElasticQueryBuilder) {
        boolQuery.should(((ElasticQueryBuilder) query).boolQuery);
      }
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
    boolQuery.must(QueryBuilders.termQuery(field, value));
    return this;
  }

  @Override
  public OMQueryBuilder existsQuery(String field) {
    boolQuery.must(QueryBuilders.existsQuery(field));
    return this;
  }

  @Override
  public OMQueryBuilder minimumShouldMatch(int count) {
    boolQuery.minimumShouldMatch(count);
    return this;
  }

  @Override
  public OMQueryBuilder innerQuery(OMQueryBuilder subQuery) {
    if (subQuery instanceof ElasticQueryBuilder) {
      boolQuery.filter(
          ((ElasticQueryBuilder) subQuery).boolQuery); // Combine using filter to avoid bool layer
    }
    return this;
  }

  @Override
  public boolean isEmpty() {
    return boolQuery.must().isEmpty()
        && boolQuery.should().isEmpty()
        && boolQuery.mustNot().isEmpty();
  }

  @Override
  public Object build() {
    return boolQuery;
  }
}

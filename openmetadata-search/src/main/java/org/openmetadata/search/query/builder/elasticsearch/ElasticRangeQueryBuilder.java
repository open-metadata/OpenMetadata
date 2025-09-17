package org.openmetadata.search.query.builder.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch._types.query_dsl.RangeQuery;
import org.openmetadata.search.query.builder.OMQueryBuilder;
import org.openmetadata.search.query.builder.OMRangeQueryBuilder;

public class ElasticRangeQueryBuilder implements OMRangeQueryBuilder {
  private final RangeQuery.Builder rangeBuilder;
  private final String field;

  public ElasticRangeQueryBuilder(String field) {
    this.field = field;
    this.rangeBuilder = new RangeQuery.Builder();
    this.rangeBuilder.field(field);
  }

  @Override
  public OMRangeQueryBuilder gt(Object value) {
    rangeBuilder.gt(FieldValue.of(value.toString()));
    return this;
  }

  @Override
  public OMRangeQueryBuilder gte(Object value) {
    rangeBuilder.gte(FieldValue.of(value.toString()));
    return this;
  }

  @Override
  public OMRangeQueryBuilder lt(Object value) {
    rangeBuilder.lt(FieldValue.of(value.toString()));
    return this;
  }

  @Override
  public OMRangeQueryBuilder lte(Object value) {
    rangeBuilder.lte(FieldValue.of(value.toString()));
    return this;
  }

  @Override
  public OMRangeQueryBuilder from(Object value) {
    return gte(value);
  }

  @Override
  public OMRangeQueryBuilder to(Object value) {
    return lte(value);
  }

  @Override
  public OMRangeQueryBuilder includeLower(boolean includeLower) {
    // Elasticsearch doesn't have direct includeLower/includeUpper
    // This would need to be handled by switching between gt/gte and lt/lte
    return this;
  }

  @Override
  public OMRangeQueryBuilder includeUpper(boolean includeUpper) {
    // Elasticsearch doesn't have direct includeLower/includeUpper
    // This would need to be handled by switching between gt/gte and lt/lte
    return this;
  }

  @Override
  public OMRangeQueryBuilder format(String format) {
    rangeBuilder.format(format);
    return this;
  }

  @Override
  public OMRangeQueryBuilder timeZone(String timeZone) {
    rangeBuilder.timeZone(timeZone);
    return this;
  }

  @Override
  public OMQueryBuilder build() {
    Query query = rangeBuilder.build()._toQuery();
    return new ElasticQueryBuilder(query);
  }
}

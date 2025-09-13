package org.openmetadata.search.query.builder.opensearch;

import org.openmetadata.search.query.builder.OMQueryBuilder;
import org.openmetadata.search.query.builder.OMRangeQueryBuilder;

public class OpenSearchRangeQueryBuilder implements OMRangeQueryBuilder {
  private final String field;

  public OpenSearchRangeQueryBuilder(String field) {
    this.field = field;
  }

  @Override
  public OMRangeQueryBuilder gt(Object value) {
    return this;
  }

  @Override
  public OMRangeQueryBuilder gte(Object value) {
    return this;
  }

  @Override
  public OMRangeQueryBuilder lt(Object value) {
    return this;
  }

  @Override
  public OMRangeQueryBuilder lte(Object value) {
    return this;
  }

  @Override
  public OMRangeQueryBuilder from(Object value) {
    return this;
  }

  @Override
  public OMRangeQueryBuilder to(Object value) {
    return this;
  }

  @Override
  public OMRangeQueryBuilder includeLower(boolean includeLower) {
    return this;
  }

  @Override
  public OMRangeQueryBuilder includeUpper(boolean includeUpper) {
    return this;
  }

  @Override
  public OMRangeQueryBuilder format(String format) {
    return this;
  }

  @Override
  public OMRangeQueryBuilder timeZone(String timeZone) {
    return this;
  }

  @Override
  public OMQueryBuilder build() {
    return new OpenSearchQueryBuilder();
  }
}

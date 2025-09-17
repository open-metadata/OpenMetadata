package org.openmetadata.search.query.builder;

public interface OMRangeQueryBuilder {

  OMRangeQueryBuilder gt(Object value);

  OMRangeQueryBuilder gte(Object value);

  OMRangeQueryBuilder lt(Object value);

  OMRangeQueryBuilder lte(Object value);

  OMRangeQueryBuilder from(Object value);

  OMRangeQueryBuilder to(Object value);

  OMRangeQueryBuilder includeLower(boolean includeLower);

  OMRangeQueryBuilder includeUpper(boolean includeUpper);

  OMRangeQueryBuilder format(String format);

  OMRangeQueryBuilder timeZone(String timeZone);

  OMQueryBuilder build();
}

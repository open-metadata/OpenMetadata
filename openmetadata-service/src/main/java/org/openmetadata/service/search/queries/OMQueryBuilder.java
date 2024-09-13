package org.openmetadata.service.search.queries;

import java.util.List;

public interface OMQueryBuilder {

  boolean isEmpty();

  boolean isMatchNone();

  boolean isMatchAll();

  OMQueryBuilder must(List<OMQueryBuilder> queries);

  OMQueryBuilder should(List<OMQueryBuilder> queries);

  OMQueryBuilder mustNot(List<OMQueryBuilder> queries);

  OMQueryBuilder must(OMQueryBuilder query);

  OMQueryBuilder should(OMQueryBuilder query);

  boolean hasClauses();
}

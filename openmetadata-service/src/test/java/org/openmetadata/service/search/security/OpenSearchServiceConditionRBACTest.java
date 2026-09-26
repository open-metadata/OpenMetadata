package org.openmetadata.service.search.security;

import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;

/** {@link AbstractServiceConditionRBACTest} against the OpenSearch query builder. */
class OpenSearchServiceConditionRBACTest extends AbstractServiceConditionRBACTest {

  @Override
  protected QueryBuilderFactory queryBuilderFactory() {
    return new OpenSearchQueryBuilderFactory();
  }

  @Override
  protected String serialize(OMQueryBuilder queryBuilder) {
    return ((OpenSearchQueryBuilder) queryBuilder).build().toJsonString();
  }
}

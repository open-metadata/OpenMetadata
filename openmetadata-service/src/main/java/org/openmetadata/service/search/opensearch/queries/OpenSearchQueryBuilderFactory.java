package org.openmetadata.service.search.opensearch.queries;

import java.util.List;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;

public class OpenSearchQueryBuilderFactory implements QueryBuilderFactory {

  @Override
  public OMQueryBuilder matchNoneQuery() {
    return new OpenSearchQueryBuilder().matchNoneQuery();
  }

  @Override
  public OMQueryBuilder matchAllQuery() {
    return new OpenSearchQueryBuilder().matchAllQuery();
  }

  @Override
  public OMQueryBuilder boolQuery() {
    return new OpenSearchQueryBuilder().boolQuery();
  }

  @Override
  public OMQueryBuilder termQuery(String field, String value) {
    return new OpenSearchQueryBuilder().termQuery(field, value);
  }

  @Override
  public OMQueryBuilder termsQuery(String field, List<String> values) {
    return new OpenSearchQueryBuilder().termsQuery(field, values);
  }

  @Override
  public OMQueryBuilder existsQuery(String field) {
    return new OpenSearchQueryBuilder().existsQuery(field);
  }
}

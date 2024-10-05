package org.openmetadata.service.search.queries;

import java.util.List;

public interface QueryBuilderFactory {

  OMQueryBuilder matchNoneQuery();

  OMQueryBuilder matchAllQuery();

  OMQueryBuilder boolQuery();

  OMQueryBuilder termQuery(String field, String value);

  OMQueryBuilder termsQuery(String field, List<String> values);

  OMQueryBuilder existsQuery(String field);
}

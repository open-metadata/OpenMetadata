package org.openmetadata.service.search.elasticsearch.queries;

import java.util.List;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;

public class ElasticQueryBuilderFactory implements QueryBuilderFactory {

  @Override
  public OMQueryBuilder matchNoneQuery() {
    return new ElasticQueryBuilder().matchNoneQuery();
  }

  @Override
  public OMQueryBuilder matchAllQuery() {
    return new ElasticQueryBuilder().matchAllQuery();
  }

  @Override
  public OMQueryBuilder boolQuery() {
    return new ElasticQueryBuilder().boolQuery();
  }

  @Override
  public OMQueryBuilder termQuery(String field, String value) {
    return new ElasticQueryBuilder().termQuery(field, value);
  }

  @Override
  public OMQueryBuilder termsQuery(String field, List<String> values) {
    return new ElasticQueryBuilder().termsQuery(field, values);
  }

  @Override
  public OMQueryBuilder existsQuery(String field) {
    return new ElasticQueryBuilder().existsQuery(field);
  }
}

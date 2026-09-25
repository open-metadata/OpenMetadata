package org.openmetadata.service.search.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;

/** {@link AbstractServiceConditionRBACTest} against the ElasticSearch query builder. */
class ElasticSearchServiceConditionRBACTest extends AbstractServiceConditionRBACTest {

  private static final JacksonJsonpMapper JSONP_MAPPER = new JacksonJsonpMapper(new ObjectMapper());

  @Override
  protected QueryBuilderFactory queryBuilderFactory() {
    return new ElasticQueryBuilderFactory();
  }

  @Override
  protected String serialize(OMQueryBuilder queryBuilder) {
    Query query = ((ElasticQueryBuilder) queryBuilder).build();
    StringWriter writer = new StringWriter();
    try (JsonGenerator generator = JSONP_MAPPER.jsonProvider().createGenerator(writer)) {
      query.serialize(generator, JSONP_MAPPER);
    }
    return writer.toString();
  }
}

package org.openmetadata.service.search.elasticsearch.queries;

import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.json.JsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.service.search.elasticsearch.ElasticSearchSourceBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.search.queries.SearchQueryDsl;

/** Renders Elasticsearch typed queries with the client's own JSON mapper. */
public final class ElasticQueryDsl implements SearchQueryDsl {

  private static final int FIRST_PAGE = 0;
  private static final int PAGE_SIZE = 10;

  private final JsonpMapper mapper;
  private final QueryBuilderFactory queryBuilderFactory = new ElasticQueryBuilderFactory();

  public ElasticQueryDsl(JsonpMapper mapper) {
    this.mapper = mapper;
  }

  @Override
  public QueryBuilderFactory queryBuilderFactory() {
    return queryBuilderFactory;
  }

  @Override
  public String toJson(OMQueryBuilder query) {
    return serialize(((ElasticQueryBuilder) query).build());
  }

  @Override
  public String dataAssetQueryJson(
      SearchSettings searchSettings, String indexName, String queryText) {
    Query query =
        new ElasticSearchSourceBuilderFactory(searchSettings)
            .buildDataAssetSearchBuilderV2(
                indexName, queryText, FIRST_PAGE, PAGE_SIZE, false, false)
            .query();
    return serialize(query);
  }

  private String serialize(Query query) {
    StringWriter writer = new StringWriter();
    try (JsonGenerator generator = mapper.jsonProvider().createGenerator(writer)) {
      query.serialize(generator, mapper);
    }
    return writer.toString();
  }
}

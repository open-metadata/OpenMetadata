package org.openmetadata.service.search.elasticsearch;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.json.JsonData;
import es.co.elastic.clients.json.JsonpMapper;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchManagementClient;

/**
 * ElasticSearch implementation of search management operations.
 * This class handles all search-related operations for ElasticSearch using the new Java API client.
 */
@Slf4j
public class ElasticSearchSearchManager implements SearchManagementClient {
  private final ElasticsearchClient client;
  private final boolean isClientAvailable;

  public ElasticSearchSearchManager(ElasticsearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    if (!isClientAvailable) {
      throw new IOException("Elasticsearch client is not available");
    }

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                    .query(
                        q ->
                            q.bool(
                                b ->
                                    b.must(
                                        m -> m.term(t -> t.field("sourceUrl").value(sourceUrl))))));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    String responseJson = serializeSearchResponse(response);
    return Response.status(OK).entity(responseJson).build();
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index, Boolean deleted)
      throws IOException {
    if (!isClientAvailable) {
      throw new IOException("Elasticsearch client is not available");
    }

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(Entity.getSearchRepository().getIndexOrAliasName(index))
                    .query(
                        q ->
                            q.bool(
                                b ->
                                    b.must(
                                            m ->
                                                m.wildcard(
                                                    w -> w.field(fieldName).value(fieldValue)))
                                        .filter(
                                            f -> f.term(t -> t.field("deleted").value(deleted))))));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    String responseJson = serializeSearchResponse(response);
    return Response.status(OK).entity(responseJson).build();
  }

  /**
   * Serializes a SearchResponse to JSON string.
   *
   * @param searchResponse the SearchResponse to serialize
   * @return JSON string representation of the response
   */
  private String serializeSearchResponse(SearchResponse<JsonData> searchResponse) {
    JsonpMapper jsonpMapper = client._transport().jsonpMapper();
    jakarta.json.spi.JsonProvider provider = jsonpMapper.jsonProvider();
    java.io.StringWriter stringWriter = new java.io.StringWriter();
    jakarta.json.stream.JsonGenerator generator = provider.createGenerator(stringWriter);

    searchResponse.serialize(generator, jsonpMapper);
    generator.close();

    return stringWriter.toString();
  }
}

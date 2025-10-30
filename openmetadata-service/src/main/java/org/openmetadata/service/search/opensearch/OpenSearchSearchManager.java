package org.openmetadata.service.search.opensearch;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchManagementClient;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;

/**
 * OpenSearch implementation of search management operations.
 * This class handles all search-related operations for OpenSearch using the new Java API client.
 */
@Slf4j
public class OpenSearchSearchManager implements SearchManagementClient {
  private final OpenSearchClient client;
  private final boolean isClientAvailable;

  public OpenSearchSearchManager(OpenSearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    if (!isClientAvailable) {
      throw new IOException("OpenSearch client is not available");
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
                                        m ->
                                            m.term(
                                                t ->
                                                    t.field("sourceUrl")
                                                        .value(FieldValue.of(sourceUrl)))))));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    return Response.status(OK).entity(response.toJsonString()).build();
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index, Boolean deleted)
      throws IOException {
    if (!isClientAvailable) {
      throw new IOException("OpenSearch client is not available");
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
                                            f ->
                                                f.term(
                                                    t ->
                                                        t.field("deleted")
                                                            .value(FieldValue.of(deleted)))))));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    return Response.status(OK).entity(response.toJsonString()).build();
  }
}

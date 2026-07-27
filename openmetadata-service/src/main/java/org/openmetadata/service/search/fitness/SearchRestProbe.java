/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under the License.
 */
package org.openmetadata.service.search.fitness;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.NullNode;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchClient;

/**
 * Issues raw GET requests to either an Elasticsearch or OpenSearch cluster and returns the body as
 * a Jackson {@link JsonNode}. Lets the fitness analyzer walk JSON uniformly without binding to
 * engine-specific typed responses.
 *
 * <p>Mirrors the existing pattern in {@code OpenMetadataOperations.getAllIndices()}.
 */
@Slf4j
public class SearchRestProbe {

  private final SearchClient searchClient;

  public SearchRestProbe(SearchClient searchClient) {
    this.searchClient = searchClient;
  }

  /**
   * Issues an HTTP GET against the cluster. Returns {@link NullNode} on any failure so callers can
   * keep walking and contribute to {@code inaccessibleMetrics}.
   */
  public JsonNode get(String endpoint) {
    JsonNode result = NullNode.getInstance();
    try {
      String body = rawGet(endpoint);
      if (body != null && !body.isEmpty()) {
        result = JsonUtils.readTree(body);
      }
    } catch (Exception e) {
      LOG.debug("Fitness probe GET {} failed: {}", endpoint, e.getMessage());
    }
    return result;
  }

  private String rawGet(String endpoint) throws Exception {
    String body;
    if (searchClient instanceof ElasticSearchClient) {
      body = elasticGet(endpoint);
    } else if (searchClient instanceof OpenSearchClient os) {
      body = openSearchGet(os, endpoint);
    } else {
      body = null;
    }
    return body;
  }

  private String elasticGet(String endpoint) throws Exception {
    Object raw = searchClient.getLowLevelClient();
    if (!(raw
        instanceof es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client lowLevel)) {
      LOG.debug(
          "Elasticsearch low-level client is not Rest5Client (got {}); cannot probe {}",
          raw == null ? "null" : raw.getClass().getName(),
          endpoint);
      return null;
    }
    es.co.elastic.clients.transport.rest5_client.low_level.Request request =
        new es.co.elastic.clients.transport.rest5_client.low_level.Request("GET", endpoint);
    var response = lowLevel.performRequest(request);
    String body;
    try (var is = response.getEntity().getContent()) {
      body = new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }
    return body;
  }

  private String openSearchGet(OpenSearchClient client, String endpoint) throws Exception {
    os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient generic =
        client.getNewClient().generic();
    String body;
    try (var response =
        generic.execute(
            os.org.opensearch.client.opensearch.generic.Requests.builder()
                .method("GET")
                .endpoint(endpoint)
                .build())) {
      body =
          response
              .getBody()
              .map(
                  b -> {
                    String content;
                    try {
                      content = new String(b.bodyAsBytes(), StandardCharsets.UTF_8);
                    } catch (Exception e) {
                      LOG.debug(
                          "Failed to read OS response body for {}: {}", endpoint, e.getMessage());
                      content = null;
                    }
                    return content;
                  })
              .orElse(null);
    }
    return body;
  }
}

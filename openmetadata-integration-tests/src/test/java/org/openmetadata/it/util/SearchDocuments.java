/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.util;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import os.org.opensearch.client.opensearch.OpenSearchClient;

/**
 * Reads and plants stored search documents by id through the in-process server's search client.
 * Each call first waits for the search writes the server has queued, so it sees, and plants over,
 * the documents the API calls before it left.
 */
public final class SearchDocuments {
  private static final String REFRESH = "?refresh=true";

  private SearchDocuments() {}

  /** The document as stored in {@code indexOrAlias}, or empty when there is no such document. */
  public static Optional<JsonNode> find(final String indexOrAlias, final String id)
      throws IOException {
    final Object client = Entity.getSearchRepository().getSearchClient().getHighLevelClient();
    final Map<?, ?> source =
        client instanceof ElasticsearchClient elastic
            ? elastic.get(request -> request.index(indexOrAlias).id(id), Map.class).source()
            : ((OpenSearchClient) client)
                .get(request -> request.index(indexOrAlias).id(id), Map.class)
                .source();
    return Optional.ofNullable(source)
        .map(found -> JsonUtils.readTree(JsonUtils.pojoToJson(found)));
  }

  /** Changes {@code fields} of a stored document in place, bypassing the server's write path. */
  public static void update(
      final String indexOrAlias, final String id, final Map<String, Object> fields)
      throws IOException {
    send("POST", "/" + indexOrAlias + "/_update/" + id + REFRESH, Map.of("doc", fields));
  }

  /** Stores {@code document} under {@code id}, bypassing the server's write path. */
  public static void put(
      final String indexOrAlias, final String id, final Map<String, Object> document)
      throws IOException {
    send("PUT", "/" + indexOrAlias + "/_doc/" + id + REFRESH, document);
  }

  /** The concrete index behind {@code indexOrAlias}, which must resolve to exactly one. */
  public static String servingIndex(final String indexOrAlias) {
    final Set<String> aliased =
        Entity.getSearchRepository().getSearchClient().getIndicesByAlias(indexOrAlias);
    if (aliased.size() > 1) {
      throw new IllegalStateException(indexOrAlias + " resolves to several indices: " + aliased);
    }
    return aliased.isEmpty() ? indexOrAlias : aliased.iterator().next();
  }

  private static void send(final String method, final String endpoint, final Object body)
      throws IOException {
    final RawSearchResponse response =
        Entity.getSearchRepository()
            .getSearchClient()
            .rawSearchRequest(method, endpoint, JsonUtils.pojoToJson(body));
    if (response.statusCode() >= 300) {
      throw new IOException(method + " " + endpoint + " failed: " + response.body());
    }
  }
}

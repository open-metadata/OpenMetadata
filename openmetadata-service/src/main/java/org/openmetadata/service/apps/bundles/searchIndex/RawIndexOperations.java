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

package org.openmetadata.service.apps.bundles.searchIndex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;

/**
 * The few index reads and deletes an in-place reindex needs, sent as raw requests so Elasticsearch
 * and OpenSearch share one implementation.
 */
@Slf4j
class RawIndexOperations {
  private static final String GET = "GET";
  private static final String POST = "POST";
  private static final String DELETE = "DELETE";
  private static final String SCROLL_KEEP_ALIVE = "2m";
  private static final String SCROLL_ID = "scroll_id";

  /** Receives one page of document ids. */
  @FunctionalInterface
  interface IdPageHandler {
    void accept(List<String> ids) throws IOException;
  }

  private final SearchClient searchClient;

  RawIndexOperations(final SearchClient searchClient) {
    this.searchClient = searchClient;
  }

  /** The {@code _meta} of {@code index}'s mapping, or a missing node when it has none. */
  JsonNode mappingMeta(final String index) throws IOException {
    final JsonNode response =
        send(GET, "/" + index + "/_mapping?filter_path=*.mappings._meta", null);
    final Iterator<JsonNode> indices = response.elements();
    return indices.hasNext()
        ? indices.next().path("mappings").path("_meta")
        : MissingNode.getInstance();
  }

  void refresh(final String index) throws IOException {
    send(POST, "/" + index + "/_refresh", null);
  }

  /** Hands the ids of the documents matching {@code query} to {@code page}, a page at a time. */
  void forEachIdPage(
      final String index, final JsonNode query, final int pageSize, final IdPageHandler page)
      throws IOException {
    JsonNode response =
        send(POST, "/" + index + "/_search?scroll=" + SCROLL_KEEP_ALIVE, idQuery(query, pageSize));
    String scrollId = response.path("_scroll_id").asText(null);
    try {
      List<String> ids = hitIds(response);
      while (!ids.isEmpty()) {
        page.accept(ids);
        response = send(POST, "/_search/scroll", scrollRequest(scrollId));
        scrollId = response.path("_scroll_id").asText(scrollId);
        ids = hitIds(response);
      }
    } finally {
      clearScroll(scrollId);
    }
  }

  /** Deletes the documents with {@code ids}; one a concurrent write changed is left alone. */
  long deleteIds(final String index, final List<String> ids) throws IOException {
    final ObjectNode body = JsonUtils.getObjectNode();
    final ArrayNode values = body.putObject("query").putObject("ids").putArray("values");
    ids.forEach(values::add);
    final JsonNode response =
        send(POST, "/" + index + "/_delete_by_query?conflicts=proceed", body.toString());
    return response.path("deleted").asLong();
  }

  private JsonNode send(final String method, final String endpoint, final String body)
      throws IOException {
    final RawSearchResponse response = searchClient.rawSearchRequest(method, endpoint, body);
    if (response.statusCode() >= 300) {
      throw new IOException(
          String.format(
              "%s %s failed with status %d: %s",
              method, endpoint, response.statusCode(), response.body()));
    }
    return JsonUtils.readTree(response.body());
  }

  private static String idQuery(final JsonNode query, final int pageSize) {
    final ObjectNode body = JsonUtils.getObjectNode();
    body.put("size", pageSize);
    body.put("_source", false);
    body.putArray("sort").add("_doc");
    body.set("query", query);
    return body.toString();
  }

  private static String scrollRequest(final String scrollId) {
    final ObjectNode body = JsonUtils.getObjectNode();
    body.put("scroll", SCROLL_KEEP_ALIVE);
    body.put(SCROLL_ID, scrollId);
    return body.toString();
  }

  private static List<String> hitIds(final JsonNode response) {
    final List<String> ids = new ArrayList<>();
    response.path("hits").path("hits").forEach(hit -> ids.add(hit.path("_id").asText()));
    return ids;
  }

  private void clearScroll(final String scrollId) {
    if (scrollId != null) {
      final ObjectNode body = JsonUtils.getObjectNode();
      body.putArray(SCROLL_ID).add(scrollId);
      try {
        send(DELETE, "/_search/scroll", body.toString());
      } catch (IOException e) {
        LOG.debug("Could not clear scroll; it expires after {}", SCROLL_KEEP_ALIVE, e);
      }
    }
  }
}

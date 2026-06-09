/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Iterator;
import java.util.Locale;
import java.util.UUID;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Provisions a throwaway "shadow" index cloned from an entity's real mapping so each canary case
 * runs in isolation.
 *
 * <p>The shared {@code <entity>_search_index} accumulates dynamic mapping fields (e.g. from
 * {@code customProperties.breadth}) that a doc-delete cleanup cannot remove, which pollutes the
 * index and makes outcomes order-dependent across ITs. Cloning the real mapping into a uniquely
 * named index per case, then dropping it, keeps each measurement deterministic.
 */
public final class ShadowIndex {
  private static final Logger LOG = LoggerFactory.getLogger(ShadowIndex.class);

  // mirrors the value in *_index_mapping.json
  private static final int DEFAULT_MAX_NGRAM_DIFF = 17;

  private static final String SHADOW_SUFFIX = "_sc_";
  private static final String SETTINGS = "settings";
  private static final String INDEX = "index";
  private static final String MAPPINGS = "mappings";
  private static final String ANALYSIS = "analysis";
  private static final String MAPPING = "mapping";
  private static final String MAX_NGRAM_DIFF = "max_ngram_diff";
  private static final String NUMBER_OF_REPLICAS = "number_of_replicas";

  private final SearchRepository searchRepository;
  private final SearchClient httpSearch;

  public ShadowIndex(final SearchRepository searchRepository, final SearchClient httpSearch) {
    this.searchRepository = searchRepository;
    this.httpSearch = httpSearch;
  }

  public String create(final String entityType) {
    final String realIndex =
        searchRepository
            .getIndexMapping(entityType)
            .getIndexName(searchRepository.getClusterAlias());
    final String freshIndex =
        (realIndex + SHADOW_SUFFIX + UUID.randomUUID().toString().substring(0, 8))
            .toLowerCase(Locale.ROOT);
    final JsonNode source = innerSource(httpSearch.get("/" + realIndex), realIndex);
    httpSearch.put("/" + freshIndex, JsonUtils.pojoToJson(buildCreateBody(source)));
    return freshIndex;
  }

  public void drop(final String freshIndex) {
    try {
      httpSearch.delete("/" + freshIndex);
    } catch (final Exception e) {
      // Best-effort cleanup on a finally path: never let a drop failure mask the case outcome.
      LOG.warn("Failed to drop shadow index {}", freshIndex, e);
    }
  }

  private JsonNode innerSource(final JsonNode response, final String realIndex) {
    final JsonNode inner;
    if (response.has(realIndex)) {
      inner = response.get(realIndex);
    } else {
      final Iterator<JsonNode> elements = response.elements();
      if (!elements.hasNext()) {
        throw new IllegalStateException("Empty mapping response for index " + realIndex);
      }
      inner = elements.next();
    }
    return inner;
  }

  private ObjectNode buildCreateBody(final JsonNode source) {
    final JsonNode srcSettingsIndex = source.path(SETTINGS).path(INDEX);
    final ObjectNode indexSettings = JsonUtils.getObjectNode();
    indexSettings.put(
        MAX_NGRAM_DIFF, srcSettingsIndex.path(MAX_NGRAM_DIFF).asInt(DEFAULT_MAX_NGRAM_DIFF));
    indexSettings.put(NUMBER_OF_REPLICAS, 0);
    if (srcSettingsIndex.has(ANALYSIS)) {
      indexSettings.set(ANALYSIS, srcSettingsIndex.get(ANALYSIS));
    }
    // Carry over any index.mapping.* limit overrides (total_fields/nested_objects/depth) so the
    // shadow index enforces exactly the real index's limits — otherwise an entity that raised a
    // limit would falsely report REJECT_FIELDS against the default.
    if (srcSettingsIndex.has(MAPPING)) {
      indexSettings.set(MAPPING, srcSettingsIndex.get(MAPPING));
    }
    final ObjectNode settings = JsonUtils.getObjectNode();
    settings.set(INDEX, indexSettings);

    final ObjectNode body = JsonUtils.getObjectNode();
    body.set(SETTINGS, settings);
    body.set(MAPPINGS, source.get(MAPPINGS));
    return body;
  }
}

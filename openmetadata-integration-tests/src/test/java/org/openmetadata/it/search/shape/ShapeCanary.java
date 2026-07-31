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
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class ShapeCanary {
  private static final Logger LOG = LoggerFactory.getLogger(ShapeCanary.class);
  private static final String FOUND = "found";
  private static final int MAX_CAUSE_DEPTH = 10;

  private final SearchRepository searchRepository;
  private final SearchClient httpSearch;
  private final ShadowIndex shadowIndex;

  public ShapeCanary(final SearchRepository searchRepository, final SearchClient httpSearch) {
    this.searchRepository = searchRepository;
    this.httpSearch = httpSearch;
    this.shadowIndex = new ShadowIndex(searchRepository, httpSearch);
  }

  public ShapeResult index(
      final String entityType, final EntityInterface entity, final FieldProbe probe) {
    final String docId = entity.getId().toString();
    final String freshIndex = shadowIndex.create(entityType);
    ShapeResult result;
    try {
      final String doc = buildDoc(entityType, entity);
      final String rejection = putDoc(freshIndex, docId, doc);
      result =
          rejection != null
              ? new ShapeResult(Outcome.REJECTED, rejection)
              : verify(freshIndex, docId, probe);
    } finally {
      shadowIndex.drop(freshIndex);
    }
    return result;
  }

  /**
   * Builds the search document from the entity. Deliberately NOT wrapped in the REJECTED path: a
   * failure here is a doc-build/serialization bug in the harness or index code, not the engine
   * refusing an unindexable shape, so it must surface as an error rather than masquerade as
   * REJECTED (which is reserved for the write below).
   */
  private String buildDoc(final String entityType, final EntityInterface entity) {
    final SearchIndex index =
        searchRepository.getSearchIndexFactory().buildIndex(entityType, entity);
    return JsonUtils.pojoToJson(index.buildSearchIndexDoc());
  }

  /**
   * PUTs the built doc into the shadow index. Returns the engine's rejection detail when the write
   * fails, or {@code null} when it succeeds. Only this network write is caught — the engine refuses
   * an unindexable doc with varied exception types, and REJECTED plus the raw error chain is the
   * honest signal. We do NOT classify the cause.
   */
  private String putDoc(final String freshIndex, final String docId, final String doc) {
    String rejection = null;
    try {
      searchRepository.getSearchClient().createEntity(freshIndex, docId, doc);
    } catch (final Exception e) {
      rejection = describe(e);
      LOG.warn("REJECTED: PUT to {} failed for doc {}: {}", freshIndex, docId, rejection, e);
    }
    return rejection;
  }

  private ShapeResult verify(final String indexName, final String docId, final FieldProbe probe) {
    final ShapeResult result;
    final JsonNode response = httpSearch.get("/" + indexName + "/_doc/" + docId);
    if (!response.path(FOUND).asBoolean(false)) {
      result =
          new ShapeResult(Outcome.ERROR_OTHER, notRetrievableDetail(indexName, docId, response));
    } else if (probe == null || isSearchable(indexName, probe)) {
      result = new ShapeResult(Outcome.OK, "");
    } else {
      result =
          new ShapeResult(
              Outcome.DEGRADED_UNSEARCHABLE,
              "doc indexed and present in _source, but a term query on the ramped field returned no"
                  + " hits (value dropped from the term index, e.g. keyword ignore_above)");
    }
    return result;
  }

  /**
   * Runs the probe's term query, refreshing first. The get-by-id above is realtime, but {@code
   * _search} reads the near-real-time view — without a refresh a just-indexed searchable value can
   * return zero hits and be misreported as DEGRADED_UNSEARCHABLE.
   */
  private boolean isSearchable(final String indexName, final FieldProbe probe) {
    httpSearch.post("/" + indexName + "/_refresh", "");
    return probe.searchable(httpSearch, indexName);
  }

  /**
   * The PUT returned without throwing, yet a get-by-id finds nothing. The index {@code _count}
   * disambiguates "nothing was written" (silent no-op, count 0) from "written elsewhere" (count
   * &gt; 0, e.g. wrong id/index), and the raw get response is included verbatim.
   */
  private String notRetrievableDetail(
      final String indexName, final String docId, final JsonNode getResponse) {
    // _count reads the near-real-time search view (unlike the realtime get-by-id), so refresh
    // first — otherwise a just-written doc could read 0 and make the hint below wrong.
    httpSearch.post("/" + indexName + "/_refresh", "");
    final long count = httpSearch.get("/" + indexName + "/_count").path("count").asLong(-1);
    final String detail =
        "PUT returned without error but GET /"
            + indexName
            + "/_doc/"
            + docId
            + " -> found=false; post-refresh index _count="
            + count
            + (count == 0 ? " (nothing written — silent no-op PUT)" : " (doc written elsewhere?)")
            + "; raw get: "
            + getResponse;
    LOG.warn("ERROR_OTHER: {}", detail);
    return detail;
  }

  private static String describe(final Throwable error) {
    final StringBuilder chain = new StringBuilder();
    Throwable cursor = error;
    int depth = 0;
    while (cursor != null && depth < MAX_CAUSE_DEPTH) {
      if (chain.length() > 0) {
        chain.append(" | caused by: ");
      }
      chain.append(cursor.getClass().getSimpleName()).append(": ").append(cursor.getMessage());
      cursor = cursor.getCause();
      depth++;
    }
    return chain.toString();
  }
}

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
      final SearchIndex index =
          searchRepository.getSearchIndexFactory().buildIndex(entityType, entity);
      final String doc = JsonUtils.pojoToJson(index.buildSearchIndexDoc());
      searchRepository.getSearchClient().createEntity(freshIndex, docId, doc);
      result = verify(freshIndex, docId, probe);
    } catch (final Exception e) {
      // Intentional broad catch: the engine refuses an unindexable doc with varied exception types.
      // We do NOT classify the cause — REJECTED plus the full error chain is the honest signal.
      final String detail = describe(e);
      LOG.warn("REJECTED: PUT to {} failed for doc {}: {}", freshIndex, docId, detail, e);
      result = new ShapeResult(Outcome.REJECTED, detail);
    } finally {
      shadowIndex.drop(freshIndex);
    }
    return result;
  }

  private ShapeResult verify(final String indexName, final String docId, final FieldProbe probe) {
    final ShapeResult result;
    final JsonNode response = httpSearch.get("/" + indexName + "/_doc/" + docId);
    if (!response.path(FOUND).asBoolean(false)) {
      result =
          new ShapeResult(Outcome.ERROR_OTHER, notRetrievableDetail(indexName, docId, response));
    } else if (probe == null || probe.searchable(httpSearch, indexName)) {
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
   * The PUT returned without throwing, yet a get-by-id finds nothing. The index {@code _count}
   * disambiguates "nothing was written" (silent no-op, count 0) from "written elsewhere" (count
   * &gt; 0, e.g. wrong id/index), and the raw get response is included verbatim.
   */
  private String notRetrievableDetail(
      final String indexName, final String docId, final JsonNode getResponse) {
    final long count = httpSearch.get("/" + indexName + "/_count").path("count").asLong(-1);
    final String detail =
        "PUT returned without error but GET /"
            + indexName
            + "/_doc/"
            + docId
            + " -> found=false; index _count="
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

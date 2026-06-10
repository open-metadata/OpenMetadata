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

public final class ShapeCanary {
  private static final String FOUND = "found";

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
      result = new ShapeResult(verify(freshIndex, docId, probe), "");
    } catch (final Exception e) {
      // Intentional broad catch: the engine refuses an unindexable doc with varied exception types.
      // We do NOT classify the cause — REJECTED plus the raw message is the honest, reliable signal.
      result = new ShapeResult(Outcome.REJECTED, String.valueOf(e.getMessage()));
    } finally {
      shadowIndex.drop(freshIndex);
    }
    return result;
  }

  private Outcome verify(final String indexName, final String docId, final FieldProbe probe) {
    Outcome outcome;
    final JsonNode response = httpSearch.get("/" + indexName + "/_doc/" + docId);
    if (!response.path(FOUND).asBoolean(false)) {
      outcome = Outcome.ERROR_OTHER;
    } else if (probe == null || probe.searchable(httpSearch, indexName)) {
      outcome = Outcome.OK;
    } else {
      outcome = Outcome.DEGRADED_UNSEARCHABLE;
    }
    return outcome;
  }
}

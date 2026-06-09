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

  public ShapeCanary(final SearchRepository searchRepository, final SearchClient httpSearch) {
    this.searchRepository = searchRepository;
    this.httpSearch = httpSearch;
  }

  public Outcome index(
      final String entityType, final EntityInterface entity, final FieldProbe probe) {
    final String indexName =
        searchRepository
            .getIndexMapping(entityType)
            .getIndexName(searchRepository.getClusterAlias());
    final String docId = entity.getId().toString();
    Outcome outcome;
    try {
      final SearchIndex index =
          searchRepository.getSearchIndexFactory().buildIndex(entityType, entity);
      final String doc = JsonUtils.pojoToJson(index.buildSearchIndexDoc());
      searchRepository.getSearchClient().createEntity(indexName, docId, doc);
      outcome = verify(indexName, docId, probe);
    } catch (final Exception e) {
      outcome = ShapeClassifier.classifyError(e.getMessage());
    } finally {
      cleanup(indexName, docId);
    }
    return outcome;
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

  private void cleanup(final String indexName, final String docId) {
    try {
      searchRepository.getSearchClient().deleteEntity(indexName, docId);
    } catch (final Exception ignored) {
      // best-effort: a rejected doc never indexed, so there is nothing to delete
    }
  }
}

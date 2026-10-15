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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import org.openmetadata.service.search.SearchDocumentRebuilder;
import org.openmetadata.service.search.SearchRepository;

class StagedIndexCompletenessTest {
  private static final String STAGED = "table_search_index_rebuild_1";

  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final SearchClient searchClient = mock(SearchClient.class);
  private final SearchDocumentRebuilder rebuilder = mock(SearchDocumentRebuilder.class);
  private final StagedIndexCompleteness completeness =
      new StagedIndexCompleteness(searchRepository, rebuilder);

  @Test
  @SuppressWarnings("unchecked")
  void aRowTheRunDidNotWriteIsRebuiltBeforePromotion() throws Exception {
    final UUID written = UUID.randomUUID();
    final UUID skipped = UUID.randomUUID();
    final EntityRepository<EntityInterface<?>> tables = mock(EntityRepository.class);
    final EntityDAO<EntityInterface<?>> rows = mock(EntityDAO.class);
    when(tables.getDao()).thenReturn(rows);
    when(rows.getTableName()).thenReturn("table_entity");
    when(rows.listIdsAfter("table_entity", "", StagedIndexCompleteness.PAGE_SIZE))
        .thenReturn(List.of(written.toString(), skipped.toString()));
    when(rows.listIdsAfter("table_entity", skipped.toString(), StagedIndexCompleteness.PAGE_SIZE))
        .thenReturn(List.of());
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchClient.rawSearchRequest(
            eq("POST"), eq("/" + STAGED + "/_mget?_source=false"), anyString()))
        .thenReturn(
            new RawSearchResponse(
                200,
                "{\"docs\":[{\"_id\":\""
                    + written
                    + "\",\"found\":true},{\"_id\":\""
                    + skipped
                    + "\",\"found\":false}]}"));

    final long missing;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tables);
      missing = completeness.fillMissing(Entity.TABLE, STAGED, 0);
    }

    assertEquals(1, missing);
    verify(rebuilder)
        .rebuild(List.of(new EntityReference().withId(skipped).withType(Entity.TABLE)));
  }
}

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
package org.openmetadata.service.rdf.repair;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

class RdfOrphanSweepTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String TABLE_PREFIX = BASE + "entity/table/";
  private static final String KEPT = "a1b2c3d4-0000-4000-8000-000000000001";
  private static final String GONE = "a9b8c7d6-0000-4000-8000-000000000002";

  private final List<String> queries = new ArrayList<>();
  private final List<String> refreshed = new ArrayList<>();

  @Test
  void aTypeWithNoMoreProjectionsThanRowsIsNotListed() {
    final RdfOrphanSweep sweep = new RdfOrphanSweep(store(2), this::refresh);

    final long queued;
    try (MockedStatic<Entity> entity = tableRows(2, List.of(KEPT))) {
      queued = sweep.sweep(List.of(Entity.TABLE), () -> {});
    }

    assertEquals(0, queued);
    assertEquals(1, queries.size(), "only the count is asked for");
    assertTrue(refreshed.isEmpty());
  }

  @Test
  void projectionsWhoseRowsAreGoneAreQueuedForRemoval() {
    final RdfOrphanSweep sweep = new RdfOrphanSweep(store(2), this::refresh);

    final long queued;
    try (MockedStatic<Entity> entity = tableRows(1, List.of(KEPT))) {
      queued = sweep.sweep(List.of(Entity.TABLE), () -> {});
    }

    assertEquals(1, queued);
    assertEquals(List.of("table/" + GONE), refreshed);
    assertEquals(1 + RdfOrphanSweep.ID_PREFIXES.size(), queries.size());
  }

  private void refresh(final String entityType, final UUID id) {
    refreshed.add(entityType + "/" + id);
  }

  /** A store projecting {@link #KEPT} and {@link #GONE}, reporting {@code count} of them. */
  private RdfProjectedEntities store(final long count) {
    return new RdfProjectedEntities(
        query -> {
          queries.add(query);
          return query.contains("COUNT")
              ? "{\"results\": {\"bindings\": [{\"type\": {\"value\": \"table\"},"
                  + " \"n\": {\"value\": \""
                  + count
                  + "\"}}]}}"
              : listing(query);
        },
        () -> BASE);
  }

  private static String listing(final String query) {
    final StringBuilder bindings = new StringBuilder();
    for (final String id : List.of(KEPT, GONE)) {
      if (query.contains("\"" + TABLE_PREFIX + id.charAt(0) + "\"")) {
        bindings
            .append(bindings.isEmpty() ? "" : ",")
            .append("{\"s\": {\"value\": \"")
            .append(TABLE_PREFIX)
            .append(id)
            .append("\"}}");
      }
    }
    return "{\"results\": {\"bindings\": [" + bindings + "]}}";
  }

  @SuppressWarnings("unchecked")
  private static MockedStatic<Entity> tableRows(final int count, final List<String> existing) {
    final EntityRepository<EntityInterface<?>> repository = mock(EntityRepository.class);
    final EntityDAO<EntityInterface<?>> rows = mock(EntityDAO.class);
    when(repository.getDao()).thenReturn(rows);
    when(rows.getTableName()).thenReturn("table_entity");
    when(rows.listTotalCount()).thenReturn(count);
    when(rows.findExistingIds(eq("table_entity"), anyList())).thenReturn(existing);
    final MockedStatic<Entity> entity = mockStatic(Entity.class);
    entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
    return entity;
  }
}

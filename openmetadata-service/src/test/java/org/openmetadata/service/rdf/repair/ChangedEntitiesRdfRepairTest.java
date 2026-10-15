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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.ConnectionException;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityDAO.ChangedRow;
import org.openmetadata.service.jdbi3.EntityRepository;

class ChangedEntitiesRdfRepairTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final long SINCE = 1_000L;
  private static final long UNTIL = 9_000L;
  private static final int PAGE = ChangedEntitiesRdfRepair.PAGE_SIZE;

  private final List<String> refreshed = new ArrayList<>();

  @Test
  void entitiesWithAMissingOrOlderProjectionAreQueuedForRefresh() throws Exception {
    final ChangedRow current = changedRow(3_000L);
    final ChangedRow behind = changedRow(4_000L);
    final ChangedRow missing = changedRow(5_000L);
    final EntityDAO<EntityInterface<?>> tables =
        rowsChanged("table_entity", List.of(current, behind, missing));
    final ChangedEntitiesRdfRepair repair =
        repair(
            List.of(Entity.TABLE),
            projections(
                Entity.TABLE,
                List.of(new String[] {current.id(), "3000"}, new String[] {behind.id(), "3500"})));

    final int queued;
    try (MockedStatic<Entity> entity = registered(Entity.TABLE, tables)) {
      queued = repair.repair(SINCE, UNTIL, () -> {});
    }

    assertEquals(2, queued);
    assertEquals(List.of("table/" + behind.id(), "table/" + missing.id()), refreshed);
  }

  @Test
  void aTypeThatFailsKeepsTheWindowWithoutStoppingTheOthers() throws Exception {
    final ConnectionException outage = new ConnectionException(new SQLException("refused"));
    final EntityDAO<EntityInterface<?>> tables = rowsChanged("table_entity", List.of());
    when(tables.listChangedAfter("table_entity", UNTIL, SINCE, "", PAGE)).thenThrow(outage);
    final ChangedRow topic = changedRow(2_000L);
    final EntityDAO<EntityInterface<?>> topics = rowsChanged("topic_entity", List.of(topic));
    final ChangedEntitiesRdfRepair repair =
        repair(List.of(Entity.TABLE, Entity.TOPIC), projections(Entity.TOPIC, List.of()));

    final Exception failure;
    try (MockedStatic<Entity> entity = registered(Entity.TABLE, tables)) {
      register(entity, Entity.TOPIC, topics);
      failure = assertThrows(Exception.class, () -> repair.repair(SINCE, UNTIL, () -> {}));
    }

    assertSame(outage, failure);
    assertEquals(List.of("topic/" + topic.id()), refreshed);
  }

  @Test
  void aTypeWhoseTableHasNoUpdatedAtIsSetAsideWithoutHoldingTheWindow() throws Exception {
    final EntityDAO<EntityInterface<?>> subscriptions =
        rowsChanged("event_subscription_entity", List.of());
    when(subscriptions.listChangedAfter("event_subscription_entity", UNTIL, SINCE, "", PAGE))
        .thenThrow(
            new ConnectionException(
                new SQLException("column \"updatedat\" does not exist", "42703")));
    final ChangedEntitiesRdfRepair repair =
        repair(
            List.of(Entity.EVENT_SUBSCRIPTION), projections(Entity.EVENT_SUBSCRIPTION, List.of()));

    try (MockedStatic<Entity> entity = registered(Entity.EVENT_SUBSCRIPTION, subscriptions)) {
      assertEquals(0, repair.repair(SINCE, UNTIL, () -> {}));
      assertEquals(0, repair.repair(SINCE, UNTIL, () -> {}));
    }

    verify(subscriptions, times(1))
        .listChangedAfter("event_subscription_entity", UNTIL, SINCE, "", PAGE);
  }

  private ChangedEntitiesRdfRepair repair(
      final List<String> types, final RdfProjectedEntities projected) {
    return new ChangedEntitiesRdfRepair(
        projected, () -> types, (type, id) -> refreshed.add(type + "/" + id));
  }

  /** A store holding a {@code dct:modified} for each {id, millis} pair. */
  private static RdfProjectedEntities projections(
      final String entityType, final List<String[]> modified) {
    final StringBuilder bindings = new StringBuilder();
    for (final String[] projection : modified) {
      if (!bindings.isEmpty()) {
        bindings.append(',');
      }
      bindings
          .append("{\"s\": {\"value\": \"")
          .append(BASE)
          .append("entity/")
          .append(entityType)
          .append('/')
          .append(projection[0])
          .append("\"}, \"modified\": {\"value\": \"")
          .append(projection[1])
          .append("\"}}");
    }
    final String results = "{\"results\": {\"bindings\": [" + bindings + "]}}";
    return new RdfProjectedEntities(query -> results, () -> BASE);
  }

  @SuppressWarnings("unchecked")
  private static EntityDAO<EntityInterface<?>> rowsChanged(
      final String table, final List<ChangedRow> changed) {
    final EntityDAO<EntityInterface<?>> rows = mock(EntityDAO.class);
    when(rows.getTableName()).thenReturn(table);
    when(rows.listChangedAfter(table, UNTIL, SINCE, "", PAGE)).thenReturn(changed);
    if (!changed.isEmpty()) {
      final ChangedRow last = changed.getLast();
      when(rows.listChangedAfter(table, UNTIL, last.updatedAt(), last.id(), PAGE))
          .thenReturn(List.of());
    }
    return rows;
  }

  private static MockedStatic<Entity> registered(
      final String entityType, final EntityDAO<EntityInterface<?>> rows) {
    final MockedStatic<Entity> entity = mockStatic(Entity.class);
    register(entity, entityType, rows);
    return entity;
  }

  @SuppressWarnings("unchecked")
  private static void register(
      final MockedStatic<Entity> entity,
      final String entityType,
      final EntityDAO<EntityInterface<?>> rows) {
    final EntityRepository<EntityInterface<?>> repository = mock(EntityRepository.class);
    when(repository.getDao()).thenReturn(rows);
    entity.when(() -> Entity.getEntityRepository(entityType)).thenReturn(repository);
  }

  private static ChangedRow changedRow(final long updatedAt) {
    return new ChangedRow(UUID.randomUUID().toString(), updatedAt);
  }
}

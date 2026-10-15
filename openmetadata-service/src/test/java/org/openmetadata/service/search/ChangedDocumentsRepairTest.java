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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.ConnectionException;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityDAO.ChangedRow;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;

class ChangedDocumentsRepairTest {
  private static final long SINCE = 1_000L;
  private static final long UNTIL = 9_000L;
  private static final String NONE_AFTER = "";

  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final SearchClient searchClient = mock(SearchClient.class);
  private final SearchDocumentRebuilder rebuilder = mock(SearchDocumentRebuilder.class);
  private final ChangedDocumentsRepair repair =
      new ChangedDocumentsRepair(
          searchRepository, rebuilder, new SearchScopeRepair(searchRepository, rebuilder));

  @Test
  void documentsMissingUnstampedOrOlderThanTheirRowsAreRebuilt() throws Exception {
    final ChangedRow unstamped = changedRow(2_000L);
    final ChangedRow current = changedRow(3_000L);
    final ChangedRow behind = changedRow(4_000L);
    final ChangedRow missing = changedRow(5_000L);
    final EntityDAO<EntityInterface<?>> tables =
        rowsChanged("table_entity", List.of(unstamped, current, behind, missing));
    givenIndexedTypes(Set.of(Entity.TABLE));
    givenDocuments(
        "table_search_index",
        "{\"docs\":["
            + document(unstamped, "{}")
            + ","
            + document(current, "{\"sourceReadAt\":3500}")
            + ","
            + document(behind, "{\"sourceReadAt\":3500}")
            + ",{\"_id\":\""
            + missing.id()
            + "\",\"found\":false}]}");

    final int rebuilt;
    try (MockedStatic<Entity> entity = registered(Entity.TABLE, tables)) {
      rebuilt = repair.repair(SINCE, UNTIL, () -> {});
    }

    assertEquals(3, rebuilt);
    verify(rebuilder)
        .rebuild(
            List.of(
                reference(unstamped, Entity.TABLE),
                reference(behind, Entity.TABLE),
                reference(missing, Entity.TABLE)));
  }

  @Test
  void aDocumentThatCannotBeRebuiltIsQueuedForRetryAndThePassCarriesOn() throws Exception {
    final ChangedRow missing = changedRow(2_000L);
    final EntityDAO<EntityInterface<?>> tables = rowsChanged("table_entity", List.of(missing));
    givenIndexedTypes(Set.of(Entity.TABLE));
    givenDocuments("table_search_index", "{\"docs\":[]}");
    doThrow(new IllegalStateException("Search rebuild failed for 1 entities"))
        .when(rebuilder)
        .rebuild(anyList());

    final int rebuilt;
    try (MockedStatic<Entity> entity = registered(Entity.TABLE, tables);
        MockedStatic<SearchIndexRetryQueue> retries = mockStatic(SearchIndexRetryQueue.class)) {
      rebuilt = repair.repair(SINCE, UNTIL, () -> {});
      retries.verify(
          () -> SearchIndexRetryQueue.enqueue(eq(missing.id()), isNull(), eq(Entity.TABLE), any()));
    }

    assertEquals(1, rebuilt);
  }

  @Test
  void aTypeThatFailsKeepsTheWindowWithoutStoppingTheOthers() throws Exception {
    final ConnectionException outage = new ConnectionException(new SQLException("refused"));
    final EntityDAO<EntityInterface<?>> tables = rowsChanged("table_entity", List.of());
    when(tables.listChangedAfter("table_entity", UNTIL, SINCE, NONE_AFTER, 500)).thenThrow(outage);
    final ChangedRow topicRow = changedRow(2_000L);
    final EntityDAO<EntityInterface<?>> topics = rowsChanged("topic_entity", List.of(topicRow));
    givenIndexedTypes(Set.of(Entity.TABLE, Entity.TOPIC));
    givenDocuments("topic_search_index", "{\"docs\":[{\"_id\":\"x\",\"found\":false}]}");

    final Exception failure;
    try (MockedStatic<Entity> entity = registered(Entity.TABLE, tables)) {
      register(entity, Entity.TOPIC, topics);
      failure = assertThrows(Exception.class, () -> repair.repair(SINCE, UNTIL, () -> {}));
    }

    assertSame(outage, failure);
    verify(rebuilder).rebuild(List.of(reference(topicRow, Entity.TOPIC)));
  }

  @Test
  void onlyTypesWithRowsThatCarryUpdatedAtAreRepaired() {
    givenIndexedTypes(
        Set.of(
            Entity.TABLE,
            Entity.TABLE_COLUMN,
            Entity.TEST_CASE_RESULT,
            "entityReportData",
            Entity.STORED_PROCEDURE));

    final List<String> repairable;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.hasEntityRepository(anyString())).thenReturn(true);
      entity.when(() -> Entity.hasEntityRepository(Entity.STORED_PROCEDURE)).thenReturn(false);
      repairable = repair.repairableTypes();
    }

    assertEquals(List.of(Entity.TABLE), repairable);
  }

  private void givenIndexedTypes(final Set<String> entityTypes) {
    when(searchRepository.getIndexedEntityTypes()).thenReturn(entityTypes);
    when(searchRepository.getClusterAlias()).thenReturn("");
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    entityTypes.forEach(
        entityType ->
            when(searchRepository.getIndexMapping(entityType))
                .thenReturn(
                    IndexMapping.builder()
                        .indexName(entityType + "_search_index")
                        .alias(entityType)
                        .build()));
  }

  private void givenDocuments(final String index, final String mgetResponse) throws Exception {
    when(searchClient.rawSearchRequest(eq("POST"), startsWith("/" + index + "/_mget"), anyString()))
        .thenReturn(new RawSearchResponse(200, mgetResponse));
  }

  @SuppressWarnings("unchecked")
  private static EntityDAO<EntityInterface<?>> rowsChanged(
      final String table, final List<ChangedRow> changed) {
    final EntityDAO<EntityInterface<?>> rows = mock(EntityDAO.class);
    when(rows.getTableName()).thenReturn(table);
    when(rows.listChangedAfter(table, UNTIL, SINCE, NONE_AFTER, 500)).thenReturn(changed);
    if (!changed.isEmpty()) {
      final ChangedRow last = changed.getLast();
      when(rows.listChangedAfter(table, UNTIL, last.updatedAt(), last.id(), 500))
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
    entity.when(() -> Entity.hasEntityRepository(entityType)).thenReturn(true);
    entity.when(() -> Entity.getEntityRepository(entityType)).thenReturn(repository);
  }

  private static ChangedRow changedRow(final long updatedAt) {
    return new ChangedRow(UUID.randomUUID().toString(), updatedAt);
  }

  private static String document(final ChangedRow row, final String source) {
    return "{\"_id\":\"" + row.id() + "\",\"found\":true,\"_source\":" + source + "}";
  }

  private static EntityReference reference(final ChangedRow row, final String entityType) {
    return new EntityReference().withId(UUID.fromString(row.id())).withType(entityType);
  }
}

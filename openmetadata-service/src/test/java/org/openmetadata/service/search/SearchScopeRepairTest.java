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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import org.openmetadata.service.search.indexes.ColumnSearchIndex;

class SearchScopeRepairTest {
  private static final SearchRepairScope SCOPE =
      new SearchRepairScope(
          List.of("table_search_index", "table_column_search_index"),
          SearchRepairScope.anyFieldEquals(List.of("databaseSchema.id"), "schema-1"),
          42L);
  private static final RawSearchResponse NO_MORE_HITS =
      new RawSearchResponse(200, "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[]}}");

  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final SearchClient searchClient = mock(SearchClient.class);
  private final SearchDocumentRebuilder rebuilder = mock(SearchDocumentRebuilder.class);
  private final SearchScopeRepair repair = new SearchScopeRepair(searchRepository, rebuilder);

  @Test
  void matchedEntityDocumentsAreRebuiltFromTheirRows() throws Exception {
    final UUID orders = UUID.randomUUID();
    final UUID payments = UUID.randomUUID();
    givenMatches(
        entityHit("table_search_index", orders), entityHit("table_search_index", payments));

    final boolean settled;
    try (MockedStatic<Entity> entity = registeredTypes()) {
      settled = repair.repair(SCOPE);
    }

    assertTrue(settled);
    @SuppressWarnings("unchecked")
    final ArgumentCaptor<List<EntityReference>> rebuilt = ArgumentCaptor.forClass(List.class);
    verify(rebuilder).rebuild(rebuilt.capture());
    assertEquals(
        List.of(reference(orders, Entity.TABLE), reference(payments, Entity.TABLE)),
        rebuilt.getValue());
  }

  @Test
  void aDocumentThatCannotBeRebuiltIsQueuedAloneAndTheScopeSettles() throws Exception {
    final UUID orders = UUID.randomUUID();
    final UUID broken = UUID.randomUUID();
    givenMatches(entityHit("table_search_index", orders), entityHit("table_search_index", broken));
    when(searchClient.isClientAvailable()).thenReturn(true);
    final IllegalStateException missingRelationship =
        new IllegalStateException("testDefinition relationship is gone");
    doThrow(missingRelationship)
        .when(rebuilder)
        .rebuild(List.of(reference(orders, Entity.TABLE), reference(broken, Entity.TABLE)));
    doThrow(missingRelationship).when(rebuilder).rebuild(List.of(reference(broken, Entity.TABLE)));

    final boolean settled;
    try (MockedStatic<Entity> entity = registeredTypes();
        MockedStatic<SearchIndexRetryQueue> retries =
            mockStatic(SearchIndexRetryQueue.class, CALLS_REAL_METHODS)) {
      settled = repair.repair(SCOPE);
      retries.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  eq(broken.toString()), isNull(), eq(Entity.TABLE), any()));
      retries.verify(
          () -> SearchIndexRetryQueue.enqueue(eq(orders.toString()), isNull(), anyString(), any()),
          never());
    }

    assertTrue(settled);
    verify(rebuilder).rebuild(List.of(reference(orders, Entity.TABLE)));
  }

  @Test
  void theScrollAsksOnlyForDocumentsNotRewrittenSinceTheScope() throws Exception {
    givenMatches();

    try (MockedStatic<Entity> entity = registeredTypes()) {
      repair.repair(SCOPE);
    }

    final ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
    verify(searchClient)
        .rawSearchRequest(
            eq("POST"),
            startsWith("/table_search_index,table_column_search_index/_search?scroll="),
            body.capture());
    assertTrue(body.getValue().contains("\"must_not\""));
    assertTrue(body.getValue().contains("\"gte\":42"));
  }

  @Test
  void aColumnDocumentIsRebuiltWithItsTableAndADroppedColumnIsDeleted() throws Exception {
    final UUID tableId = UUID.randomUUID();
    final Table table =
        new Table()
            .withId(tableId)
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.INT)
                        .withFullyQualifiedName("s.db.sch.orders.id")));
    final String keptColumn = ColumnSearchIndex.generateColumnId("s.db.sch.orders.id");
    final String droppedColumn = ColumnSearchIndex.generateColumnId("s.db.sch.orders.old");
    givenMatches(
        columnHit(keptColumn, tableId.toString()), columnHit(droppedColumn, tableId.toString()));
    when(rebuilder.load(reference(tableId, Entity.TABLE)))
        .thenReturn(new SearchDocumentRebuilder.StableEntitySnapshot(table, null));

    try (MockedStatic<Entity> entity = registeredTypes()) {
      repair.repair(SCOPE);
    }

    verify(searchClient).deleteEntity("table_column_search_index", droppedColumn);
    verify(searchClient, never()).deleteEntity("table_column_search_index", keptColumn);
    verify(rebuilder).rebuild(List.of(reference(tableId, Entity.TABLE)));
  }

  @Test
  void documentsThatCannotBeRebuiltDoNotKeepTheRepairOpen() throws Exception {
    givenMatches(
        "{\"_index\":\"entity_report_data_index\",\"_id\":\"r1\",\"_source\":{\"entityType\":\"entityReportData\"}}");

    final boolean settled;
    try (MockedStatic<Entity> entity = registeredTypes()) {
      settled = repair.repair(SCOPE);
    }

    assertTrue(settled, "a pass that could rebuild nothing must not be queued again");
    verify(rebuilder, never()).rebuild(any());
    verify(searchClient, never()).deleteEntity(anyString(), anyString());
  }

  @Test
  void aDocumentWithoutATypeIsKnownByItsIndex() {
    final IndexMapping tables = mock(IndexMapping.class);
    final IndexMapping columns = mock(IndexMapping.class);
    when(searchRepository.getClusterAlias()).thenReturn("om");
    when(tables.getIndexName("om")).thenReturn("om_table_search_index");
    when(columns.getIndexName("om")).thenReturn("om_table_column_search_index");
    when(searchRepository.getEntityIndexMap())
        .thenReturn(Map.of(Entity.TABLE, tables, Entity.TABLE_COLUMN, columns));

    assertEquals(
        Entity.TABLE, repair.entityTypeOfIndex("om_table_search_index_rebuild_1").orElseThrow());
    assertEquals(
        Entity.TABLE_COLUMN,
        repair.entityTypeOfIndex("om_table_column_search_index").orElseThrow());
  }

  private void givenMatches(final String... hits) throws Exception {
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchClient.rawSearchRequest(eq("POST"), anyString(), anyString()))
        .thenReturn(
            new RawSearchResponse(
                200,
                "{\"_scroll_id\":\"s1\",\"hits\":{\"hits\":[" + String.join(",", hits) + "]}}"))
        .thenReturn(NO_MORE_HITS);
    when(searchClient.rawSearchRequest(eq("DELETE"), anyString(), anyString()))
        .thenReturn(new RawSearchResponse(200, "{}"));
  }

  private static MockedStatic<Entity> registeredTypes() {
    final MockedStatic<Entity> entity = mockStatic(Entity.class);
    entity.when(() -> Entity.hasEntityRepository(Entity.TABLE)).thenReturn(true);
    entity.when(() -> Entity.hasEntityRepository("entityReportData")).thenReturn(false);
    return entity;
  }

  private static String entityHit(final String index, final UUID id) {
    return "{\"_index\":\""
        + index
        + "\",\"_id\":\""
        + id
        + "\",\"_source\":{\"entityType\":\"table\"}}";
  }

  private static String columnHit(final String columnId, final String tableId) {
    return "{\"_index\":\"table_column_search_index\",\"_id\":\""
        + columnId
        + "\",\"_source\":{\"entityType\":\"tableColumn\",\"table\":{\"id\":\""
        + tableId
        + "\"}}}";
  }

  private static EntityReference reference(final UUID id, final String type) {
    return new EntityReference().withId(id).withType(type);
  }
}

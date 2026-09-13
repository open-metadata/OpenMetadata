package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.CHART;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

class EntityHierarchyTest {
  private final UUID parentId = UUID.randomUUID();
  private final UUID chartId = UUID.randomUUID();
  private final UUID tableId = UUID.randomUUID();
  private final UUID unrelatedId = UUID.randomUUID();
  private final UUID timeSeriesId = UUID.randomUUID();
  private final Map<UUID, Boolean> deleted = new HashMap<>();
  private final EntityRelationshipDAO relationships = mock(EntityRelationshipDAO.class);
  private int batches;

  @ParameterizedTest
  @EnumSource(EntityHierarchy.Action.class)
  void walksOnlyTheOwningTypesChildrenAndRetainsTimeSeriesRows(EntityHierarchy.Action action) {
    final boolean initial = action == EntityHierarchy.Action.RESTORE;
    List.of(chartId, tableId, unrelatedId, timeSeriesId).forEach(id -> deleted.put(id, initial));
    when(relationships.findToBatchAllTypes(any(), any(), any()))
        .thenReturn(
            List.of(
                relationship(DASHBOARD, CHART, chartId),
                relationship(DASHBOARD, TABLE, tableId),
                relationship(TABLE, CHART, unrelatedId),
                relationship(DASHBOARD, TEST_CASE_RESOLUTION_STATUS, timeSeriesId)));

    hierarchy((parents, children, actor) -> children)
        .walk(List.of(new Dashboard().withId(parentId)), action, "editor");

    assertEquals(2, batches);
    assertEquals(initial, deleted.get(unrelatedId));
    assertEquals(initial, deleted.get(timeSeriesId));
    if (action == EntityHierarchy.Action.HARD_DELETE) {
      assertFalse(deleted.containsKey(chartId));
      assertFalse(deleted.containsKey(tableId));
    } else {
      assertEquals(!initial, deleted.get(chartId));
      assertEquals(!initial, deleted.get(tableId));
    }
  }

  @Test
  void hardDeletePreparationCanPreserveSharedChildren() {
    deleted.put(chartId, false);
    deleted.put(tableId, false);
    when(relationships.findToBatchAllTypes(any(), any(), any()))
        .thenReturn(
            List.of(
                relationship(DASHBOARD, CHART, chartId), relationship(DASHBOARD, TABLE, tableId)));
    hierarchy(
            (parents, children, actor) ->
                children.stream().filter(child -> !CHART.equals(child.getToEntity())).toList())
        .walk(
            List.of(new Dashboard().withId(parentId)),
            EntityHierarchy.Action.HARD_DELETE,
            "editor");
    assertEquals(Map.of(chartId, false), deleted);
  }

  @Test
  void restoresChildrenOfMultipleTypesThroughTheSameDispatchBoundary() {
    deleted.put(chartId, true);
    deleted.put(tableId, true);
    when(relationships.findTo(any(), any(), any()))
        .thenReturn(
            List.of(
                EntityRelationshipRecord.builder().id(chartId).type(CHART).build(),
                EntityRelationshipRecord.builder().id(tableId).type(TABLE).build()));
    hierarchy((parents, children, actor) -> children).restoreChildren(parentId, "editor");
    assertEquals(Map.of(chartId, false, tableId, false), deleted);
    assertEquals(2, batches);
  }

  @Test
  void leafLevelsDoNotResolveOrDispatchAnotherSubtree() {
    when(relationships.findTo(any(), any(), any())).thenReturn(List.of());
    when(relationships.findToBatchAllTypes(any(), any(), any())).thenReturn(List.of());
    final var hierarchy = hierarchy((parents, children, actor) -> children);
    hierarchy.restoreChildren(parentId, "editor");
    hierarchy.deleteChildren(List.of(), true, "editor");
    hierarchy.walk(
        List.of(new Dashboard().withId(parentId)), EntityHierarchy.Action.RESTORE, "editor");
    assertTrue(deleted.isEmpty());
    assertEquals(0, batches);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void directChildDeletionRetainsTimeSeriesAndDispatchesByEntityType(boolean hardDelete) {
    List.of(chartId, tableId, timeSeriesId).forEach(id -> deleted.put(id, false));
    hierarchy((parents, children, actor) -> children)
        .deleteChildren(
            List.of(
                EntityRelationshipRecord.builder().id(chartId).type(CHART).build(),
                EntityRelationshipRecord.builder().id(tableId).type(TABLE).build(),
                EntityRelationshipRecord.builder()
                    .id(timeSeriesId)
                    .type(TEST_CASE_RESOLUTION_STATUS)
                    .build()),
            hardDelete,
            "editor");
    assertEquals(2, batches);
    assertFalse(deleted.get(timeSeriesId));
    if (hardDelete) {
      assertEquals(Map.of(timeSeriesId, false), deleted);
    } else {
      assertTrue(deleted.get(chartId));
      assertTrue(deleted.get(tableId));
    }
  }

  private EntityHierarchy<Dashboard> hierarchy(EntityHierarchy.HardDeletePolicy<Dashboard> policy) {
    final var registry =
        new EntityHierarchy.Registry(
            type ->
                new EntitySubtree() {
                  @Override
                  public void bulkRestoreSubtree(List<UUID> ids, String actor) {
                    batches++;
                    ids.forEach(id -> deleted.put(id, false));
                  }

                  @Override
                  public void bulkSoftDeleteSubtree(List<UUID> ids, String actor) {
                    batches++;
                    ids.forEach(id -> deleted.put(id, true));
                  }

                  @Override
                  public void bulkHardDeleteSubtree(List<UUID> ids, String actor) {
                    batches++;
                    ids.forEach(deleted::remove);
                  }
                },
            TEST_CASE_RESOLUTION_STATUS::equals);
    return new EntityHierarchy<>(DASHBOARD, () -> relationships, registry, policy);
  }

  private EntityRelationshipObject relationship(String fromType, String toType, UUID childId) {
    return EntityRelationshipObject.builder()
        .fromId(parentId.toString())
        .fromEntity(fromType)
        .toId(childId.toString())
        .toEntity(toType)
        .build();
  }
}

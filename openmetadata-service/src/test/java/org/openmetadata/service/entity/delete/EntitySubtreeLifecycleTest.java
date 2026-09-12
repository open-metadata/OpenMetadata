package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.TABLE;

import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.entity.write.EntityDeferredUpdate;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;

class EntitySubtreeLifecycleTest {
  private final Map<UUID, Table> rows = new LinkedHashMap<>();
  private final List<UUID> traversed = new ArrayList<>();
  private final List<UUID> reconciled = new ArrayList<>();
  private final List<UUID> guarded = new ArrayList<>();
  private final List<UUID> hardDeleted = new ArrayList<>();
  private final List<Table> history = new ArrayList<>();
  private boolean protectedEntity;
  private int commits;

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void changesOnlyEligibleRowsButReconcilesEveryParent(boolean restoring) {
    final Table changed = seed(restoring);
    final Table unchanged = seed(!restoring);
    change(service(true), new ArrayList<>(rows.keySet()), restoring);
    assertEquals(!restoring, rows.get(changed.getId()).getDeleted());
    assertEquals(!restoring, rows.get(unchanged.getId()).getDeleted());
    assertEquals(List.of(changed), history);
    assertEquals(1, commits);
    assertEquals(new ArrayList<>(rows.keySet()), traversed);
    assertEquals(traversed, reconciled);
    assertEquals(restoring ? List.of() : List.of(changed.getId()), guarded);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void unchangedParentsStillTraverseAndReconcileWithoutWrites(boolean restoring) {
    final Table unchanged = seed(!restoring);
    change(service(true), List.of(unchanged.getId()), restoring);
    assertEquals(List.of(unchanged.getId()), traversed);
    assertEquals(traversed, reconciled);
    assertTrue(history.isEmpty());
    assertEquals(0, commits);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void emptyAndMissingInputsDoNotStartSubtreeWork(boolean restoring) {
    final var service = service(true);
    change(service, null, restoring);
    change(service, List.of(), restoring);
    change(service, List.of(UUID.randomUUID()), restoring);
    assertTrue(traversed.isEmpty());
    assertTrue(reconciled.isEmpty());
    assertTrue(history.isEmpty());
    assertEquals(0, commits);
  }

  @Test
  void unsupportedSoftDeleteRetainsPerEntityFallback() {
    final Table entity = seed(false);
    service(false).bulkSoftDeleteSubtree(List.of(entity.getId()), "editor");
    assertEquals(List.of(entity.getId()), hardDeleted);
    assertTrue(rows.isEmpty());
    assertTrue(traversed.isEmpty());
    assertTrue(reconciled.isEmpty());
    assertTrue(history.isEmpty());
  }

  @Test
  void protectedParentFailsBeforeTraversingOrWritingAnyRows() {
    final Table entity = seed(false);
    protectedEntity = true;
    assertThrows(
        IllegalArgumentException.class,
        () -> service(true).bulkSoftDeleteSubtree(List.of(entity.getId()), "editor"));
    assertEquals(entity, rows.get(entity.getId()));
    assertTrue(traversed.isEmpty());
    assertTrue(reconciled.isEmpty());
    assertTrue(history.isEmpty());
  }

  private EntitySubtree service(boolean supportsSoftDelete) {
    final var options =
        new EntitySubtreeLifecycle.Loading<Table>(
            supportsSoftDelete,
            ids -> ids.stream().filter(rows::containsKey).map(rows::get).toList());
    final var hooks =
        new EntitySubtreeLifecycle.Hooks<Table>(
            (entity, actor) -> {
              if (protectedEntity) {
                throw new IllegalArgumentException("System entity");
              }
              guarded.add(entity.getId());
            },
            (id, actor) -> reconciled.add(id),
            (id, actor) -> reconciled.add(id),
            (id, actor) -> {
              rows.remove(id);
              hardDeleted.add(id);
            });
    return new EntitySubtreeLifecycle<>(options, hooks, hierarchy(), updates(), this::purge);
  }

  @Test
  void nativeHardDeletionUsesTheExistingPurgeBoundary() {
    final Table first = seed(false);
    final Table second = seed(true);
    service(true).bulkHardDeleteSubtree(List.of(second.getId(), first.getId()), "editor");
    assertEquals(List.of(second.getId(), first.getId()), hardDeleted);
    assertTrue(rows.isEmpty());
    assertTrue(traversed.isEmpty());
    assertTrue(history.isEmpty());
  }

  private void purge(final List<UUID> ids, final String actor) {
    assertEquals("editor", actor);
    ids.forEach(rows::remove);
    hardDeleted.addAll(ids);
  }

  private EntityHierarchy<Table> hierarchy() {
    final var relationships = mock(EntityRelationshipDAO.class);
    when(relationships.findToBatchAllTypes(anyList(), anyList(), any()))
        .thenAnswer(
            invocation -> {
              final List<String> ids = invocation.getArgument(0);
              ids.forEach(id -> traversed.add(UUID.fromString(id)));
              return List.of();
            });
    return new EntityHierarchy<>(
        TABLE,
        () -> relationships,
        new EntityHierarchy.Registry(
            type -> {
              throw new AssertionError("Leaf has no descendants");
            },
            type -> false),
        (parents, children, actor) -> children);
  }

  private EntitySubtreeUpdates<Table> updates() {
    final var writes =
        new EntitySubtreeUpdates.Rows<Table>(
            history::addAll,
            entities -> entities.forEach(entity -> rows.put(entity.getId(), entity)),
            work -> {
              final var result = work.get();
              commits++;
              return result;
            });
    return new EntitySubtreeUpdates<>(
        new EntitySubtreeUpdates.Preparation<>(Table.class, entities -> {}),
        (original, updated, mode) -> new StateChange(original, updated, mode),
        writes,
        new EntitySubtreeUpdates.Effects<>(entities -> {}, entities -> {}, () -> {}, Runnable::run),
        Clock.systemUTC());
  }

  private Table seed(boolean deleted) {
    final Table entity = new Table().withId(UUID.randomUUID()).withDeleted(deleted);
    rows.put(entity.getId(), entity);
    return entity;
  }

  private void change(EntitySubtree service, List<UUID> ids, boolean restoring) {
    if (restoring) {
      service.bulkRestoreSubtree(ids, "editor");
    } else {
      service.bulkSoftDeleteSubtree(ids, "editor");
    }
  }

  private record StateChange(Table getOriginal, Table getUpdated, EntitySubtreeUpdates.Mode mode)
      implements EntityDeferredUpdate<Table> {
    @Override
    public boolean isVersionChanged() {
      return true;
    }

    @Override
    public boolean isEntityChanged() {
      return true;
    }

    @Override
    public void updateWithDeferredStore() {
      getUpdated.setDeleted(mode == EntitySubtreeUpdates.Mode.SOFT_DELETE);
    }
  }
}

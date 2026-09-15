package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;

class EntityUpdateSnapshotTest {
  @Test
  void firstAttemptPreservesCallerObjectsAndDoesNotRestoreTheirContents() {
    final var original = new Table().withDescription("original");
    final var updated = new Table().withDescription("updated");
    final var state = new MutationState<>(original, updated);
    final var snapshot = new EntityUpdateSnapshot<>(state, Table.class);
    updated.setDescription("prepared");
    snapshot.restore(state, false);
    assertSame(original, state.getOriginal());
    assertSame(updated, state.getUpdated());
    assertEquals("prepared", state.getUpdated().getDescription());
    assertNull(state.getPrevious());
    assertNull(state.getChangeDescription());
    assertNull(state.getIncrementalChangeDescription());
    assertNull(state.getPatchedFields());
    assertFalse(state.isEntityChanged());
  }

  @Test
  void everyRetryRestoresEntitiesChangesFlagsAndPrivateCopies() {
    final var original = new Table().withDescription("original");
    final var updated = new Table().withDescription("updated");
    final var state = populated(original, updated);
    final var snapshot = new EntityUpdateSnapshot<>(state, Table.class);
    for (int attempt = 0; attempt < 2; attempt++) {
      mutate(state);
      snapshot.restore(state, true);
      assertSame(original, state.getOriginal());
      assertSame(updated, state.getUpdated());
      assertEquals("original", original.getDescription());
      assertEquals("updated", updated.getDescription());
      assertEquals("previous", state.getPrevious().getDescription());
      assertRestoredChanges(state);
    }
  }

  private static MutationState<Table> populated(Table original, Table updated) {
    final var state = new MutationState<>(original, updated);
    state.setPrevious(new Table().withDescription("previous"));
    state.setChangeDescription(new ChangeDescription());
    state.setIncrementalChangeDescription(new ChangeDescription());
    state.setPatchedFields(Set.of("description"));
    state.setEntityChanged(true);
    state.setVersionChanged(true);
    state.setEntityStored(true);
    state.setMajorVersionChange(true);
    return state;
  }

  private static void mutate(MutationState<Table> state) {
    state.getOriginal().setDescription("mutated");
    state.getUpdated().setDescription("mutated");
    state.getPrevious().setDescription("mutated");
    state.setOriginal(new Table());
    state.setUpdated(new Table());
    state.getChangeDescription().getFieldsAdded().add(new FieldChange().withName("description"));
    state
        .getIncrementalChangeDescription()
        .getFieldsDeleted()
        .add(new FieldChange().withName("owners"));
    state.setPatchedFields(Set.of("owners"));
    state.setEntityChanged(false);
    state.setVersionChanged(false);
    state.setEntityStored(false);
    state.setMajorVersionChange(false);
  }

  private static void assertRestoredChanges(MutationState<Table> state) {
    assertTrue(state.getChangeDescription().getFieldsAdded().isEmpty());
    assertTrue(state.getIncrementalChangeDescription().getFieldsDeleted().isEmpty());
    assertEquals(Set.of("description"), state.getPatchedFields());
    assertTrue(state.isEntityChanged());
    assertTrue(state.isVersionChanged());
    assertTrue(state.isEntityStored());
    assertTrue(state.isMajorVersionChange());
  }
}

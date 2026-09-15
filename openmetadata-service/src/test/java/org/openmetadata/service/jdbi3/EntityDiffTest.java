package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.LifeCycle;

class EntityDiffTest {
  @Test
  void scalarChangesPreserveAddedDeletedAndJsonValueContracts() {
    final var changes = new ChangeDescription();
    assertTrue(EntityDiff.value(changes, "description", null, "new", false, Objects::equals, true));
    assertTrue(
        EntityDiff.value(
            changes, "style", Map.of("iconURL", "old"), null, true, Objects::equals, true));
    assertTrue(
        EntityDiff.value(changes, "displayName", "old", "new", false, Objects::equals, true));
    assertEquals("new", changes.getFieldsAdded().getFirst().getNewValue());
    assertEquals("{\"iconURL\":\"old\"}", changes.getFieldsDeleted().getFirst().getOldValue());
    assertEquals("old", changes.getFieldsUpdated().getFirst().getOldValue());
    assertEquals("new", changes.getFieldsUpdated().getFirst().getNewValue());
  }

  @Test
  void equalityAndUnversionedChangesDoNotPolluteHistory() {
    final var changes = new ChangeDescription();
    assertFalse(EntityDiff.value(changes, "description", null, null, false, Objects::equals, true));
    assertFalse(
        EntityDiff.value(
            changes, "description", new String("same"), "same", false, Objects::equals, true));
    assertTrue(EntityDiff.value(changes, "lifeCycle", 1, 2, true, Objects::equals, false));
    assertFalse(EntityVersionPolicy.hasChanges(changes));
    assertEquals(0.2, EntityVersionPolicy.next(0.2, changes, false));
  }

  @Test
  void listDiffReportsOnlyIdentityChangesWithoutMutatingInputs() {
    final var before = List.of("a", "b");
    final var after = List.of("b", "c");
    final List<String> added = new ArrayList<>();
    final List<String> deleted = new ArrayList<>();
    final var changes = new ChangeDescription();
    assertTrue(EntityDiff.list(changes, "tags", before, after, added, deleted, Objects::equals));
    assertEquals(List.of("c"), added);
    assertEquals(List.of("a"), deleted);
    assertEquals("[\"c\"]", changes.getFieldsAdded().getFirst().getNewValue());
    assertEquals("[\"a\"]", changes.getFieldsDeleted().getFirst().getOldValue());
    assertEquals(List.of("a", "b"), before);
    assertEquals(List.of("b", "c"), after);
  }

  @Test
  void lifecycleKeepsLatestAccessDetailsWithoutChangingEitherSnapshot() {
    final var original =
        new LifeCycle().withCreated(access(20)).withUpdated(access(30)).withAccessed(access(40));
    final var requested = new LifeCycle().withCreated(access(10)).withUpdated(access(50));
    final var resolved = EntityDiff.lifeCycle(original, requested, false);
    assertEquals(20L, resolved.getCreated().getTimestamp());
    assertEquals(50L, resolved.getUpdated().getTimestamp());
    assertEquals(40L, resolved.getAccessed().getTimestamp());
    assertEquals(10L, requested.getCreated().getTimestamp());
    assertNull(requested.getAccessed());
    assertEquals(30L, original.getUpdated().getTimestamp());
    assertSame(original, EntityDiff.lifeCycle(original, null, true));
    assertNull(EntityDiff.lifeCycle(original, null, false));
    assertSame(requested, EntityDiff.lifeCycle(null, requested, false));
  }

  private AccessDetails access(long timestamp) {
    return new AccessDetails().withTimestamp(timestamp);
  }
}

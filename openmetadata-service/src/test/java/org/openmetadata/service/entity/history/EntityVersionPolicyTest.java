package org.openmetadata.service.entity.history;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;

class EntityVersionPolicyTest {
  @ParameterizedTest
  @MethodSource("versions")
  void choosesVersionAndRetainsChangeDescription(boolean major, boolean changed, double expected) {
    final var changes = new ChangeDescription();
    if (changed) {
      changes.setFieldsUpdated(List.of(new FieldChange().withName("description")));
    }
    final var updated = new Table();
    assertEquals(
        expected != 1.1,
        EntityVersionPolicy.updateVersion(new Table(), updated, changes, 1.1, major));
    assertEquals(expected, updated.getVersion());
    assertEquals(1.1, changes.getPreviousVersion());
    assertSame(changes, updated.getChangeDescription());
  }

  private static Stream<Arguments> versions() {
    return Stream.of(
        Arguments.of(false, false, 1.1),
        Arguments.of(false, true, 1.2),
        Arguments.of(true, false, 2.1),
        Arguments.of(true, true, 2.1));
  }

  @Test
  void consolidationRequiresMatchingPreviousVersion() {
    final var previous = new Table().withVersion(1.0);
    assertFalse(EntityVersionPolicy.isConsolidating(null, null));
    assertFalse(EntityVersionPolicy.isConsolidating(previous, null));
    assertFalse(EntityVersionPolicy.isConsolidating(previous, new ChangeDescription()));
    assertFalse(
        EntityVersionPolicy.isConsolidating(
            previous, new ChangeDescription().withPreviousVersion(0.9)));
    assertTrue(
        EntityVersionPolicy.isConsolidating(
            previous, new ChangeDescription().withPreviousVersion(1.0)));
  }

  @Test
  void noOpRestoresActorTimeAndPreviousChangeDescription() {
    final var original = original();
    final var updated = new Table().withUpdatedBy("new").withUpdatedAt(20L);
    EntityVersionPolicy.retainUnversionedAudit(original, updated, new ChangeDescription(), false);
    assertEquals("before", updated.getUpdatedBy());
    assertEquals(10L, updated.getUpdatedAt());
    assertSame(original.getChangeDescription(), updated.getChangeDescription());
  }

  @Test
  void unversionedChangeRetainsNewAuditButOnlyRestoresMatchingVersionDescription() {
    final var original = original();
    final var changes = new ChangeDescription().withPreviousVersion(1.0);
    final var updated =
        new Table()
            .withVersion(1.1)
            .withUpdatedBy("new")
            .withUpdatedAt(20L)
            .withChangeDescription(changes);
    EntityVersionPolicy.retainUnversionedAudit(original, updated, changes, true);
    assertSame(changes, updated.getChangeDescription());
    updated.setVersion(1.0);
    EntityVersionPolicy.retainUnversionedAudit(original, updated, changes, true);
    assertSame(original.getChangeDescription(), updated.getChangeDescription());
    assertEquals("new", updated.getUpdatedBy());
    assertEquals(20L, updated.getUpdatedAt());
  }

  private static Table original() {
    return new Table()
        .withUpdatedBy("before")
        .withUpdatedAt(10L)
        .withChangeDescription(new ChangeDescription());
  }
}

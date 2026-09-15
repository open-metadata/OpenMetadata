package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.EntityReferenceChange.Mode.IMPORT_OWNERS;
import static org.openmetadata.service.jdbi3.EntityReferenceChange.Mode.REPLACE;
import static org.openmetadata.service.jdbi3.EntityReferenceChange.Mode.REPLACE_IF_NONEMPTY;
import static org.openmetadata.service.jdbi3.EntityReferenceChange.Mode.RETAIN;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityReferenceChange.Mode;

class EntityReferenceChangeTest {
  private final EntityReference first = reference("first");
  private final EntityReference second = reference("second");
  private final EntityReference inherited = reference("inherited").withInherited(true);

  @Test
  void comparesIdentityWithoutMutatingOrReorderingReferences() {
    final var renamed =
        new EntityReference().withId(first.getId()).withType(first.getType()).withName("renamed");
    final var original = List.of(first, second, inherited);
    final var requested = List.of(second, renamed);
    final var change = EntityReferenceChange.reconcile(original, requested, REPLACE, true);

    assertFalse(change.changed());
    assertSame(original, change.updated());
    assertEquals(List.of(first, second), change.original());
    assertEquals(List.of(second, renamed), requested);
    assertEquals("first", first.getName());
    assertTrue(inherited.getInherited());
  }

  @Test
  void recordsOnlyExplicitReferencesAndPreservesOrderAndMultiplicity() {
    final var change =
        EntityReferenceChange.reconcile(
            List.of(first, inherited), List.of(inherited, second, second), REPLACE, true);

    assertEquals(List.of(first), change.original());
    assertEquals(List.of(second, second), change.updated());
    assertEquals(List.of(second, second), change.added());
    assertEquals(List.of(first), change.deleted());
  }

  @Test
  void referenceTypeIsPartOfIdentity() {
    final var team = new EntityReference().withId(first.getId()).withType("team");
    final var change =
        EntityReferenceChange.reconcile(List.of(first), List.of(team), REPLACE, true);

    assertEquals(List.of(team), change.added());
    assertEquals(List.of(first), change.deleted());
  }

  @Test
  void putCannotRemoveExplicitReferences() {
    final var original = List.of(first, inherited);
    for (final List<EntityReference> requested :
        List.of(List.<EntityReference>of(), List.of(inherited))) {
      final var change =
          EntityReferenceChange.reconcile(original, requested, REPLACE_IF_NONEMPTY, true);
      assertFalse(change.changed());
      assertSame(original, change.updated());
    }
    assertSame(
        original,
        EntityReferenceChange.reconcile(original, null, REPLACE_IF_NONEMPTY, true).updated());
  }

  @ParameterizedTest
  @EnumSource(
      value = Mode.class,
      names = {"REPLACE", "REPLACE_IF_NONEMPTY", "IMPORT_OWNERS"})
  void selectedNonemptyRequestReplacesLocalReferences(Mode mode) {
    final var change =
        EntityReferenceChange.reconcile(List.of(first, inherited), List.of(second), mode, true);
    assertTrue(change.changed());
    assertEquals(List.of(first), change.deleted());
    assertEquals(List.of(second), change.updated());
  }

  @ParameterizedTest
  @EnumSource(
      value = Mode.class,
      names = {"REPLACE", "IMPORT_OWNERS"})
  void patchAndImportCanRemoveExplicitReferences(Mode mode) {
    final var change = EntityReferenceChange.reconcile(List.of(first, inherited), null, mode, true);
    assertEquals(List.of(first), change.deleted());
    assertEquals(List.of(), change.updated());
  }

  @Test
  void deniedBotPreservesOwnersWithoutInspectingTheRequest() {
    final var original = List.of(first, inherited);
    final var change =
        EntityReferenceChange.reconcile(original, Collections.singletonList(null), RETAIN, true);
    assertFalse(change.changed());
    assertSame(original, change.updated());
  }

  @ParameterizedTest
  @EnumSource(Mode.class)
  void unselectedFieldIsNotCompared(Mode mode) {
    final var original = List.of(first, inherited);
    final var change =
        EntityReferenceChange.reconcile(original, Collections.singletonList(null), mode, false);
    assertFalse(change.changed());
    assertEquals(mode == IMPORT_OWNERS ? List.of(first) : original, change.updated());
  }

  @Test
  void onlyOwnerImportDropsInheritedReferencesOnAnUnchangedRequest() {
    final var original = List.of(first, inherited);
    assertEquals(
        List.of(first),
        EntityReferenceChange.reconcile(original, List.of(first), IMPORT_OWNERS, true).updated());
    assertSame(
        original,
        EntityReferenceChange.reconcile(original, List.of(first), REPLACE, true).updated());
  }

  @ParameterizedTest
  @EnumSource(Mode.class)
  void emptyInputsDoNotCreateChanges(Mode mode) {
    final var change = EntityReferenceChange.reconcile(null, null, mode, true);
    assertFalse(change.changed());
    if (mode == IMPORT_OWNERS) {
      assertEquals(List.of(), change.updated());
    } else {
      assertNull(change.updated());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"owners", "domains"})
  void sessionReplacementHasSeparateIncrementalAndHistoricalDescriptions(String field) {
    final var incremental = new ChangeDescription();
    final var historical = new ChangeDescription();
    EntityReferenceChange.reconcile(List.of(first), List.of(second), REPLACE, true)
        .recordIn(incremental, field);
    EntityReferenceChange.reconcile(List.of(), List.of(second), REPLACE, true)
        .recordIn(historical, field);

    assertEquals(
        JsonUtils.pojoToJson(List.of(first)),
        incremental.getFieldsDeleted().getFirst().getOldValue());
    assertEquals(
        JsonUtils.pojoToJson(List.of(second)),
        incremental.getFieldsAdded().getFirst().getNewValue());
    assertEquals(field, historical.getFieldsAdded().getFirst().getName());
    assertTrue(historical.getFieldsDeleted().isEmpty());
    assertEquals(0.2, EntityVersionPolicy.next(0.1, historical, false));
  }

  @ParameterizedTest
  @ValueSource(strings = {"owners", "domains"})
  void cancellationStillChangesTheCurrentStateWithoutCreatingAHistoricalVersion(String field) {
    final var incremental = new ChangeDescription();
    final var historical = new ChangeDescription();
    EntityReferenceChange.reconcile(List.of(second), List.of(), REPLACE, true)
        .recordIn(incremental, field);
    EntityReferenceChange.reconcile(List.of(), List.of(), REPLACE, true)
        .recordIn(historical, field);

    assertTrue(EntityVersionPolicy.hasChanges(incremental));
    assertFalse(EntityVersionPolicy.hasChanges(historical));
    assertEquals(0.1, EntityVersionPolicy.next(0.1, historical, false));
  }

  private EntityReference reference(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType("user").withName(name);
  }
}

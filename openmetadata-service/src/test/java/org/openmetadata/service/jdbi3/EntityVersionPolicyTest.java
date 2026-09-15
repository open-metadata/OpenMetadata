package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.service.jdbi3.EntityRepository.Operation;

class EntityVersionPolicyTest {
  @Test
  void retainsVersionWithoutChanges() {
    assertFalse(EntityVersionPolicy.hasChanges(null));
    assertEquals(0.1, EntityVersionPolicy.next(0.1, null, false));
    assertEquals(1.9, EntityVersionPolicy.next(1.9, new ChangeDescription(), false));
  }

  @Test
  void addedUpdatedAndDeletedFieldsEachAdvanceOneMinorVersion() {
    final var fields = List.of(new FieldChange().withName("owners"));
    for (final var changes :
        List.of(
            new ChangeDescription().withFieldsAdded(fields),
            new ChangeDescription().withFieldsUpdated(fields),
            new ChangeDescription().withFieldsDeleted(fields))) {
      assertEquals(2.0, EntityVersionPolicy.next(1.9, changes, false));
    }
  }

  @Test
  void majorChangeTakesPrecedenceEvenWithoutRecordedFields() {
    assertEquals(2.9, EntityVersionPolicy.next(1.9, new ChangeDescription(), true));
    assertEquals(
        3.0,
        EntityVersionPolicy.next(
            2.0, new ChangeDescription().withFieldsAdded(List.of(new FieldChange())), true));
  }

  @Test
  void consolidationUsesAnInclusiveSessionWindowAndTheSameActor() {
    final var original = snapshot();
    final var updated = snapshot().withUpdatedAt(1_100L);
    assertTrue(consolidates(original, updated));
    assertFalse(consolidates(original, updated.withUpdatedAt(1_101L)));
    assertFalse(consolidates(original, updated.withUpdatedAt(1_000L).withUpdatedBy("other")));
    assertTrue(consolidates(original, updated.withUpdatedBy("actor")));
  }

  @Test
  void firstUpdatesMissingHistoryDeletionAndOptimisticWritesStartNewVersions() {
    assertFalse(consolidates(snapshot().withVersion(0.1), snapshot()));
    assertFalse(consolidates(snapshot().withChangeDescription(null), snapshot()));
    assertFalse(
        consolidates(
            snapshot().withChangeDescription(new ChangeDescription().withPreviousVersion(null)),
            snapshot()));
    assertFalse(consolidates(snapshot().withDeleted(true), snapshot()));
    for (var operation : Operation.values()) {
      assertEquals(
          operation == Operation.PATCH,
          EntityVersionPolicy.consolidates(
              snapshot(), snapshot(), "table", operation, null, false, 100));
    }
    assertFalse(
        EntityVersionPolicy.consolidates(
            snapshot(), snapshot(), "table", Operation.PATCH, null, true, 100));
  }

  @Test
  void renameOrAnEarlierMoveKeepsTheHistoricalFqnOutOfCurrentWrites() {
    assertFalse(consolidates(snapshot(), snapshot().withName("renamed")));
    for (String field : List.of("name", "parent", "glossary")) {
      for (var changes : changedFields(field)) {
        for (boolean incremental : List.of(false, true)) {
          final var original = snapshot();
          if (incremental) {
            original.setIncrementalChangeDescription(changes);
          } else {
            original.setChangeDescription(changes.withPreviousVersion(0.1));
          }
          assertFalse(
              EntityVersionPolicy.consolidates(
                  original, snapshot(), "glossaryTerm", Operation.PATCH, null, false, 100));
          assertEquals(!field.equals("name"), consolidates(original, snapshot()));
        }
      }
    }
  }

  @Test
  void fieldChangesDoNotDisableConsolidation() {
    for (var changes : changedFields("description")) {
      assertTrue(
          consolidates(
              snapshot().withChangeDescription(changes.withPreviousVersion(0.1)), snapshot()));
    }
    assertTrue(consolidates(snapshot().withDeleted(null), snapshot()));
  }

  @Test
  void changeSourceRetainsTheExistingLatestDifferentSourceRule() {
    final var summary =
        new ChangeSummaryMap()
            .withAdditionalProperty("description", source(ChangeSource.MANUAL, 200))
            .withAdditionalProperty("owners", source(ChangeSource.AUTOMATED, 100));
    final var original = snapshot();
    original.getChangeDescription().setChangeSummary(summary);
    assertFalse(consolidates(original, ChangeSource.MANUAL));
    assertTrue(consolidates(original, ChangeSource.AUTOMATED));
    assertTrue(consolidates(original, (ChangeSource) null));
    summary.setAdditionalProperty("owners", source(ChangeSource.AUTOMATED, 200));
    assertTrue(consolidates(original, ChangeSource.MANUAL));
    assertFalse(consolidates(original, ChangeSource.AUTOMATED));
    summary.setAdditionalProperty("owners", source(null, 300));
    assertTrue(consolidates(original, (ChangeSource) null));
    original.getChangeDescription().setChangeSummary(new ChangeSummaryMap());
    assertTrue(consolidates(original, ChangeSource.MANUAL));
    assertTrue(consolidates(snapshot(), ChangeSource.MANUAL));
  }

  private static boolean consolidates(Table original, Table updated) {
    return EntityVersionPolicy.consolidates(
        original, updated, "table", Operation.PATCH, null, false, 100);
  }

  private static boolean consolidates(Table original, ChangeSource source) {
    return EntityVersionPolicy.consolidates(
        original, snapshot(), "table", Operation.PATCH, source, false, 100);
  }

  private static Table snapshot() {
    return new Table()
        .withName("entity")
        .withUpdatedBy("actor")
        .withUpdatedAt(1_000L)
        .withVersion(0.2)
        .withDeleted(false)
        .withChangeDescription(new ChangeDescription().withPreviousVersion(0.1));
  }

  private static List<ChangeDescription> changedFields(String name) {
    final var fields = List.of(new FieldChange().withName(name));
    return List.of(
        new ChangeDescription().withFieldsAdded(fields),
        new ChangeDescription().withFieldsUpdated(fields),
        new ChangeDescription().withFieldsDeleted(fields));
  }

  private static ChangeSummary source(ChangeSource source, long timestamp) {
    return new ChangeSummary().withChangeSource(source).withChangedAt(timestamp);
  }
}

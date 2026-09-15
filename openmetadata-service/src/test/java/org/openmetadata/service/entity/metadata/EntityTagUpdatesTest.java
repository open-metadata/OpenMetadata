package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.entity.metadata.TagMutationFixture.tag;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.write.EntityChangeRecorder;

class EntityTagUpdatesTest {
  private static final String TARGET = "service.database.schema.table";
  private static final String FIELD = "tags";

  @Test
  void putMergesAndSortsWithoutRewritingExistingTags() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel original = tag("First.Value").withAppliedBy("human");
    final TagLabel added = tag("Second.Value");
    final List<TagLabel> updated = new ArrayList<>(List.of(added));
    fixture.seed(TARGET, List.of(original));
    fixture.updater.update(fixture, TARGET, FIELD, List.of(original), updated);
    assertEquals(List.of(original, added), updated);
    assertEquals("human", fixture.stored(TARGET, original).getAppliedBy());
    assertEquals("ingestion-bot", fixture.stored(TARGET, added).getAppliedBy());
    assertEquals(1, fixture.writes);
    assertTrue(fixture.published.isEmpty());
    fixture.commitEffects();
    assertEquals(
        List.of(added),
        fixture.published.stream().map(TagMutationFixture.Publication::tag).toList());
    assertEquals(
        JsonUtils.pojoToJson(List.of(added)),
        fixture.changes.getFieldsAdded().getFirst().getNewValue());
  }

  @Test
  void unchangedPutKeepsStoredAttributionWithoutAnySqlOrRdfWork() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel original = tag("First.Value").withAppliedBy("human");
    fixture.seed(TARGET, List.of(original));
    fixture.updater.update(
        fixture, TARGET, FIELD, List.of(original), new ArrayList<>(List.of(tag("First.Value"))));
    assertEquals(0, fixture.writes);
    assertEquals("human", fixture.stored(TARGET, original).getAppliedBy());
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
    assertTrue(fixture.deferred.isEmpty());
  }

  @Test
  void patchAndNonemptyOverrideReplaceTags() {
    for (final boolean put : List.of(false, true)) {
      final TagMutationFixture fixture = new TagMutationFixture();
      fixture.put = put;
      fixture.override = true;
      final TagLabel original = tag("First.Value");
      final TagLabel updated = tag("Second.Value");
      fixture.seed(TARGET, List.of(original));
      fixture.updater.update(
          fixture, TARGET, FIELD, List.of(original), new ArrayList<>(List.of(updated)));
      assertNull(fixture.stored(TARGET, original));
      assertNotNull(fixture.stored(TARGET, updated));
      assertEquals(2, fixture.writes);
      assertTrue(fixture.published.isEmpty());
      fixture.commitEffects();
      assertEquals(
          List.of(false, true),
          fixture.published.stream().map(TagMutationFixture.Publication::added).toList());
    }
  }

  @Test
  void emptyForceSyncStillPreservesExistingTags() {
    final TagMutationFixture fixture = new TagMutationFixture();
    fixture.override = true;
    final TagLabel original = tag("First.Value");
    final List<TagLabel> updated = new ArrayList<>();
    fixture.updater.update(fixture, TARGET, FIELD, List.of(original), updated);
    assertEquals(List.of(original), updated);
    assertSame(original, updated.getFirst());
    assertEquals(0, fixture.writes);
  }

  @Test
  void nullPatchClearsTagsButNullPutRetainsThem() {
    for (final boolean put : List.of(false, true)) {
      final TagMutationFixture fixture = new TagMutationFixture();
      fixture.put = put;
      final TagLabel original = tag("First.Value");
      fixture.seed(TARGET, List.of(original));
      fixture.updater.update(fixture, TARGET, FIELD, List.of(original), null);
      assertEquals(put ? 1 : 0, fixture.rows.size());
      assertEquals(put ? 0 : 1, fixture.writes);
    }
  }

  @Test
  void certificationTagsStayOwnedByTheCertificationService() {
    final TagMutationFixture fixture = new TagMutationFixture();
    fixture.put = false;
    fixture.certification = "Certification";
    final TagLabel original = tag("Certification.Gold");
    final TagLabel updated = tag("Certification.Silver");
    fixture.seed(TARGET, List.of(original));
    fixture.updater.update(
        fixture, TARGET, FIELD, List.of(original), new ArrayList<>(List.of(updated)));
    assertNotNull(fixture.stored(TARGET, original));
    assertNull(fixture.stored(TARGET, updated));
    assertEquals(0, fixture.writes);
    assertTrue(EntityChangeRecorder.hasChanges(fixture.changes));
  }

  @Test
  void sourceIsPartOfTagIdentity() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel classification = tag("Same.Name");
    final TagLabel glossary = tag("Same.Name").withSource(TagLabel.TagSource.GLOSSARY);
    final List<TagLabel> updated = new ArrayList<>(List.of(glossary));
    fixture.seed(TARGET, List.of(classification));
    fixture.updater.update(fixture, TARGET, FIELD, List.of(classification), updated);
    assertEquals(2, fixture.rows.size());
    assertEquals(2, updated.size());
    assertEquals(1, fixture.writes);
  }

  @Test
  void invalidMutuallyExclusiveTagsFailBeforePersistenceAndPublication() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final IllegalArgumentException failure =
        new IllegalArgumentException("mutually exclusive tags");
    fixture.validationFailure = failure;
    assertSame(
        failure,
        assertThrows(
            IllegalArgumentException.class,
            () ->
                fixture.updater.update(
                    fixture,
                    TARGET,
                    FIELD,
                    List.of(),
                    new ArrayList<>(List.of(tag("First.Value"))))));
    assertEquals(0, fixture.writes);
    assertTrue(fixture.deferred.isEmpty());
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
  }

  @Test
  void importStillReplacesRowsAndPreservesIncomingAttribution() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel original = tag("First.Value");
    final TagLabel updated = tag("Second.Value").withAppliedBy("csv-user");
    fixture.seed(TARGET, List.of(original));
    fixture.updater.updateForImport(
        fixture, TARGET, FIELD, List.of(original), new ArrayList<>(List.of(updated)));
    assertNull(fixture.stored(TARGET, original));
    assertEquals("csv-user", fixture.stored(TARGET, updated).getAppliedBy());
    assertEquals(2, fixture.writes);
    assertTrue(fixture.published.isEmpty());
    fixture.commitEffects();
    assertEquals(
        List.of(false, true),
        fixture.published.stream().map(TagMutationFixture.Publication::added).toList());
  }

  @Test
  void emptyUpdatesNeverResolveTagStorageOrCertificationSettings() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final EntityTagUpdates updater =
        new EntityTagUpdates(
            fixture.writer,
            tags -> {
              throw new AssertionError("Empty tags need no validation");
            },
            () -> {
              throw new AssertionError("Empty tags need no certification lookup");
            });
    updater.update(fixture, TARGET, FIELD, null, null);
    updater.updateForImport(fixture, TARGET, FIELD, null, null);
    assertEquals(0, fixture.writes);
  }

  @Test
  void fieldSelectionSuppressesTheAuditButRetainsTheExistingMutationBehavior() {
    final TagMutationFixture fixture = new TagMutationFixture();
    fixture.selected = false;
    fixture.updater.update(
        fixture, TARGET, FIELD, List.of(), new ArrayList<>(List.of(tag("First.Value"))));
    assertEquals(1, fixture.rows.size());
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
  }
}

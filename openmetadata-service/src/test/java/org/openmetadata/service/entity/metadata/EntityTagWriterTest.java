package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.entity.metadata.TagMutationFixture.tag;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;

class EntityTagWriterTest {
  @Test
  void entityBatchesMergeRepeatedTargetsBeforeOneWriteAndPreservePublicationOrder() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel first = tag("First.Value");
    final TagLabel second = tag("Second.Value");
    fixture.writer.addEntities(
        List.of(
            new Table().withFullyQualifiedName(FQN).withTags(List.of(first, derived())),
            new Table().withFullyQualifiedName(FQN).withTags(List.of(second)),
            new Table().withFullyQualifiedName(FQN + ".column").withTags(List.of(first))));
    assertEquals(1, fixture.writes);
    assertNotNull(fixture.stored(FQN, first));
    assertNotNull(fixture.stored(FQN, second));
    assertNotNull(fixture.stored(FQN + ".column", first));
    assertEquals(
        List.of(FQN, FQN, FQN + ".column"),
        fixture.published.stream().map(publication -> publication.target().fqn()).toList());
  }

  @Test
  void emptyEntityTagsDoNotWriteOrPublish() {
    final TagMutationFixture fixture = new TagMutationFixture();
    fixture.writer.addEntities(List.of());
    fixture.writer.addEntities(List.of(new Table(), new Table().withTags(List.of(derived()))));
    assertEquals(0, fixture.writes);
    assertTrue(fixture.published.isEmpty());
    assertThrows(NullPointerException.class, () -> fixture.writer.addEntities(null));
  }

  @Test
  void malformedLaterEntityTagsFailBeforeAnyBatchIsPersisted() {
    final TagMutationFixture fixture = new TagMutationFixture();
    assertThrows(
        NullPointerException.class,
        () ->
            fixture.writer.addEntities(
                List.of(
                    new Table().withFullyQualifiedName(FQN).withTags(List.of(tag("First.Value"))),
                    new Table()
                        .withFullyQualifiedName(FQN + ".column")
                        .withTags(List.of(tag("Second.Value").withLabelType(null))))));
    assertEquals(0, fixture.writes);
    assertTrue(fixture.published.isEmpty());
  }

  private static final String FQN = "service.database.schema.table";
  private static final EntityTagWriter.Target TARGET =
      new EntityTagWriter.Target(FQN, "table", UUID.randomUUID());

  @Test
  void individualWritesPreserveTagMetadataAndRdfTargetIdentity() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel label =
        tag("First.Value")
            .withReason("human review")
            .withAppliedBy("reviewer")
            .withMetadata(new TagLabelMetadata());
    fixture.writer.apply(List.of(label, derived()), TARGET);
    assertEquals(1, fixture.writes);
    assertEquals(label, fixture.stored(FQN, label));
    assertEquals(
        List.of(new TagMutationFixture.Publication(true, label, TARGET)), fixture.published);
  }

  @Test
  void batchWritesAndDeletesExcludeDerivedTags() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel first = tag("First.Value");
    final TagLabel second = tag("Second.Value");
    final List<TagLabel> labels = List.of(first, derived(), second);
    fixture.writer.add(labels, TARGET);
    assertEquals(1, fixture.writes);
    assertEquals(2, fixture.rows.size());
    assertEquals(2, fixture.published.size());
    fixture.writer.delete(labels, TARGET);
    assertEquals(2, fixture.writes);
    assertTrue(fixture.rows.isEmpty());
    assertEquals(
        List.of(true, true, false, false),
        fixture.published.stream().map(TagMutationFixture.Publication::added).toList());
  }

  @Test
  void multiTargetBatchPreservesEachTargetsRdfIdentity() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel first = tag("First.Value");
    final TagLabel second = tag("Second.Value");
    fixture.writer.addMany(
        Map.of(FQN, List.of(first, derived()), FQN + ".column", List.of(second)));
    assertEquals(1, fixture.writes);
    assertNotNull(fixture.stored(FQN, first));
    assertNotNull(fixture.stored(FQN + ".column", second));
    assertEquals(2, fixture.published.size());
    assertTrue(
        fixture.published.contains(
            new TagMutationFixture.Publication(
                true, first, new EntityTagWriter.Target(FQN, null, null))));
    assertTrue(
        fixture.published.contains(
            new TagMutationFixture.Publication(
                true, second, new EntityTagWriter.Target(FQN + ".column", null, null))));
  }

  @Test
  void flushWritesDeferRdfWithAnIndependentListSnapshot() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel label = tag("First.Value");
    final List<TagLabel> labels = new ArrayList<>(List.of(label));
    fixture.writer.addInFlush(fixture, labels, FQN);
    labels.clear();
    assertNotNull(fixture.stored(FQN, label));
    assertTrue(fixture.published.isEmpty());
    fixture.commitEffects();
    assertEquals(
        List.of(
            new TagMutationFixture.Publication(
                true, label, new EntityTagWriter.Target(FQN, null, null))),
        fixture.published);
  }

  @Test
  void discardedFlushEffectsNeverReachRdf() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final TagLabel label = tag("First.Value");
    fixture.seed(FQN, List.of(label));
    fixture.writer.deleteInFlush(fixture, List.of(label), FQN);
    assertTrue(fixture.rows.isEmpty());
    assertFalse(fixture.deferred.isEmpty());
    fixture.deferred.clear();
    fixture.commitEffects();
    assertTrue(fixture.published.isEmpty());
  }

  @Test
  void databaseFailureCannotQueueRdfPublication() {
    final TagMutationFixture fixture = new TagMutationFixture();
    fixture.writeFailure = new IllegalStateException("tag write failed");
    assertSame(
        fixture.writeFailure,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.writer.addInFlush(fixture, List.of(tag("First.Value")), FQN)));
    assertTrue(fixture.deferred.isEmpty());
    assertTrue(fixture.published.isEmpty());
  }

  @Test
  void emptyAndDerivedOnlyWritesDoNoDatabaseOrRdfWork() {
    final TagMutationFixture fixture = new TagMutationFixture();
    final List<List<TagLabel>> variants = new ArrayList<>();
    variants.add(null);
    variants.add(List.of());
    variants.add(List.of(derived()));
    for (final List<TagLabel> labels : variants) {
      fixture.writer.apply(labels, TARGET);
      fixture.writer.add(labels, TARGET);
      fixture.writer.delete(labels, TARGET);
      fixture.writer.addInFlush(fixture, labels, FQN);
      fixture.writer.deleteInFlush(fixture, labels, FQN);
      fixture.writer.replaceInFlush(fixture, labels, labels, FQN);
    }
    fixture.writer.addMany(null);
    fixture.writer.addMany(Map.of());
    assertEquals(0, fixture.writes);
    assertTrue(fixture.deferred.isEmpty());
    assertTrue(fixture.published.isEmpty());
  }

  private TagLabel derived() {
    return tag("Derived.Value").withLabelType(TagLabel.LabelType.DERIVED);
  }
}

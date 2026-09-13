package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.entity.metadata.TagMutationFixture.tag;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;

class EntityColumnTagWriterTest {
  private static final String FQN = "service.database.schema.table";

  @Test
  void collectionPreservesTraversalAndReplacementOrderWithIndependentLists() {
    final var first = new ArrayList<>(List.of(tag("First.Value")));
    final var replacement = new ArrayList<>(List.of(tag("Last.Value")));
    final var targets = new LinkedHashMap<String, List<TagLabel>>();
    targets.put(FQN, first);
    EntityTagWriter.collectColumnTags(
        List.of(
            column("a", first).withChildren(List.of(column("a.child", first))),
            column("a", replacement),
            column("a", List.of()),
            column("empty", null)),
        targets);

    first.clear();
    replacement.clear();
    assertEquals(List.of(FQN, FQN + ".a", FQN + ".a.child"), List.copyOf(targets.keySet()));
    assertTrue(targets.get(FQN).isEmpty());
    assertEquals(List.of(tag("Last.Value")), targets.get(FQN + ".a"));
    assertEquals(List.of(tag("First.Value")), targets.get(FQN + ".a.child"));
  }

  @Test
  void nestedColumnsUseOneBatchAndPreserveRdfTargets() {
    final var fixture = new TagMutationFixture();
    final var first = tag("First.Value");
    final var last = tag("Last.Value");
    final var derived = tag("Derived.Value").withLabelType(TagLabel.LabelType.DERIVED);
    fixture.writer.addColumns(
        List.of(
            column("a", List.of(first))
                .withChildren(List.of(column("a.child", List.of(first, derived)))),
            column("a", List.of(last))));

    assertEquals(1, fixture.writes);
    assertNull(fixture.stored(FQN + ".a", first));
    assertNotNull(fixture.stored(FQN + ".a", last));
    assertNotNull(fixture.stored(FQN + ".a.child", first));
    assertNull(fixture.stored(FQN + ".a.child", derived));
    assertEquals(
        List.of(
            new TagMutationFixture.Publication(true, last, new EntityTagWriter.Target(FQN + ".a")),
            new TagMutationFixture.Publication(
                true, first, new EntityTagWriter.Target(FQN + ".a.child"))),
        fixture.published);
  }

  @Test
  void absentColumnTagsDoNoDatabaseOrRdfWork() {
    final var fixture = new TagMutationFixture();
    fixture.writer.addColumns(null);
    fixture.writer.addColumns(List.of());
    fixture.writer.addColumns(List.of(column("a", null), column("b", List.of())));
    final var targets = new LinkedHashMap<String, List<TagLabel>>();
    EntityTagWriter.collectColumnTags(null, targets);
    EntityTagWriter.collectColumnTags(List.of(), targets);
    assertTrue(targets.isEmpty());
    assertEquals(0, fixture.writes);
    assertTrue(fixture.published.isEmpty());
  }

  @Test
  void malformedDescendantsFailBeforeAnyColumnTagsAreStored() {
    final var fixture = new TagMutationFixture();
    final var parent = column("a", List.of(tag("First.Value")));
    parent.withChildren(Arrays.asList(column("a.child", List.of(tag("Child.Value"))), null));
    assertThrows(NullPointerException.class, () -> fixture.writer.addColumns(List.of(parent)));
    assertTrue(fixture.rows.isEmpty());
    assertTrue(fixture.published.isEmpty());
  }

  @Test
  void failedColumnBatchDoesNotPublishRdf() {
    final var fixture = new TagMutationFixture();
    fixture.writeFailure = new IllegalStateException("column batch failed");
    assertSame(
        fixture.writeFailure,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.writer.addColumns(List.of(column("a", List.of(tag("First.Value")))))));
    assertTrue(fixture.rows.isEmpty());
    assertTrue(fixture.published.isEmpty());
  }

  private Column column(final String name, final List<TagLabel> labels) {
    return new Column().withName(name).withFullyQualifiedName(FQN + "." + name).withTags(labels);
  }
}

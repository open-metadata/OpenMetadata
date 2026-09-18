package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.schema.utils.JsonUtils;

class EntityDiffTest {
  @Test
  void customPropertiesDistinguishMissingNullAndChangedValues() {
    final var original = JsonUtils.readTree("{\"kept\":7,\"changed\":1,\"removed\":null}");
    final var requested = JsonUtils.readTree("{\"kept\":7,\"changed\":2,\"added\":null}");
    final var changes =
        EntityDiff.properties(original, requested).stream()
            .collect(java.util.stream.Collectors.toMap(EntityDiff.Property::name, value -> value));
    assertEquals(3, changes.size());
    assertNull(EntityDiff.properties(original, requested).getFirst().before());
    assertEquals(1, changes.get("changed").before().asInt());
    assertEquals(2, changes.get("changed").after().asInt());
    assertTrue(changes.get("removed").before().isNull());
    assertNull(changes.get("removed").after());
    assertNull(changes.get("added").before());
    assertTrue(changes.get("added").after().isNull());
    assertEquals(JsonUtils.readTree("{\"kept\":7,\"changed\":1,\"removed\":null}"), original);
    assertEquals(JsonUtils.readTree("{\"kept\":7,\"changed\":2,\"added\":null}"), requested);
    assertTrue(EntityDiff.properties(original, original).isEmpty());
    assertTrue(EntityDiff.properties(null, null).isEmpty());
    assertEquals(3, EntityDiff.properties(null, original).size());
    assertEquals(3, EntityDiff.properties(requested, null).size());
  }

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
  void tagPoliciesMergeOrReplaceBySourceAndFqnWithoutMutatingRequests() {
    final var stored = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    final var requested = tag("PII.Sensitive", TagLabel.TagSource.GLOSSARY);
    final var original = List.of(stored);
    final var update = List.of(requested);
    final var merged = EntityDiff.tags(original, update, true);
    assertEquals(List.of(requested, stored), merged.updated());
    assertEquals(List.of(requested), merged.added());
    assertTrue(merged.deleted().isEmpty());
    final var replaced = EntityDiff.tags(original, update, false);
    assertEquals(List.of(requested), replaced.updated());
    assertEquals(List.of(stored), replaced.deleted());
    assertEquals(List.of(requested), update);
    assertEquals(List.of(stored), original);
    final var same =
        EntityDiff.tags(original, List.of(JsonUtils.deepCopy(stored, TagLabel.class)), false);
    assertTrue(same.added().isEmpty());
    assertTrue(same.deleted().isEmpty());
    assertTrue(EntityDiff.tags(null, null, true).updated().isEmpty());
  }

  @Test
  void importTagRowsCompareStoredAttributesAndIgnoreHydratedDisplayValues() {
    final var stored = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    final var displayed =
        JsonUtils.deepCopy(stored, TagLabel.class)
            .withName("Sensitive")
            .withDescription("Hydrated description")
            .withAppliedAt(new Date(1_000L));
    assertTrue(EntityDiff.tagRows(List.of(stored), List.of(displayed)).added().isEmpty());
    for (var requested :
        List.of(
            JsonUtils.deepCopy(stored, TagLabel.class).withLabelType(TagLabel.LabelType.AUTOMATED),
            JsonUtils.deepCopy(stored, TagLabel.class).withState(TagLabel.State.SUGGESTED),
            JsonUtils.deepCopy(stored, TagLabel.class).withReason("Reviewed"),
            JsonUtils.deepCopy(stored, TagLabel.class).withAppliedBy("reviewer"),
            JsonUtils.deepCopy(stored, TagLabel.class).withMetadata(new TagLabelMetadata()))) {
      final var delta = EntityDiff.tagRows(List.of(stored), List.of(requested));
      assertEquals(List.of(stored), delta.deleted());
      assertEquals(List.of(requested), delta.added());
      assertEquals(List.of(requested), delta.updated());
      assertTrue(EntityDiff.tags(List.of(stored), List.of(requested), false).added().isEmpty());
    }
    assertTrue(EntityDiff.tagRows(null, null).updated().isEmpty());
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

  private TagLabel tag(String fqn, TagLabel.TagSource source) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(source)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private AccessDetails access(long timestamp) {
    return new AccessDetails().withTimestamp(timestamp);
  }
}

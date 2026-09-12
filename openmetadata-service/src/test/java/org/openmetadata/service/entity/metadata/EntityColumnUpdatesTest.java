package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

class EntityColumnUpdatesTest {
  private static final String COLUMNS = "columns";
  private static final String ENTITY_FQN = "service.database.schema.table";
  private static final String USER = "ingestion-bot";

  @Test
  void absentColumnsKeepTheEntityAndDatabaseUnchanged() {
    final Fixture fixture = new Fixture();
    fixture.updateColumns(COLUMNS, null, null, EntityUtil.columnMatch);
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
    assertFalse(fixture.major);
    assertEquals(List.of(new Lineage(List.of(), Map.of(), false)), fixture.lineage);
    assertTrue(fixture.extensions.isEmpty());
    assertTrue(fixture.tags.isEmpty());
  }

  @Test
  void typeReplacementRetainsMetadataAfterRecordingTheSubmittedChange() {
    final Fixture fixture = new Fixture();
    final TagLabel tag = new TagLabel().withTagFQN("PersonalData.Personal").withAppliedBy("human");
    final Column original = column("value").withDescription("Human text").withTags(List.of(tag));
    final Column updated =
        column("value")
            .withDataType(ColumnDataType.TEXT)
            .withExtension(Map.of("note", "replacement"));
    fixture.seed(original, "{\"note\":\"old\"}");

    fixture.updateColumns(COLUMNS, List.of(original), List.of(updated), EntityUtil.columnMatch);

    assertEquals("Human text", updated.getDescription());
    assertSame(original.getTags(), updated.getTags());
    assertEquals(USER, fixture.tags.get(updated.getFullyQualifiedName()).getFirst().getAppliedBy());
    assertEquals("{\"note\":\"replacement\"}", fixture.extension(updated));
    final Column recordedAdded =
        JsonUtils.readObjects(
                fixture.changes.getFieldsAdded().getFirst().getNewValue().toString(), Column.class)
            .getFirst();
    final Column recordedDeleted =
        JsonUtils.readObjects(
                fixture.changes.getFieldsDeleted().getFirst().getOldValue().toString(),
                Column.class)
            .getFirst();
    assertNull(recordedAdded.getDescription());
    assertTrue(recordedAdded.getTags().isEmpty());
    assertEquals("human", recordedDeleted.getTags().getFirst().getAppliedBy());
    assertEquals(
        List.of(new Lineage(List.of(original.getFullyQualifiedName()), Map.of(), true)),
        fixture.lineage);
  }

  @Test
  void replacementKeepsIncomingMetadataAndUsesExactNamesForCarryForward() {
    final Fixture fixture = new Fixture();
    final Column original =
        column("VALUE")
            .withDescription("Human text")
            .withTags(List.of(new TagLabel().withTagFQN("PersonalData.Personal")));
    final Column differentCase = column("value").withDataType(ColumnDataType.TEXT);
    fixture.updateColumns(
        COLUMNS, List.of(original), List.of(differentCase), EntityUtil.columnMatch);
    assertNull(differentCase.getDescription());
    assertTrue(differentCase.getTags().isEmpty());

    final Column replacement =
        column("VALUE")
            .withDataType(ColumnDataType.TEXT)
            .withDescription("Incoming text")
            .withTags(List.of(new TagLabel().withTagFQN("Tier.Tier1")));
    fixture.updateColumns(COLUMNS, List.of(original), List.of(replacement), EntityUtil.columnMatch);
    assertEquals("Incoming text", replacement.getDescription());
    assertEquals("Tier.Tier1", replacement.getTags().getFirst().getTagFQN());
  }

  @Test
  void matchedColumnsRetainScalarRulesQuotedPathsAndRecursiveExtensionPersistence() {
    final Fixture fixture = new Fixture();
    final Column originalChild = column("child").withDataLength(30);
    final Column updatedChild = column("child").withDataLength(10).withExtension(Map.of("rank", 2));
    final Column original =
        column("name.with.dots")
            .withDescription("Human text")
            .withDisplayName("Human name")
            .withPrecision(20)
            .withScale(4)
            .withChildren(List.of(originalChild));
    final Column updated =
        column("name.with.dots")
            .withDescription("Source text")
            .withDisplayName("Source name")
            .withPrecision(10)
            .withScale(2)
            .withConstraint(ColumnConstraint.NOT_NULL)
            .withChildren(List.of(updatedChild));

    fixture.updateColumns(COLUMNS, List.of(original), List.of(updated), EntityUtil.columnMatch);

    assertEquals("Human text", updated.getDescription());
    assertEquals("Human name", updated.getDisplayName());
    assertEquals("{\"rank\":2}", fixture.extension(updatedChild));
    assertTrue(fixture.major);
    assertEquals(
        List.of(
            "columns.\"name.with.dots\".precision",
            "columns.\"name.with.dots\".scale",
            "columns.\"name.with.dots\".child.dataLength"),
        fixture.changes.getFieldsUpdated().stream().map(change -> change.getName()).toList());
    assertEquals(
        "columns.\"name.with.dots\".constraint",
        fixture.changes.getFieldsAdded().getFirst().getName());
    assertEquals(3, fixture.lineage.size());
    assertTrue(fixture.lineage.stream().allMatch(Lineage::major));
  }

  @Test
  void legacyFqnRepairNeverCreatesANullLineageRename() {
    final Fixture fixture = new Fixture();
    final Column legacy = column("legacy").withFullyQualifiedName(null);
    final Column renamed = column("renamed");
    final Column renamedUpdate = column("renamed").withFullyQualifiedName(ENTITY_FQN + ".newName");
    fixture.updateColumns(
        COLUMNS,
        List.of(legacy, renamed),
        List.of(column("legacy"), renamedUpdate),
        EntityUtil.columnMatch);
    assertEquals(
        List.of(
            new Lineage(List.of(), Map.of(), false),
            new Lineage(List.of(), Map.of(), false),
            new Lineage(
                List.of(),
                Map.of(renamed.getFullyQualifiedName(), renamedUpdate.getFullyQualifiedName()),
                false)),
        fixture.lineage);
  }

  @Test
  void childrenAreComparedOnlyWhenBothListsExist() {
    final Fixture fixture = new Fixture();
    final Column child = column("child").withExtension(Map.of("rank", 1));
    final Column original = column("parent").withChildren(null);
    final Column updated = column("parent").withChildren(List.of(child));
    fixture.updateColumns(COLUMNS, List.of(original), List.of(updated), EntityUtil.columnMatch);
    fixture.updateColumns(COLUMNS, List.of(updated), List.of(original), EntityUtil.columnMatch);
    assertFalse(fixture.major);
    assertTrue(fixture.extensions.isEmpty());
    assertEquals(2, fixture.lineage.size());
  }

  @Test
  void newColumnsPersistNestedExtensionsWithoutComparingTheirScalars() {
    final Fixture fixture = new Fixture();
    final Column child = column("child").withExtension(Map.of("rank", 1));
    final Column added = column("parent").withChildren(List.of(child));
    fixture.updateColumns(COLUMNS, List.of(), List.of(added), EntityUtil.columnMatch);
    assertEquals("{\"rank\":1}", fixture.extension(child));
    assertFalse(fixture.major);
    assertEquals(1, fixture.changes.getFieldsAdded().size());
  }

  @Test
  void duplicateAddedNamesStillFailBeforePersistence() {
    final Fixture fixture = new Fixture();
    assertThrows(
        IllegalStateException.class,
        () ->
            fixture.updateColumns(
                COLUMNS,
                List.of(),
                List.of(column("duplicate"), column("duplicate")),
                EntityUtil.columnMatch));
    assertTrue(fixture.tags.isEmpty());
    assertTrue(fixture.extensions.isEmpty());
    assertTrue(fixture.lineage.isEmpty());
  }

  @Test
  void unselectedFieldsNeverRecordListChangesOrDeleteMetadata() {
    final Fixture fixture = new Fixture();
    fixture.selected = false;
    final Column original = column("value").withDescription("Retained");
    final Column replacement = column("value").withDataType(ColumnDataType.TEXT);
    fixture.seed(original, "{\"rank\":1}");
    fixture.updateColumns(COLUMNS, List.of(original), List.of(replacement), EntityUtil.columnMatch);
    assertEquals("{\"rank\":1}", fixture.extension(original));
    assertNull(replacement.getDescription());
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
    assertFalse(fixture.major);
  }

  @Test
  void persistenceFailuresReachTheOwningTransactionWithoutLineagePublication() {
    final Fixture fixture = new Fixture();
    final IllegalStateException failure = new IllegalStateException("extension write failed");
    fixture.failure = failure;
    final Column added = column("value").withExtension(Map.of("rank", 1));
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class,
            () ->
                fixture.updateColumns(COLUMNS, List.of(), List.of(added), EntityUtil.columnMatch)));
    assertTrue(fixture.lineage.isEmpty());
  }

  private static Column column(final String name) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.BIGINT)
        .withFullyQualifiedName(FullyQualifiedName.add(ENTITY_FQN, name));
  }

  private record Lineage(List<String> deleted, Map<String, String> renamed, boolean major) {}

  private static final class Fixture implements EntityColumnUpdates.Session {
    private final UUID id = UUID.randomUUID();
    private final ChangeDescription changes = new ChangeDescription();
    private final Map<String, String> extensions = new HashMap<>();
    private final Map<String, List<TagLabel>> tags = new HashMap<>();
    private final List<Lineage> lineage = new ArrayList<>();
    private final ColumnValueUpdater values = new ColumnValueUpdater();
    private final EntityColumnUpdates updater;
    private boolean major;
    private boolean selected = true;
    private RuntimeException failure;

    private Fixture() {
      final EntityExtensionDAO extensionRows =
          mock(
              EntityExtensionDAO.class,
              invocation -> {
                assertEquals(id, invocation.getArgument(0));
                switch (invocation.getMethod().getName()) {
                  case "insert" -> {
                    if (failure != null) {
                      throw failure;
                    }
                    extensions.put(invocation.getArgument(1), invocation.getArgument(3));
                  }
                  case "delete" -> extensions.remove(invocation.getArgument(1));
                  default -> throw new AssertionError(
                      "Unexpected extension read: " + invocation.getMethod());
                }
                return null;
              });
      final TagUsageDAO tagRows =
          mock(
              TagUsageDAO.class,
              invocation -> {
                if (!invocation.getMethod().getName().equals("deleteTagsByTarget")) {
                  throw new AssertionError("Unexpected tag read: " + invocation.getMethod());
                }
                tags.remove(invocation.getArgument(0));
                return null;
              });
      final var properties =
          new EntityExtensionService.Properties(
              "unused", Function.identity(), Function.identity(), Function.identity());
      updater =
          new EntityColumnUpdates(
              values,
              new EntityExtensionService(() -> extensionRows, properties, true),
              () -> tagRows,
              () -> extensionRows);
    }

    private void seed(final Column column, final String json) {
      extensions.put(FullyQualifiedName.buildHash(column.getFullyQualifiedName()), json);
      tags.put(column.getFullyQualifiedName(), column.getTags());
    }

    private String extension(final Column column) {
      return extensions.get(FullyQualifiedName.buildHash(column.getFullyQualifiedName()));
    }

    @Override
    public UUID entityId() {
      return id;
    }

    @Override
    public String updatingUserName() {
      return USER;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return changes;
    }

    @Override
    public boolean compares(final String field) {
      return selected;
    }

    @Override
    public void markMajorVersionChange() {
      major = true;
    }

    @Override
    public void updateDataLength(final String field, final Column original, final Column updated) {
      major |= values.updateDataLength(this, field, original, updated);
    }

    @Override
    public void updateColumnTags(
        final String fqn,
        final String field,
        final List<TagLabel> original,
        final List<TagLabel> updated) {
      tags.put(fqn, updated);
    }

    @Override
    public void addColumnTags(final List<TagLabel> labels, final String fqn) {
      if (!labels.isEmpty()) {
        tags.put(fqn, labels);
      }
    }

    @Override
    public void updateColumns(
        final String field,
        final List<Column> original,
        final List<Column> updated,
        final BiPredicate<Column, Column> match) {
      updater.update(this, field, original, updated, match);
    }

    @Override
    public void updateColumnLineage(
        final List<String> deleted, final HashMap<String, String> renamed) {
      lineage.add(new Lineage(deleted, Map.copyOf(renamed), major));
    }

    @Override
    public boolean isPut() {
      return true;
    }

    @Override
    public boolean updatedByBot() {
      return true;
    }

    @Override
    public boolean isOverrideMetadata() {
      return false;
    }

    @Override
    public <K> boolean recordChange(final String field, final K original, final K updated) {
      final boolean changed = selected && !Objects.equals(original, updated);
      if (changed) {
        EntityChangeRecorder.recordValue(changes, field, original, updated, false);
      }
      return changed;
    }
  }
}

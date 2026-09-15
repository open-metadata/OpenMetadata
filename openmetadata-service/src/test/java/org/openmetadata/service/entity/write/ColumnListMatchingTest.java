package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiPredicate;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.metadata.ColumnMatchIndex;
import org.openmetadata.service.util.EntityUtil;

class ColumnListMatchingTest {
  @Test
  void matchingWideUnchangedSchemasDoesNotRepeatedlyWalkAllColumnNames() {
    final AtomicInteger reads = new AtomicInteger();
    final List<Column> original = wideColumns(reads);
    final List<Column> updated = wideColumns(reads);
    final Delta delta = compare(original, updated, EntityUtil.columnMatch);
    assertFalse(EntityChangeRecorder.hasChanges(delta.changes()));
    assertTrue(delta.added().isEmpty());
    assertTrue(delta.deleted().isEmpty());
    assertTrue(
        reads.get() < 20_000,
        () -> "Matching 1,000 columns read their names " + reads.get() + " times");
  }

  @ParameterizedTest
  @CsvSource({"I,ı", "İ,i", "Σ,ς", "K,K", "S,ſ", "𐐀,𐐨"})
  void matchingPreservesJavaUnicodeCaseInsensitiveEquality(
      String originalName, String updatedName) {
    final Delta delta =
        compare(
            List.of(column(originalName)), List.of(column(updatedName)), EntityUtil.columnMatch);
    assertTrue(delta.added().isEmpty());
    assertTrue(delta.deleted().isEmpty());
    assertFalse(EntityChangeRecorder.hasChanges(delta.changes()));
  }

  @Test
  void typeAndArrayTypeChangesRetainInputOrderAndSerializedDeltas() {
    final Column first = column("first");
    final Column second =
        column("second").withDataType(ColumnDataType.ARRAY).withArrayDataType(ColumnDataType.INT);
    final Column changedSecond =
        column("SECOND")
            .withDataType(ColumnDataType.ARRAY)
            .withArrayDataType(ColumnDataType.STRING);
    final Column changedFirst = column("FIRST").withDataType(ColumnDataType.STRING);
    final Delta delta =
        compare(
            List.of(first, second), List.of(changedSecond, changedFirst), EntityUtil.columnMatch);
    assertEquals(List.of(changedSecond, changedFirst), delta.added());
    assertEquals(List.of(first, second), delta.deleted());
    assertEquals(
        JsonUtils.pojoToJson(delta.added()),
        delta.changes().getFieldsAdded().getFirst().getNewValue());
    assertEquals(
        JsonUtils.pojoToJson(delta.deleted()),
        delta.changes().getFieldsDeleted().getFirst().getOldValue());
  }

  @Test
  void nameOnlyMatchingKeepsItsDifferentTypeSemantics() {
    final Delta delta =
        compare(
            List.of(column("name")),
            List.of(column("NAME").withDataType(ColumnDataType.STRING)),
            EntityUtil.columnNameMatch);
    assertTrue(delta.added().isEmpty());
    assertTrue(delta.deleted().isEmpty());
  }

  @Test
  void arbitraryPredicatesRetainTheDirectionOfEachComparison() {
    final Delta delta =
        compare(
            List.of(column("prefix")),
            List.of(column("prefix.suffix")),
            (candidate, item) -> candidate.getName().startsWith(item.getName()));
    assertEquals(List.of(column("prefix.suffix")), delta.added());
    assertTrue(delta.deleted().isEmpty());
  }

  @Test
  void duplicateMatchingNamesKeepExistenceSemantics() {
    final Delta delta =
        compare(
            List.of(column("Name"), column("NAME")),
            List.of(column("name")),
            EntityUtil.columnMatch);
    assertTrue(delta.added().isEmpty());
    assertTrue(delta.deleted().isEmpty());
  }

  @Test
  void duplicateBucketsReturnTheFirstMatchingOriginal() {
    final Column first = column("Name");
    final Column second = column("NAME");
    final Column updated = column("name");
    final var values =
        new EntityChangeRecorder.ListChange<>(
            List.of(first, second),
            List.of(updated),
            new ArrayList<Column>(),
            new ArrayList<Column>(),
            EntityUtil.columnMatch);
    assertSame(first, ColumnMatchIndex.forChange(values).findOriginal(updated));
  }

  @Test
  void malformedCandidatesKeepTheMatchingFailureInsteadOfBeingIgnored() {
    assertThrows(
        NullPointerException.class,
        () -> compare(List.of(new Column()), List.of(column("name")), EntityUtil.columnMatch));
    assertThrows(
        NullPointerException.class,
        () ->
            compare(
                Collections.singletonList(null), List.of(column("name")), EntityUtil.columnMatch));
  }

  @Test
  void absentNamesAndNullItemsAreNotEagerlyRejectedWhenNoMatchingIsNeeded() {
    final Delta missingName = compare(List.of(new Column()), List.of(), EntityUtil.columnMatch);
    assertEquals(1, missingName.deleted().size());
    final Delta nullItem =
        compare(Collections.singletonList(null), List.of(), EntityUtil.columnMatch);
    assertEquals(1, nullItem.deleted().size());
  }

  private static Column column(String name) {
    return new Column().withName(name).withDataType(ColumnDataType.INT);
  }

  private static List<Column> wideColumns(AtomicInteger reads) {
    return IntStream.range(0, 1000)
        .mapToObj(index -> (Column) new CountingColumn("column" + index, reads))
        .toList();
  }

  private static Delta compare(
      List<Column> original, List<Column> updated, BiPredicate<Column, Column> match) {
    final Delta delta = new Delta(new ChangeDescription(), new ArrayList<>(), new ArrayList<>());
    EntityChangeRecorder.recordList(
        delta.changes(),
        "columns",
        new EntityChangeRecorder.ListChange<>(
            original, updated, delta.added(), delta.deleted(), match));
    return delta;
  }

  private record Delta(ChangeDescription changes, List<Column> added, List<Column> deleted) {}

  private static final class CountingColumn extends Column {
    private final AtomicInteger reads;

    private CountingColumn(String name, AtomicInteger reads) {
      this.reads = reads;
      setName(name);
      setDataType(ColumnDataType.INT);
    }

    @Override
    public String getName() {
      reads.incrementAndGet();
      return super.getName();
    }
  }
}

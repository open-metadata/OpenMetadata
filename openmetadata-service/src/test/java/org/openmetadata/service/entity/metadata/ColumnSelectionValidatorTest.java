package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;

class ColumnSelectionValidatorTest {
  @Test
  void defaultSelectionIsCaseSensitiveForTablesAndColumnLists() {
    final List<Column> columns = List.of(column("Id"));
    final Table table = new Table().withColumns(columns);
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(columns, "Id"));
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(table, "Id"));
    assertEquals(
        "Invalid column name id",
        assertThrows(
                IllegalArgumentException.class,
                () -> ColumnSelectionValidator.validate(columns, "id"))
            .getMessage());
    assertThrows(
        IllegalArgumentException.class, () -> ColumnSelectionValidator.validate(table, "id"));
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(booleans = {true, false})
  void onlyExplicitFalseDisablesCaseSensitivity(final Boolean caseSensitive) {
    final Table table = new Table().withColumns(List.of(column("Id")));
    if (Boolean.FALSE.equals(caseSensitive)) {
      assertDoesNotThrow(() -> ColumnSelectionValidator.validate(table, "ID", caseSensitive));
    } else {
      assertThrows(
          IllegalArgumentException.class,
          () -> ColumnSelectionValidator.validate(table, "ID", caseSensitive));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"all", "ALL", "All"})
  void wildcardSelectionIsAcceptedEvenWhenThereAreNoColumns(final String name) {
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(List.of(), name));
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(List.of(), name, false));
  }

  @Test
  void nullListRetainsItsErrorBeforeWildcardValidation() {
    final IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () -> ColumnSelectionValidator.validate((List<Column>) null, "all"));
    assertEquals("Columns list cannot be null", failure.getMessage());
    assertThrows(
        NullPointerException.class, () -> ColumnSelectionValidator.validate((Table) null, "all"));
  }

  @Test
  void nullEntriesAreIgnoredAndOnlyTopLevelNamesAreSelected() {
    final List<Column> columns =
        Arrays.asList(null, column("parent").withChildren(List.of(column("child"))), column("a.b"));
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(columns, "parent"));
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(columns, "a.b"));
    assertThrows(
        IllegalArgumentException.class, () -> ColumnSelectionValidator.validate(columns, "child"));
    assertThrows(
        IllegalArgumentException.class,
        () -> ColumnSelectionValidator.validate(columns, "parent.child"));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void aMatchedNameShortCircuitsLaterMalformedColumns(final boolean caseSensitive) {
    final List<Column> columns = List.of(column("id"), column(null));
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(columns, "id", caseSensitive));
    assertThrows(
        NullPointerException.class,
        () -> ColumnSelectionValidator.validate(columns, "all", caseSensitive));
    assertThrows(
        NullPointerException.class,
        () -> ColumnSelectionValidator.validate(columns, null, caseSensitive));
  }

  @Test
  void namesAreNotUnquotedOrTrimmed() {
    final List<Column> columns = List.of(column("\"Id\""), column(" name "));
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(columns, "\"Id\""));
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(columns, " name "));
    assertThrows(
        IllegalArgumentException.class,
        () -> ColumnSelectionValidator.validate(columns, "Id", false));
    assertThrows(
        IllegalArgumentException.class,
        () -> ColumnSelectionValidator.validate(columns, "name", false));
  }

  @Test
  void caseInsensitiveSelectionRetainsJavaUnicodeMatching() {
    assertDoesNotThrow(() -> ColumnSelectionValidator.validate(List.of(column("İd")), "id", false));
    assertThrows(
        IllegalArgumentException.class,
        () -> ColumnSelectionValidator.validate(List.of(column("İd")), "id", true));
  }

  private Column column(final String name) {
    return new Column().withName(name);
  }
}

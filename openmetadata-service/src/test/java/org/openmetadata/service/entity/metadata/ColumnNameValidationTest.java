package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.resources.databases.DatabaseUtil;

class ColumnNameValidationTest {
  @Test
  void wideSchemasReadEachColumnNameOnce() {
    final AtomicInteger reads = new AtomicInteger();
    final List<Column> columns =
        IntStream.range(0, 1000)
            .mapToObj(
                index ->
                    new Column() {
                      @Override
                      public String getName() {
                        reads.incrementAndGet();
                        return super.getName();
                      }
                    }.withName("column" + index))
            .toList();
    DatabaseUtil.validateColumnNames(columns);
    assertEquals(columns.size(), reads.get());
  }

  @Test
  void duplicateNamesKeepTheFirstDuplicateError() {
    final var failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                DatabaseUtil.validateColumnNames(
                    List.of(column("first"), column("second"), column("second"), column("first"))));
    assertEquals("Column name second is repeated", failure.getMessage());
  }

  @Test
  void validationRemainsCaseSensitiveWithoutUnquotingNames() {
    assertDoesNotThrow(
        () ->
            DatabaseUtil.validateColumnNames(
                List.of(
                    column("Name"),
                    column("name"),
                    column("\"name\""),
                    column("a.b"),
                    column("\"a.b\""))));
  }

  @Test
  void nullNamesKeepTheirExistingDuplicateSemantics() {
    assertDoesNotThrow(() -> DatabaseUtil.validateColumnNames(List.of(column(null))));
    final var failure =
        assertThrows(
            IllegalArgumentException.class,
            () -> DatabaseUtil.validateColumnNames(List.of(column(null), column(null))));
    assertEquals("Column name null is repeated", failure.getMessage());
  }

  @Test
  void emptyAndMalformedListsKeepTheirExistingResults() {
    assertDoesNotThrow(() -> DatabaseUtil.validateColumnNames(List.of()));
    assertThrows(NullPointerException.class, () -> DatabaseUtil.validateColumnNames(null));
    assertThrows(
        NullPointerException.class,
        () -> DatabaseUtil.validateColumnNames(Arrays.asList((Column) null)));
  }

  private Column column(final String name) {
    return new Column().withName(name);
  }
}

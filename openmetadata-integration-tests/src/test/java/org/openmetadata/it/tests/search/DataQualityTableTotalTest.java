package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.Datum;

class DataQualityTableTotalTest {

  @ParameterizedTest
  @CsvSource({
    "0, 0",
    "0.0, 0",
    "1, 1",
    "1.0, 1",
    "2.0, 2",
    "10233.0, 10233",
    "1.0233E4, 10233",
    "9007199254740993.0, 9007199254740993",
    "9223372036854775807, 9223372036854775807"
  })
  void readsWholeNumberCountsExactly(String value, long expected) {
    assertEquals(expected, DataQualityTableTotal.tableTotal(report(value)));
  }

  @ParameterizedTest
  @ValueSource(strings = {"1.5", "9223372036854775808"})
  void rejectsFractionalOrOverflowingCounts(String value) {
    assertThrows(ArithmeticException.class, () -> DataQualityTableTotal.tableTotal(report(value)));
  }

  private static DataQualityReport report(String value) {
    return new DataQualityReport()
        .withData(List.of(new Datum().withAdditionalProperty("fullyQualifiedName", value)));
  }
}

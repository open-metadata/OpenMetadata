package org.openmetadata.service.entity.bulk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.csv.CsvImportResult;

class CsvImportSummaryTest {
  @Test
  void keepsCountersAndAnIndependentResult() {
    final CsvImportResult original =
        new CsvImportResult()
            .withDryRun(true)
            .withStatus(ApiStatus.PARTIAL_SUCCESS)
            .withNumberOfRowsProcessed(3)
            .withNumberOfRowsPassed(2)
            .withNumberOfRowsFailed(1)
            .withAbortReason("Validation stopped");
    final CsvImportResult summary = CsvImportSummary.summarize(original);
    assertEquals(original, summary);
    assertNotSame(original, summary);
  }

  @ParameterizedTest
  @NullAndEmptySource
  void omitsAbsentCsv(String csv) {
    assertNull(
        CsvImportSummary.summarize(new CsvImportResult().withImportResultsCsv(csv))
            .getImportResultsCsv());
  }

  @ParameterizedTest
  @CsvSource({"fullyQualifiedName,asset", "NAME,asset", "description,Display"})
  void retainsOnlyStatusDetailsAndTheFirstNameColumn(String header, String expectedName) {
    final CsvImportResult original =
        new CsvImportResult()
            .withImportResultsCsv(
                "status,details," + header + ",displayName\nsuccess,Imported,asset,Display\n");
    assertEquals(
        "status,details,name\r\nsuccess,Imported," + expectedName + "\r\n",
        CsvImportSummary.summarize(original).getImportResultsCsv());
  }

  @Test
  void leavesTheNameEmptyWhenItIsAbsentFromTheHeaderOrRow() {
    assertEquals(
        "status,details,name\r\nsuccess,Imported,\r\n",
        CsvImportSummary.summarize(
                new CsvImportResult().withImportResultsCsv("status,details\nsuccess,Imported\n"))
            .getImportResultsCsv());
    assertEquals(
        "status,details,name\r\nsuccess,Imported,\r\n",
        CsvImportSummary.summarize(
                new CsvImportResult()
                    .withImportResultsCsv("status,details,name\nsuccess,Imported\n"))
            .getImportResultsCsv());
  }

  @Test
  void preservesQuotedCommasNewlinesAndTheOriginalCsv() {
    final String csv =
        "status,details,name,large\nsuccess,\"First, second\",\"line1\nline2\",discard\n";
    final CsvImportResult original = new CsvImportResult().withImportResultsCsv(csv);
    assertEquals(
        "status,details,name\r\nsuccess,\"First, second\",\"line1\nline2\"\r\n",
        CsvImportSummary.summarize(original).getImportResultsCsv());
    assertEquals(csv, original.getImportResultsCsv());
  }

  @Test
  void preservesTheFullCsvIfRequiredColumnsAreMissing() {
    final String csv = "details,name\nImported,asset\n";
    assertEquals(
        csv,
        CsvImportSummary.summarize(new CsvImportResult().withImportResultsCsv(csv))
            .getImportResultsCsv());
  }
}

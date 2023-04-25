package org.openmetadata.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.LINE_SEPARATOR;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsv.ENTITY_CREATED;
import static org.openmetadata.csv.EntityCsv.ENTITY_UPDATED;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.type.csv.CsvImportResult.Status;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.TableDAO;
import org.openmetadata.service.jdbi3.TableRepository;

public class EntityCsvTest {
  private static final List<CsvHeader> CSV_HEADERS;
  private static final String HEADER_STRING = "h1*,h2,h3" + LINE_SEPARATOR;

  static {
    Object[][] headers = {
      {"h1", Boolean.TRUE},
      {"h2", Boolean.FALSE},
      {"h3", Boolean.FALSE}
    };
    CSV_HEADERS = getHeaders(headers);
  }

  @BeforeAll
  public static void setup() {
    Entity.registerEntity(Table.class, Entity.TABLE, Mockito.mock(TableDAO.class), Mockito.mock(TableRepository.class));
  }

  @Test
  void test_formatHeader() throws IOException {
    CsvFile csvFile = new CsvFile();
    csvFile.withHeaders(CSV_HEADERS);
    String file = CsvUtil.formatCsv(csvFile);
    assertEquals(HEADER_STRING, file);
  }

  @Test
  void test_validateCsvInvalidHeader() throws IOException {
    String csv = ",h2,h3" + LINE_SEPARATOR; // Header h1 is missing in the CSV file
    TestCsv testCsv = new TestCsv();
    CsvImportResult importResult = testCsv.importCsv(csv, true);
    assertSummary(importResult, Status.ABORTED, 1, 0, 1);
    assertNull(importResult.getImportResultsCsv());
    assertEquals(TestCsv.invalidHeader("h1*,h2,h3", ",h2,h3"), importResult.getAbortReason());
  }

  @Test
  void test_validateCsvInvalidRecords() throws IOException {
    // Invalid record 2 - Missing required value in h1
    // Invalid record 3 - Record with only two fields instead of 3
    List<String> records = listOf(",2,3", "1,2", "1,2,3");
    String csv = createCsv(CSV_HEADERS, records);

    TestCsv testCsv = new TestCsv();
    CsvImportResult importResult = testCsv.importCsv(csv, true);
    assertSummary(importResult, Status.PARTIAL_SUCCESS, 4, 2, 2);

    String[] expectedRecords = {
      CsvUtil.recordToString(EntityCsv.getResultHeaders(CSV_HEADERS)),
      getFailedRecord(",2,3", TestCsv.fieldRequired(0)),
      getFailedRecord("1,2", TestCsv.invalidFieldCount(3, 2)),
      getSuccessRecord("1,2,3", ENTITY_CREATED)
    };

    assertRows(importResult, expectedRecords);
  }

  public static void assertSummary(
      CsvImportResult importResult,
      Status expectedStatus,
      int expectedRowsProcessed,
      int expectedRowsPassed,
      int expectedRowsFailed) {
    assertEquals(expectedStatus, importResult.getStatus(), importResult.toString());
    assertEquals(expectedRowsProcessed, importResult.getNumberOfRowsProcessed(), importResult.getImportResultsCsv());
    assertEquals(expectedRowsPassed, importResult.getNumberOfRowsPassed(), importResult.getImportResultsCsv());
    assertEquals(expectedRowsFailed, importResult.getNumberOfRowsFailed(), importResult.getImportResultsCsv());
  }

  public static void assertRows(CsvImportResult importResult, String... expectedRows) {
    String[] resultRecords = importResult.getImportResultsCsv().split(LINE_SEPARATOR);
    assertEquals(expectedRows.length, resultRecords.length);
    for (int i = 0; i < resultRecords.length; i++) {
      assertEquals(expectedRows[i], resultRecords[i], "Row number is " + i);
    }
  }

  public static String getSuccessRecord(String record, String successDetails) {
    return String.format("%s,%s,%s", EntityCsv.IMPORT_STATUS_SUCCESS, successDetails, record);
  }

  public static String getFailedRecord(String record, String errorDetails) {
    return String.format("%s,\"%s\",%s", EntityCsv.IMPORT_STATUS_FAILED, errorDetails, record);
  }

  private static List<CsvHeader> getHeaders(Object[][] headers) {
    List<CsvHeader> csvHeaders = new ArrayList<>();
    for (Object[] header : headers) {
      csvHeaders.add(new CsvHeader().withName((String) header[0]).withRequired((Boolean) header[1]));
    }
    return csvHeaders;
  }

  public static String createCsv(List<CsvHeader> csvHeaders, List<String> records) {
    records.add(0, recordToString(CsvUtil.getHeaders(csvHeaders)));
    return String.join(LINE_SEPARATOR, records) + LINE_SEPARATOR;
  }

  public static String createCsv(List<CsvHeader> csvHeaders, List<String> createRecords, List<String> updateRecords) {
    // Create CSV
    List<String> csvRecords = new ArrayList<>();
    if (!nullOrEmpty(createRecords)) {
      csvRecords.addAll(createRecords);
    }
    if (!nullOrEmpty(updateRecords)) {
      csvRecords.addAll(updateRecords);
    }
    return createCsv(csvHeaders, csvRecords);
  }

  public static String createCsvResult(
      List<CsvHeader> csvHeaders, List<String> createRecords, List<String> updateRecords) {
    // Create CSV
    List<String> csvRecords = new ArrayList<>();
    csvRecords.add(recordToString(EntityCsv.getResultHeaders(csvHeaders)));
    if (!nullOrEmpty(createRecords)) {
      for (String record : createRecords) {
        csvRecords.add(getSuccessRecord(record, ENTITY_CREATED));
      }
    }
    if (!nullOrEmpty(updateRecords)) {
      for (String record : updateRecords) {
        csvRecords.add(getSuccessRecord(record, ENTITY_UPDATED));
      }
    }
    return String.join(LINE_SEPARATOR, csvRecords) + LINE_SEPARATOR;
  }

  private static class TestCsv extends EntityCsv<EntityInterface> {
    protected TestCsv() {
      super(Entity.TABLE, CSV_HEADERS, "admin");
    }

    @Override
    protected EntityInterface toEntity(CSVPrinter resultsPrinter, CSVRecord record) {
      return new Table(); // Return a random entity to mark successfully processing a record
    }

    @Override
    protected List<String> toRecord(EntityInterface entity) {
      return null;
    }
  }
}

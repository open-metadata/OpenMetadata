package org.openmetadata.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.LINE_SEPARATOR;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsv.ENTITY_CREATED;
import static org.openmetadata.csv.EntityCsv.ENTITY_UPDATED;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.StringEscapeUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
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
    Entity.registerEntity(Table.class, Entity.TABLE, Mockito.mock(TableRepository.class));
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
    assertSummary(importResult, ApiStatus.ABORTED, 1, 0, 1);
    assertNull(importResult.getImportResultsCsv());
    assertEquals(TestCsv.invalidHeader("h1*,h2,h3", ",h2,h3"), importResult.getAbortReason());
  }

  public static void assertSummary(
      CsvImportResult importResult,
      ApiStatus expectedStatus,
      int expectedRowsProcessed,
      int expectedRowsPassed,
      int expectedRowsFailed) {
    assertEquals(expectedStatus, importResult.getStatus(), importResult.toString());
    assertEquals(
        expectedRowsProcessed,
        importResult.getNumberOfRowsProcessed(),
        importResult.getImportResultsCsv());
    assertEquals(
        expectedRowsPassed,
        importResult.getNumberOfRowsPassed(),
        importResult.getImportResultsCsv());
    assertEquals(
        expectedRowsFailed,
        importResult.getNumberOfRowsFailed(),
        importResult.getImportResultsCsv());
  }

  public static void assertRows(CsvImportResult importResult, String... expectedRows) {
    String[] resultRecords = importResult.getImportResultsCsv().split(LINE_SEPARATOR);
    assertEquals(expectedRows.length, resultRecords.length);
    for (int i = 0; i < resultRecords.length; i++) {
      assertEquals(expectedRows[i], resultRecords[i], "Row number is " + i);
    }
  }

  public static String getSuccessRecord(String record, String successDetails) {
    return String.format("%s,%s,%s", EntityCsv.IMPORT_SUCCESS, successDetails, record);
  }

  public static String getFailedRecord(String record, String errorDetails) {
    errorDetails = StringEscapeUtils.escapeCsv(errorDetails);
    String format = errorDetails.startsWith("\"") ? "%s,%s,%s" : "%s,\"%s\",%s";
    return String.format(format, EntityCsv.IMPORT_FAILED, errorDetails, record);
  }

  private static List<CsvHeader> getHeaders(Object[][] headers) {
    List<CsvHeader> csvHeaders = new ArrayList<>();
    for (Object[] header : headers) {
      csvHeaders.add(
          new CsvHeader().withName((String) header[0]).withRequired((Boolean) header[1]));
    }
    return csvHeaders;
  }

  public static String createCsv(List<CsvHeader> csvHeaders, List<String> records) {
    records.add(0, recordToString(CsvUtil.getHeaders(csvHeaders)));
    return String.join(LINE_SEPARATOR, records) + LINE_SEPARATOR;
  }

  public static String createCsv(
      List<CsvHeader> csvHeaders, List<String> createRecords, List<String> updateRecords) {
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

  @Test
  void test_importCsvWithProgressCallback() throws IOException {
    List<String> records = new ArrayList<>();
    records.add("value1,value2,value3");
    records.add("value4,value5,value6");
    records.add("value7,value8,value9");
    String csv = createCsv(CSV_HEADERS, records);

    TestCsv testCsv = new TestCsv();
    AtomicInteger callbackCount = new AtomicInteger(0);
    List<Integer> progressValues = new ArrayList<>();
    List<Integer> totalValues = new ArrayList<>();
    List<Integer> batchNumbers = new ArrayList<>();

    CsvImportProgressCallback callback =
        (rowsProcessed, totalRows, batchNumber, message) -> {
          callbackCount.incrementAndGet();
          progressValues.add(rowsProcessed);
          totalValues.add(totalRows);
          batchNumbers.add(batchNumber);
        };

    CsvImportResult importResult = testCsv.importCsv(csv, true, callback);

    // 4 rows: 1 header + 3 data rows (numberOfRowsProcessed = last record number = 4)
    assertSummary(importResult, ApiStatus.SUCCESS, 4, 4, 0);
    assertTrue(callbackCount.get() >= 1, "Callback should be called at least once");
    assertFalse(progressValues.isEmpty(), "Progress values should be recorded");
    assertEquals(3, totalValues.get(0), "Total rows should be 3 (excluding header)");
  }

  @Test
  void test_importCsvWithProgressCallback_multipleBatches() throws IOException {
    List<String> records = new ArrayList<>();
    int totalRecords = EntityCsv.DEFAULT_BATCH_SIZE + 50;
    for (int i = 0; i < totalRecords; i++) {
      records.add("value" + i + ",data" + i + ",info" + i);
    }
    String csv = createCsv(CSV_HEADERS, records);

    TestCsv testCsv = new TestCsv();
    AtomicInteger callbackCount = new AtomicInteger(0);
    List<Integer> batchNumbers = new ArrayList<>();

    CsvImportProgressCallback callback =
        (rowsProcessed, totalRows, batchNumber, message) -> {
          callbackCount.incrementAndGet();
          batchNumbers.add(batchNumber);
          assertEquals(totalRecords, totalRows, "Total rows should match");
        };

    CsvImportResult importResult = testCsv.importCsv(csv, true, callback);

    // numberOfRowsProcessed = header row (1) + totalRecords data rows
    int expectedRowsProcessed = totalRecords + 1;
    assertSummary(importResult, ApiStatus.SUCCESS, expectedRowsProcessed, expectedRowsProcessed, 0);
    assertEquals(2, callbackCount.get(), "Callback should be called twice for 2 batches");
    assertEquals(1, batchNumbers.get(0), "First batch number should be 1");
    assertEquals(2, batchNumbers.get(1), "Second batch number should be 2");
  }

  @Test
  void test_importCsvProgressMessageFormat() throws IOException {
    List<String> records = new ArrayList<>();
    records.add("value1,value2,value3");
    records.add("value4,value5,value6");
    String csv = createCsv(CSV_HEADERS, records);

    TestCsv testCsv = new TestCsv();
    List<String> messages = new ArrayList<>();

    CsvImportProgressCallback callback =
        (rowsProcessed, totalRows, batchNumber, message) -> messages.add(message);

    testCsv.importCsv(csv, true, callback);

    assertFalse(messages.isEmpty(), "Should have at least one message");
    String finalMessage = messages.get(messages.size() - 1);
    assertTrue(
        finalMessage.contains("Processed"), "Message should contain 'Processed': " + finalMessage);
    assertTrue(finalMessage.contains("of"), "Message should contain 'of': " + finalMessage);
    assertTrue(finalMessage.contains("batch"), "Message should contain 'batch': " + finalMessage);
  }

  @Test
  void test_importCsvWithNullCallback() throws IOException {
    List<String> records = new ArrayList<>();
    records.add("value1,value2,value3");
    String csv = createCsv(CSV_HEADERS, records);

    TestCsv testCsv = new TestCsv();
    CsvImportResult importResult = testCsv.importCsv(csv, true, null);

    // 2 rows: 1 header + 1 data row
    assertSummary(importResult, ApiStatus.SUCCESS, 2, 2, 0);
  }

  private static class TestCsv extends EntityCsv<EntityInterface> {
    protected TestCsv() {
      super(Entity.TABLE, CSV_HEADERS, "admin");
    }

    @Override
    protected void createEntity(CSVPrinter resultsPrinter, List<CSVRecord> records)
        throws IOException {
      CSVRecord csvRecord = getNextRecord(resultsPrinter, records);
      Table entity = new Table();
      entity.setName(csvRecord.get(0));
      entity.setFullyQualifiedName(csvRecord.get(0));
      createEntity(resultsPrinter, csvRecord, entity);
    }

    @Override
    protected void addRecord(CsvFile csvFile, EntityInterface entity) {}
  }
}

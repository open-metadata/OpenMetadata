package org.openmetadata.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.LINE_SEPARATOR;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsv.ENTITY_CREATED;
import static org.openmetadata.csv.EntityCsv.ENTITY_UPDATED;

import com.networknt.schema.Schema;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringWriter;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.StringEscapeUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.StoredProcedureLanguage;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.StoredProcedureRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.ValidatorUtil;

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

  @Test
  void test_referenceParsingResolvesOwnersDomainsAndUsers() {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.addEntity(Entity.USER, "alice", user("alice"));
    testCsv.addEntity(Entity.USER, "bob", user("bob"));
    testCsv.addEntity(Entity.TEAM, "engineering", team("engineering"));
    testCsv.addEntity(Entity.DOMAIN, "finance", domain("finance"));
    testCsv.addEntity(Entity.DOMAIN, "marketing", domain("marketing"));

    CSVRecord csvRecord =
        singleRecord(testCsv, "user:alice;team:engineering", "finance;marketing", "bob");

    List<EntityReference> owners = testCsv.parseOwners(csvRecord, 0);
    List<EntityReference> domains = testCsv.parseDomains(csvRecord, 1);
    EntityReference owner = testCsv.parseOwnerAsUser(csvRecord, 2);

    assertEquals(
        List.of("alice", "engineering"), owners.stream().map(EntityReference::getName).toList());
    assertEquals(
        List.of("finance", "marketing"), domains.stream().map(EntityReference::getName).toList());
    assertEquals("bob", owner.getName());
    assertTrue(testCsv.isProcessRecord());
  }

  @Test
  void test_invalidOwnersAndBooleansStopProcessing() {
    TestCsv ownerCsv = new TestCsv();
    ownerCsv.enableProcessing();
    CSVRecord invalidOwnerRecord = singleRecord(ownerCsv, "alice", "", "");

    List<EntityReference> owners = ownerCsv.parseOwners(invalidOwnerRecord, 0);

    assertTrue(owners.isEmpty());
    assertFalse(ownerCsv.isProcessRecord());
    assertEquals(ApiStatus.FAILURE, ownerCsv.status());

    TestCsv booleanCsv = new TestCsv();
    booleanCsv.enableProcessing();
    CSVRecord invalidBooleanRecord = singleRecord(booleanCsv, "", "not-a-boolean", "");

    Boolean value = booleanCsv.parseBoolean(invalidBooleanRecord, 1);

    assertFalse(value);
    assertFalse(booleanCsv.isProcessRecord());
    assertEquals(ApiStatus.FAILURE, booleanCsv.status());
  }

  @Test
  void test_entityReferencesAreSortedAndGlossaryTermsMustBeApproved() {
    TestCsv referenceCsv = new TestCsv();
    referenceCsv.enableProcessing();
    referenceCsv.addEntity(Entity.DOMAIN, "zeta", domain("zeta"));
    referenceCsv.addEntity(Entity.DOMAIN, "alpha", domain("alpha"));

    List<EntityReference> refs =
        referenceCsv.parseEntityReferences(
            singleRecord(referenceCsv, "zeta;alpha", "", ""), 0, Entity.DOMAIN);

    assertEquals(List.of("alpha", "zeta"), refs.stream().map(EntityReference::getName).toList());

    TestCsv glossaryCsv = new TestCsv();
    glossaryCsv.enableProcessing();
    glossaryCsv.addEntity(
        Entity.GLOSSARY_TERM,
        "Glossary.Approved",
        glossaryTerm("Glossary.Approved", EntityStatus.APPROVED));
    glossaryCsv.addEntity(
        Entity.GLOSSARY_TERM, "Glossary.Draft", glossaryTerm("Glossary.Draft", EntityStatus.DRAFT));

    List<EntityReference> glossaryRefs =
        glossaryCsv.parseGlossaryTerms(
            singleRecord(glossaryCsv, "Glossary.Approved;Glossary.Draft", "", ""), 0);

    assertNull(glossaryRefs);
    assertFalse(glossaryCsv.isProcessRecord());
    assertEquals(ApiStatus.FAILURE, glossaryCsv.status());
  }

  @Test
  void test_extensionValidationRejectsMalformedFields() throws IOException {
    TestCsv missingSeparatorCsv = new TestCsv();
    missingSeparatorCsv.enableProcessing();

    Map<String, Object> extension =
        missingSeparatorCsv.parseExtension(singleRecord(missingSeparatorCsv, "", "broken", ""), 1);

    assertNull(extension);
    assertFalse(missingSeparatorCsv.isProcessRecord());

    TestCsv emptyValueCsv = new TestCsv();
    emptyValueCsv.enableProcessing();

    Map<String, Object> emptyValueExtension =
        emptyValueCsv.parseExtension(singleRecord(emptyValueCsv, "", "key:", ""), 1);

    assertNull(emptyValueExtension);
    assertFalse(emptyValueCsv.isProcessRecord());
  }

  @Test
  void test_parseRecursivePadsAndTrimsRows() {
    TestCsv testCsv = new TestCsv();
    String csv =
        HEADER_STRING
            + "value1,value2"
            + LINE_SEPARATOR
            + "value3,value4,value5,value6"
            + LINE_SEPARATOR;

    List<CSVRecord> records = testCsv.parse(csv, true);

    assertEquals(3, records.size());
    assertEquals(List.of("h1*", "h2", "h3"), records.get(0).toList());
    assertEquals(List.of("value1", "value2", ""), records.get(1).toList());
    assertEquals(List.of("value3", "value4", "value5"), records.get(2).toList());
  }

  @Test
  void test_getNextRecordRejectsInvalidFieldCountsAndMissingRequiredFields() throws IOException {
    TestCsv wrongFieldCountCsv = new TestCsv();
    wrongFieldCountCsv.enableProcessing();

    CSVRecord wrongFieldCountRecord = wrongFieldCountCsv.parse("value1,value2").get(0);
    CSVRecord result =
        wrongFieldCountCsv.nextRecord(mock(CSVPrinter.class), List.of(wrongFieldCountRecord));

    assertNull(result);
    assertFalse(wrongFieldCountCsv.isProcessRecord());
    assertEquals(ApiStatus.FAILURE, wrongFieldCountCsv.status());

    TestCsv missingRequiredCsv = new TestCsv();
    missingRequiredCsv.enableProcessing();
    CSVRecord missingRequiredRecord = singleRecord(missingRequiredCsv, "", "value2", "value3");
    CSVRecord nextRecord =
        missingRequiredCsv.nextRecord(mock(CSVPrinter.class), List.of(missingRequiredRecord));

    assertNull(nextRecord);
    assertFalse(missingRequiredCsv.isProcessRecord());
    assertEquals(1, missingRequiredCsv.rowsFailed());
  }

  @Test
  void test_formattedDateTimeParsingSupportsExpectedFormats() {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    CSVRecord csvRecord = singleRecord(testCsv, "", "", "");

    assertEquals(
        "2026-03-09",
        testCsv.parseFormattedDateTime(
            csvRecord, 0, "startDate", "2026-03-09", "date-cp", "yyyy-MM-dd"));
    assertEquals(
        "2026-03-09 10:15",
        testCsv.parseFormattedDateTime(
            csvRecord, 0, "startDateTime", "2026-03-09 10:15", "dateTime-cp", "yyyy-MM-dd HH:mm"));
    assertEquals(
        "10:15",
        testCsv.parseFormattedDateTime(csvRecord, 0, "startTime", "10:15", "time-cp", "HH:mm"));

    TestCsv invalidCsv = new TestCsv();
    invalidCsv.enableProcessing();
    String invalid =
        invalidCsv.parseFormattedDateTime(
            singleRecord(invalidCsv, "", "", ""),
            0,
            "startDate",
            "03/09/2026",
            "date-cp",
            "yyyy-MM-dd");

    assertNull(invalid);
    assertFalse(invalidCsv.isProcessRecord());
  }

  @Test
  void test_privateNumericAndIntervalParsersHandleValidAndInvalidValues() throws Exception {
    TestCsv validCsv = new TestCsv();
    validCsv.enableProcessing();
    CSVRecord csvRecord = singleRecord(validCsv, "", "", "");

    assertEquals(
        Long.valueOf(42),
        invokePrivate(validCsv, "parseLongField", csvRecord, 0, "count", "number", "42"));
    assertEquals(
        Map.of("start", 100L, "end", 200L),
        invokePrivate(validCsv, "parseTimeInterval", csvRecord, 0, "window", "100:200"));

    TestCsv invalidLongCsv = new TestCsv();
    invalidLongCsv.enableProcessing();
    Object invalidLong =
        invokePrivate(
            invalidLongCsv,
            "parseLongField",
            singleRecord(invalidLongCsv, "", "", ""),
            0,
            "count",
            "integer",
            "forty-two");
    assertNull(invalidLong);
    assertFalse(invalidLongCsv.isProcessRecord());

    TestCsv invalidIntervalCsv = new TestCsv();
    invalidIntervalCsv.enableProcessing();
    Object invalidInterval =
        invokePrivate(
            invalidIntervalCsv,
            "parseTimeInterval",
            singleRecord(invalidIntervalCsv, "", "", ""),
            0,
            "window",
            "100:bad");
    assertNull(invalidInterval);
    assertFalse(invalidIntervalCsv.isProcessRecord());
  }

  @Test
  void test_privateEnumAndTableParsersValidateConfigs() throws Exception {
    TestCsv enumCsv = new TestCsv();
    enumCsv.enableProcessing();
    CSVRecord csvRecord = singleRecord(enumCsv, "", "", "");
    String enumConfig = "{\"multiSelect\":true,\"values\":[\"A\",\"B\",\"C\"]}";

    assertEquals(
        List.of("A", "B"),
        invokePrivate(
            enumCsv, "parseEnumType", csvRecord, 0, "priority", "enum", "A|B", enumConfig));

    TestCsv invalidEnumCsv = new TestCsv();
    invalidEnumCsv.enableProcessing();
    Object invalidEnum =
        invokePrivate(
            invalidEnumCsv,
            "parseEnumType",
            singleRecord(invalidEnumCsv, "", "", ""),
            0,
            "priority",
            "enum",
            "Z",
            enumConfig);
    assertEquals(List.of("Z"), invalidEnum);
    assertFalse(invalidEnumCsv.isProcessRecord());

    TestCsv tableCsv = new TestCsv();
    tableCsv.enableProcessing();
    String tableConfig = "{\"columns\":[\"name\",\"value\"]}";
    @SuppressWarnings("unchecked")
    Map<String, Object> tableValue =
        invokePrivate(
            tableCsv,
            "parseTableType",
            csvRecord,
            0,
            "matrix",
            "alpha,beta|gamma,delta",
            tableConfig);
    assertEquals(Set.of("name", "value"), tableValue.get("columns"));
    @SuppressWarnings("unchecked")
    List<Map<String, String>> rows = (List<Map<String, String>>) tableValue.get("rows");
    assertEquals(Map.of("name", "alpha", "value", "beta"), rows.get(0));
    assertEquals(Map.of("name", "gamma", "value", "delta"), rows.get(1));

    TestCsv invalidTableCsv = new TestCsv();
    invalidTableCsv.enableProcessing();
    Object invalidTable =
        invokePrivate(
            invalidTableCsv,
            "parseTableType",
            singleRecord(invalidTableCsv, "", "", ""),
            0,
            "matrix",
            "alpha,beta,gamma",
            tableConfig);
    assertNull(invalidTable);
    assertFalse(invalidTableCsv.isProcessRecord());
  }

  @Test
  void test_miscImportHelpersReturnStableContractValues() {
    AssetCertification certification = new TestCsv().getCertificationLabels("Tier.Tier1");
    assertNotNull(certification);
    assertEquals("Tier.Tier1", certification.getTagLabel().getTagFQN());
    assertEquals(TagLabel.TagSource.CLASSIFICATION, certification.getTagLabel().getSource());
    assertNull(new TestCsv().getCertificationLabels(null));

    List<CsvHeader> headers =
        new ArrayList<>(
            List.of(
                new CsvHeader().withName("required").withRequired(true),
                new CsvHeader().withName("optional").withRequired(false)));
    EntityCsv.resetRequiredColumns(headers, List.of("required"));
    assertNotEquals(Boolean.TRUE, headers.get(0).getRequired());

    assertTrue(EntityCsv.invalidBoolean(1, "maybe").contains("maybe"));
    assertTrue(new TestCsv().failed("boom", CsvErrorType.PARSER_FAILURE).contains("boom"));
  }

  @Test
  void test_exportCsvWritesRecordsAndReportsBatchProgress() throws IOException {
    TestCsv testCsv = new TestCsv();
    Table singleEntity = tableEntity("orders", "service.db.schema.orders", "Orders table");

    assertEquals(
        HEADER_STRING + "orders,service.db.schema.orders,Orders table" + LINE_SEPARATOR,
        testCsv.exportCsv(singleEntity));

    List<EntityInterface> entities = new ArrayList<>();
    for (int i = 0; i < EntityCsv.DEFAULT_BATCH_SIZE + 1; i++) {
      entities.add(tableEntity("table" + i, "service.db.schema.table" + i, "description-" + i));
    }

    List<Integer> exportedCounts = new ArrayList<>();
    List<Integer> totalCounts = new ArrayList<>();
    List<String> messages = new ArrayList<>();

    String csv =
        testCsv.exportCsv(
            entities,
            (exported, total, message) -> {
              exportedCounts.add(exported);
              totalCounts.add(total);
              messages.add(message);
            });

    assertEquals(
        List.of(EntityCsv.DEFAULT_BATCH_SIZE, EntityCsv.DEFAULT_BATCH_SIZE + 1), exportedCounts);
    assertEquals(
        List.of(EntityCsv.DEFAULT_BATCH_SIZE + 1, EntityCsv.DEFAULT_BATCH_SIZE + 1), totalCounts);
    assertTrue(messages.get(0).contains("batch 1"));
    assertTrue(messages.get(1).contains("batch 2"));
    assertTrue(csv.contains("table0,service.db.schema.table0,description-0"));
    assertTrue(csv.contains("table100,service.db.schema.table100,description-100"));

    String csvWithoutCallback = testCsv.exportCsv(entities.subList(0, 1));
    assertEquals(
        HEADER_STRING + "table0,service.db.schema.table0,description-0" + LINE_SEPARATOR,
        csvWithoutCallback);
  }

  @Test
  void test_getCsvDocumentationLoadsKnownResourcesAndHandlesMissingEntityType() {
    CsvDocumentation tableDocumentation = EntityCsv.getCsvDocumentation(Entity.TABLE, false);
    assertNotNull(tableDocumentation);
    assertTrue(tableDocumentation.getSummary().contains("Table CSV file"));
    assertEquals("column.name", tableDocumentation.getHeaders().get(0).getName());

    CsvDocumentation recursiveDocumentation = EntityCsv.getCsvDocumentation(Entity.TABLE, true);
    assertNotNull(recursiveDocumentation);
    assertTrue(recursiveDocumentation.getSummary().contains("Entity CSV file"));

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> EntityCsv.getCsvDocumentation("missing-entity-type", false));
    assertTrue(exception.getMessage().contains("missing-entity-type"));
  }

  @Test
  void test_getCsvDocumentationWrapsIoFailures() throws IOException {
    String path = ".*json/data/table/tableCsvDocumentation.json$";
    String resource = EntityUtil.getJsonDataResources(path).getFirst();
    try (MockedStatic<CommonUtil> commonUtil =
        Mockito.mockStatic(CommonUtil.class, Mockito.CALLS_REAL_METHODS)) {
      commonUtil
          .when(
              () ->
                  CommonUtil.getResourceAsStream(EntityRepository.class.getClassLoader(), resource))
          .thenThrow(new IOException("broken docs"));

      IllegalStateException exception =
          assertThrows(
              IllegalStateException.class,
              () -> EntityCsv.getCsvDocumentation(Entity.TABLE, false));

      assertTrue(exception.getMessage().contains("table"));
    }
  }

  @Test
  void test_getCsvDocumentationWrapsMalformedJsonDocumentation() throws IOException {
    String path = ".*json/data/table/tableCsvDocumentation.json$";
    String resource = EntityUtil.getJsonDataResources(path).getFirst();
    try (MockedStatic<CommonUtil> commonUtil =
        Mockito.mockStatic(CommonUtil.class, Mockito.CALLS_REAL_METHODS)) {
      commonUtil
          .when(
              () ->
                  CommonUtil.getResourceAsStream(EntityRepository.class.getClassLoader(), resource))
          .thenReturn("{not-json");

      IllegalStateException exception =
          assertThrows(
              IllegalStateException.class,
              () -> EntityCsv.getCsvDocumentation(Entity.TABLE, false));

      assertTrue(exception.getMessage().contains("table"));
      assertInstanceOf(JsonParsingException.class, exception.getCause());
    }
  }

  @Test
  void test_extensionValidationParsesEntityReferenceCustomProperties() throws IOException {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.addEntity(Entity.USER, "alice", user("alice"));
    testCsv.addEntity(Entity.USER, "bob", user("bob"));
    testCsv.addEntity(Entity.TEAM, "engineering", team("engineering"));

    Schema schema = mock(Schema.class);
    Mockito.when(schema.validate(Mockito.any())).thenReturn(List.of());

    TypeRegistry registry = mock(TypeRegistry.class);
    Mockito.when(registry.getSchema(Entity.TABLE, "owner")).thenReturn(schema);
    Mockito.when(registry.getSchema(Entity.TABLE, "reviewers")).thenReturn(schema);

    try (MockedStatic<TypeRegistry> typeRegistry = Mockito.mockStatic(TypeRegistry.class)) {
      typeRegistry.when(TypeRegistry::instance).thenReturn(registry);
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType(Entity.TABLE, "owner"))
          .thenReturn("entityReference");
      typeRegistry
          .when(() -> TypeRegistry.getCustomPropertyType(Entity.TABLE, "reviewers"))
          .thenReturn("entityReferenceList");

      Map<String, Object> extension =
          testCsv.parseExtension(
              singleRecord(testCsv, "", "owner:user:alice;reviewers:user:bob|team:engineering", ""),
              1);

      EntityReference owner = assertInstanceOf(EntityReference.class, extension.get("owner"));
      assertEquals("alice", owner.getName());
      @SuppressWarnings("unchecked")
      List<EntityReference> reviewers = (List<EntityReference>) extension.get("reviewers");
      assertEquals(
          List.of("bob", "engineering"), reviewers.stream().map(EntityReference::getName).toList());
      assertTrue(testCsv.isProcessRecord());
    }
  }

  @Test
  void test_updateColumnsFromCsvRecursiveCreatesMissingParentHierarchyInDryRun() throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(true);
    Table table =
        new Table()
            .withFullyQualifiedName("service.db.schema.orders")
            .withColumns(new ArrayList<>());

    testCsv.updateColumns(
        table,
        columnRecord(
            testCsv,
            "address.location.street",
            "Street",
            "Street column",
            "service.db.schema.orders.address.location.street",
            "VARCHAR(64)",
            "VARCHAR",
            "",
            "64"));

    assertEquals(1, table.getColumns().size());
    Column address = table.getColumns().get(0);
    assertEquals("address", address.getName());
    assertNotNull(address.getChildren());
    assertEquals(1, address.getChildren().size());
    Column location = address.getChildren().get(0);
    assertEquals("location", location.getName());
    assertNotNull(location.getChildren());
    assertEquals(1, location.getChildren().size());
    Column street = location.getChildren().get(0);
    assertEquals("street", street.getName());
    assertEquals("Street", street.getDisplayName());
    assertEquals("Street column", street.getDescription());
    assertEquals("VARCHAR(64)", street.getDataTypeDisplay());
    assertEquals(
        "service.db.schema.orders.address.location.street", street.getFullyQualifiedName());
    assertEquals(64, street.getDataLength());
    assertEquals(0, street.getOrdinalPosition());
  }

  @Test
  void test_createMissingParentHierarchyForDryRunInitializesTopLevelColumnList() throws Exception {
    TestCsv testCsv = new TestCsv();
    Table table = new Table().withFullyQualifiedName("service.db.schema.orders").withColumns(null);
    Method method =
        EntityCsv.class.getDeclaredMethod(
            "createMissingParentHierarchyForDryRun", Table.class, String.class);
    method.setAccessible(true);

    Column created = (Column) method.invoke(testCsv, table, "address");

    assertNotNull(table.getColumns());
    assertEquals(1, table.getColumns().size());
    assertSame(created, table.getColumns().get(0));
    assertEquals("address", created.getName());
  }

  @Test
  void test_createMissingParentHierarchyForDryRunReusesExistingParentsAndInitializesChildLists()
      throws Exception {
    TestCsv testCsv = new TestCsv();
    Column address =
        new Column()
            .withName("address")
            .withFullyQualifiedName("service.db.schema.orders.address")
            .withChildren(null);
    Table table =
        new Table()
            .withFullyQualifiedName("service.db.schema.orders")
            .withColumns(new ArrayList<>(List.of(address)));
    Method method =
        EntityCsv.class.getDeclaredMethod(
            "createMissingParentHierarchyForDryRun", Table.class, String.class);
    method.setAccessible(true);

    Column created = (Column) method.invoke(testCsv, table, "address.location");
    Column reused = (Column) method.invoke(testCsv, table, "address.location");

    assertEquals("address", address.getName());
    assertNotNull(address.getChildren());
    assertSame(created, reused);
    assertSame(created, address.getChildren().get(0));
  }

  @Test
  void test_updateColumnsFromCsvRecursiveRejectsMissingParentOutsideDryRun() throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(false);
    Table table =
        new Table()
            .withFullyQualifiedName("service.db.schema.orders")
            .withColumns(new ArrayList<>());

    testCsv.updateColumns(
        table,
        columnRecord(
            testCsv,
            "address.street",
            "Street",
            "",
            "service.db.schema.orders.address.street",
            "VARCHAR(32)",
            "VARCHAR",
            "",
            "32"));

    assertTrue(table.getColumns().isEmpty());
    assertFalse(testCsv.isProcessRecord());
    assertEquals(ApiStatus.FAILURE, testCsv.status());
    assertEquals(1, testCsv.rowsFailed());
  }

  @Test
  void test_updateColumnsFromCsvRecursiveValidatesDataTypeRequirements() throws Exception {
    Table invalidTypeTable =
        new Table()
            .withFullyQualifiedName("service.db.schema.orders")
            .withColumns(new ArrayList<>());
    TestCsv missingTypeCsv = new TestCsv();
    missingTypeCsv.enableProcessing();
    missingTypeCsv.setDryRun(true);
    IllegalArgumentException missingType =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                missingTypeCsv.updateColumns(
                    invalidTypeTable,
                    columnRecord(
                        missingTypeCsv,
                        "customer_id",
                        "",
                        "",
                        "service.db.schema.orders.customer_id",
                        "",
                        "",
                        "",
                        "")));
    assertTrue(missingType.getMessage().contains("Column dataType is mandatory"));

    TestCsv invalidDataTypeCsv = new TestCsv();
    invalidDataTypeCsv.enableProcessing();
    invalidDataTypeCsv.setDryRun(true);
    IllegalArgumentException invalidDataType =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                invalidDataTypeCsv.updateColumns(
                    new Table()
                        .withFullyQualifiedName("service.db.schema.orders")
                        .withColumns(new ArrayList<>()),
                    columnRecord(
                        invalidDataTypeCsv,
                        "customer_id",
                        "",
                        "",
                        "service.db.schema.orders.customer_id",
                        "",
                        "NOT_A_TYPE",
                        "",
                        "")));
    assertTrue(invalidDataType.getMessage().contains("Invalid dataType"));

    TestCsv missingArrayTypeCsv = new TestCsv();
    missingArrayTypeCsv.enableProcessing();
    missingArrayTypeCsv.setDryRun(true);
    IllegalArgumentException missingArrayType =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                missingArrayTypeCsv.updateColumns(
                    new Table()
                        .withFullyQualifiedName("service.db.schema.orders")
                        .withColumns(new ArrayList<>()),
                    columnRecord(
                        missingArrayTypeCsv,
                        "customer_ids",
                        "",
                        "",
                        "service.db.schema.orders.customer_ids",
                        "",
                        "ARRAY",
                        "",
                        "")));
    assertTrue(missingArrayType.getMessage().contains("Array data type is mandatory"));

    TestCsv invalidLengthCsv = new TestCsv();
    invalidLengthCsv.enableProcessing();
    invalidLengthCsv.setDryRun(true);
    IllegalArgumentException invalidLength =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                invalidLengthCsv.updateColumns(
                    new Table()
                        .withFullyQualifiedName("service.db.schema.orders")
                        .withColumns(new ArrayList<>()),
                    columnRecord(
                        invalidLengthCsv,
                        "customer_name",
                        "",
                        "",
                        "service.db.schema.orders.customer_name",
                        "",
                        "VARCHAR",
                        "",
                        "bad")));
    assertTrue(invalidLength.getMessage().contains("Invalid data length"));

    TestCsv tolerantLengthCsv = new TestCsv();
    tolerantLengthCsv.enableProcessing();
    tolerantLengthCsv.setDryRun(true);
    Table table =
        new Table()
            .withFullyQualifiedName("service.db.schema.orders")
            .withColumns(new ArrayList<>());

    tolerantLengthCsv.updateColumns(
        table,
        columnRecord(
            tolerantLengthCsv,
            "total",
            "",
            "",
            "service.db.schema.orders.total",
            "",
            "INT",
            "",
            "not-a-number"));

    assertEquals(1, table.getColumns().size());
    assertNull(table.getColumns().get(0).getDataLength());
  }

  @Test
  void test_createEntityAndFlushPendingEntityOperationsBatchesCreatesAndUpdates() throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(false);

    CSVRecord createRecord = singleRecord(testCsv, "service.db.schema.created_table", "", "");
    CSVRecord updateRecord = singleRecord(testCsv, "service.db.schema.updated_table", "", "");

    Table createdEntity =
        new Table()
            .withName("created_table")
            .withFullyQualifiedName("service.db.schema.created_table");
    Table originalEntity =
        new Table()
            .withId(UUID.randomUUID())
            .withName("updated_table")
            .withFullyQualifiedName("service.db.schema.updated_table");
    Table updatedEntity =
        new Table()
            .withName("updated_table")
            .withFullyQualifiedName("service.db.schema.updated_table");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    ChangeEvent createdChangeEvent =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntity(createdEntity)
            .withEventType(EventType.ENTITY_CREATED);
    ChangeEvent updatedChangeEvent =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntity(updatedEntity)
            .withEventType(EventType.ENTITY_UPDATED);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class);
        MockedStatic<FormatterUtil> formatterUtil = Mockito.mockStatic(FormatterUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil.when(() -> ValidatorUtil.validate(createdEntity)).thenReturn(null);
      validatorUtil.when(() -> ValidatorUtil.validate(updatedEntity)).thenReturn(null);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.createChangeEventForEntity(
                      "admin", EventType.ENTITY_CREATED, createdEntity))
          .thenReturn(createdChangeEvent);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.createChangeEventForEntity(
                      "admin", EventType.ENTITY_UPDATED, updatedEntity))
          .thenReturn(updatedChangeEvent);

      Mockito.when(repository.findMatchForImport(createdEntity)).thenReturn(null);
      Mockito.when(repository.findMatchForImport(updatedEntity)).thenReturn(originalEntity);
      Mockito.when(repository.createManyEntitiesForImport(List.of(createdEntity), "admin"))
          .thenReturn(List.of(createdEntity));
      Mockito.when(
              repository.updateManyEntitiesForImport(
                  List.of(originalEntity), List.of(updatedEntity), "admin", "admin"))
          .thenReturn(List.of(updatedEntity));

      testCsv.queueEntity(createRecord, createdEntity);
      testCsv.queueEntity(updateRecord, updatedEntity);
      testCsv.flushPendingEntityOperations();

      assertEquals(2, testCsv.importResult.getNumberOfRowsPassed());
      assertEquals(List.of(createdEntity, updatedEntity), testCsv.pendingSearchIndexUpdates);
      assertEquals(2, testCsv.pendingChangeEvents.size());
      assertTrue(testCsv.pendingEntityOperations.isEmpty());
      assertTrue(testCsv.pendingEntityFQNs.isEmpty());
    }
  }

  @Test
  void test_flushPendingEntityOperationsFallsBackToIndividualWritesOnBatchFailure()
      throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(false);

    CSVRecord successRecord = singleRecord(testCsv, "service.db.schema.success_table", "", "");
    CSVRecord failedRecord = singleRecord(testCsv, "service.db.schema.failed_table", "", "");

    Table successfulEntity =
        new Table()
            .withName("success_table")
            .withFullyQualifiedName("service.db.schema.success_table");
    Table failingEntity =
        new Table()
            .withName("failed_table")
            .withFullyQualifiedName("service.db.schema.failed_table");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil.when(() -> ValidatorUtil.validate(successfulEntity)).thenReturn(null);
      validatorUtil.when(() -> ValidatorUtil.validate(failingEntity)).thenReturn(null);

      Mockito.when(repository.findMatchForImport(successfulEntity)).thenReturn(null);
      Mockito.when(repository.findMatchForImport(failingEntity)).thenReturn(null);
      Mockito.when(
              repository.createManyEntitiesForImport(
                  List.of(successfulEntity, failingEntity), "admin"))
          .thenThrow(new IllegalStateException("batch insert failed"));
      Mockito.when(repository.createOrUpdate(null, successfulEntity, "admin"))
          .thenReturn(
              new PutResponse<>(
                  Response.Status.CREATED, successfulEntity, EventType.ENTITY_CREATED));
      Mockito.when(repository.createOrUpdate(null, failingEntity, "admin"))
          .thenThrow(new IllegalStateException("individual insert failed"));

      testCsv.queueEntity(successRecord, successfulEntity);
      testCsv.queueEntity(failedRecord, failingEntity);
      testCsv.flushPendingEntityOperations();

      assertEquals(1, testCsv.importResult.getNumberOfRowsPassed());
      assertEquals(1, testCsv.importResult.getNumberOfRowsFailed());
      assertEquals("individual insert failed", testCsv.pendingCsvResults.get(failedRecord));
      assertEquals(List.of(successfulEntity), testCsv.pendingSearchIndexUpdates);
      assertTrue(testCsv.pendingEntityOperations.isEmpty());
    }
  }

  @Test
  void test_createEntityDryRunTracksCreateAndUpdateStatuses() throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(true);

    Table createdEntity =
        tableEntity("created_table", "service.db.schema.created_table", "Created");
    Table originalEntity =
        tableEntity("updated_table", "service.db.schema.updated_table", "Original");
    originalEntity.setId(UUID.randomUUID());
    Table updatedEntity =
        tableEntity("updated_table", "service.db.schema.updated_table", "Updated");
    CSVRecord createRecord = singleRecord(testCsv, createdEntity.getFullyQualifiedName(), "", "");
    CSVRecord updateRecord = singleRecord(testCsv, updatedEntity.getFullyQualifiedName(), "", "");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil.when(() -> ValidatorUtil.validate(createdEntity)).thenReturn(null);
      validatorUtil.when(() -> ValidatorUtil.validate(updatedEntity)).thenReturn(null);
      Mockito.when(repository.findMatchForImport(createdEntity)).thenReturn(null);
      Mockito.when(repository.findMatchForImport(updatedEntity)).thenReturn(originalEntity);

      testCsv.queueEntity(createRecord, createdEntity);
      testCsv.queueEntity(updateRecord, updatedEntity);

      assertEquals(2, testCsv.importResult.getNumberOfRowsPassed());
      assertTrue(testCsv.pendingEntityOperations.isEmpty());
      assertEquals(ENTITY_CREATED, testCsv.pendingCsvResults.get(createRecord));
      assertEquals(ENTITY_UPDATED, testCsv.pendingCsvResults.get(updateRecord));
      assertEquals(
          createdEntity, testCsv.dryRunCreatedEntities.get(createdEntity.getFullyQualifiedName()));
      assertEquals(
          updatedEntity, testCsv.dryRunCreatedEntities.get(updatedEntity.getFullyQualifiedName()));
      Mockito.verify(ruleEngine).evaluate(createdEntity);
      Mockito.verify(ruleEngine).evaluateUpdate(originalEntity, updatedEntity);
    }
  }

  @Test
  void test_createEntityFlushesPendingOperationsWhenPrepareInternalNeedsDependencies()
      throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(false);

    Table firstEntity = tableEntity("first_table", "service.db.schema.first_table", "First");
    Table dependentEntity =
        tableEntity("dependent_table", "service.db.schema.dependent_table", "Dependent");
    CSVRecord firstRecord = singleRecord(testCsv, firstEntity.getFullyQualifiedName(), "", "");
    CSVRecord dependentRecord =
        singleRecord(testCsv, dependentEntity.getFullyQualifiedName(), "", "");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);
    ChangeEvent createdChangeEvent =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntity(firstEntity)
            .withEventType(EventType.ENTITY_CREATED);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class);
        MockedStatic<FormatterUtil> formatterUtil = Mockito.mockStatic(FormatterUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil.when(() -> ValidatorUtil.validate(firstEntity)).thenReturn(null);
      validatorUtil.when(() -> ValidatorUtil.validate(dependentEntity)).thenReturn(null);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.createChangeEventForEntity(
                      "admin", EventType.ENTITY_CREATED, firstEntity))
          .thenReturn(createdChangeEvent);
      Mockito.when(repository.findMatchForImport(firstEntity)).thenReturn(null);
      Mockito.when(repository.findMatchForImport(dependentEntity)).thenReturn(null);
      Mockito.when(repository.createManyEntitiesForImport(Mockito.anyList(), Mockito.eq("admin")))
          .thenReturn(List.of(firstEntity));
      Mockito.doNothing().when(repository).prepareInternal(firstEntity, false);
      Mockito.doThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  dependentEntity.getFullyQualifiedName()))
          .doNothing()
          .when(repository)
          .prepareInternal(dependentEntity, false);

      testCsv.queueEntity(firstRecord, firstEntity);
      testCsv.queueEntity(dependentRecord, dependentEntity);

      Mockito.verify(repository, Mockito.times(2)).prepareInternal(dependentEntity, false);
      assertEquals(1, testCsv.importResult.getNumberOfRowsPassed());
      assertEquals(1, testCsv.pendingEntityOperations.size());
      assertEquals(dependentEntity, testCsv.pendingEntityOperations.get(0).entity);
      assertEquals(List.of(firstEntity), testCsv.pendingSearchIndexUpdates);
      assertEquals(1, testCsv.pendingChangeEvents.size());
      assertFalse(testCsv.pendingEntityFQNs.contains(firstEntity.getFullyQualifiedName()));
      assertTrue(testCsv.pendingEntityFQNs.contains(dependentEntity.getFullyQualifiedName()));
    }
  }

  @Test
  void test_createEntityValidationAndUnexpectedFailuresRecordImportErrors() throws Exception {
    TestCsv validationCsv = new TestCsv();
    validationCsv.enableProcessing();
    validationCsv.setDryRun(true);
    Table invalidEntity =
        tableEntity("invalid_table", "service.db.schema.invalid_table", "Invalid");
    CSVRecord validationRecord =
        singleRecord(validationCsv, invalidEntity.getFullyQualifiedName(), "", "");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> validationRepository = mock(EntityRepository.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(validationRepository);
      validatorUtil.when(() -> ValidatorUtil.validate(invalidEntity)).thenReturn("[name missing]");

      validationCsv.queueEntity(validationRecord, invalidEntity);

      assertEquals(1, validationCsv.importResult.getNumberOfRowsFailed());
      assertFalse(validationCsv.isProcessRecord());
      assertTrue(validationCsv.pendingEntityOperations.isEmpty());
      Mockito.verify(validationRepository, Mockito.never()).findMatchForImport(invalidEntity);
    }

    TestCsv failingCsv = new TestCsv();
    failingCsv.enableProcessing();
    failingCsv.setDryRun(false);
    Table failingEntity =
        tableEntity("failing_table", "service.db.schema.failing_table", "Failing");
    CSVRecord failingRecord =
        singleRecord(failingCsv, failingEntity.getFullyQualifiedName(), "", "");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> failingRepository = mock(EntityRepository.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(failingRepository);
      validatorUtil.when(() -> ValidatorUtil.validate(failingEntity)).thenReturn(null);
      Mockito.doThrow(new IllegalStateException("prepare failure"))
          .when(failingRepository)
          .setFullyQualifiedName(failingEntity);

      failingCsv.queueEntity(failingRecord, failingEntity);

      assertEquals(1, failingCsv.importResult.getNumberOfRowsFailed());
      assertEquals(ApiStatus.FAILURE, failingCsv.importResult.getStatus());
      assertEquals("prepare failure", failingCsv.pendingCsvResults.get(failingRecord));
      assertTrue(failingCsv.pendingEntityOperations.isEmpty());
    }
  }

  @Test
  void test_createEntityWithTypeDryRunTracksCreateAndUpdateStatuses() throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(true);

    Table createdEntity =
        tableEntity("typed_created", "service.db.schema.typed_created", "Created");
    Table originalEntity =
        tableEntity("typed_updated", "service.db.schema.typed_updated", "Original");
    originalEntity.setId(UUID.randomUUID());
    Table updatedEntity =
        tableEntity("typed_updated", "service.db.schema.typed_updated", "Updated");
    CSVRecord createRecord = singleRecord(testCsv, createdEntity.getFullyQualifiedName(), "", "");
    CSVRecord updateRecord = singleRecord(testCsv, updatedEntity.getFullyQualifiedName(), "", "");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil.when(() -> ValidatorUtil.validate(createdEntity)).thenReturn(null);
      validatorUtil.when(() -> ValidatorUtil.validate(updatedEntity)).thenReturn(null);
      Mockito.when(repository.findMatchForImport(createdEntity)).thenReturn(null);
      Mockito.when(repository.findMatchForImport(updatedEntity)).thenReturn(originalEntity);

      testCsv.queueEntityWithType(createRecord, createdEntity, Entity.TABLE);
      testCsv.queueEntityWithType(updateRecord, updatedEntity, Entity.TABLE);

      assertEquals(2, testCsv.importResult.getNumberOfRowsPassed());
      assertTrue(testCsv.pendingEntityOperations.isEmpty());
      assertEquals(ENTITY_CREATED, testCsv.pendingCsvResults.get(createRecord));
      assertEquals(ENTITY_UPDATED, testCsv.pendingCsvResults.get(updateRecord));
      assertEquals(
          createdEntity, testCsv.dryRunCreatedEntities.get(createdEntity.getFullyQualifiedName()));
      assertEquals(
          updatedEntity, testCsv.dryRunCreatedEntities.get(updatedEntity.getFullyQualifiedName()));
      Mockito.verify(ruleEngine).evaluate(createdEntity);
      Mockito.verify(ruleEngine).evaluateUpdate(originalEntity, updatedEntity);
    }
  }

  @Test
  void test_createEntityWithTypeFlushesPendingOperationsWhenPrepareInternalNeedsDependencies()
      throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(false);

    Table firstEntity = tableEntity("typed_first", "service.db.schema.typed_first", "First");
    Table dependentEntity =
        tableEntity("typed_dependent", "service.db.schema.typed_dependent", "Dependent");
    CSVRecord firstRecord = singleRecord(testCsv, firstEntity.getFullyQualifiedName(), "", "");
    CSVRecord dependentRecord =
        singleRecord(testCsv, dependentEntity.getFullyQualifiedName(), "", "");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);
    ChangeEvent createdChangeEvent =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntity(firstEntity)
            .withEventType(EventType.ENTITY_CREATED);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class);
        MockedStatic<FormatterUtil> formatterUtil = Mockito.mockStatic(FormatterUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil.when(() -> ValidatorUtil.validate(firstEntity)).thenReturn(null);
      validatorUtil.when(() -> ValidatorUtil.validate(dependentEntity)).thenReturn(null);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.createChangeEventForEntity(
                      "admin", EventType.ENTITY_CREATED, firstEntity))
          .thenReturn(createdChangeEvent);
      Mockito.when(repository.findMatchForImport(firstEntity)).thenReturn(null);
      Mockito.when(repository.findMatchForImport(dependentEntity)).thenReturn(null);
      Mockito.when(repository.createManyEntitiesForImport(Mockito.anyList(), Mockito.eq("admin")))
          .thenReturn(List.of(firstEntity));
      Mockito.doNothing().when(repository).prepareInternal(firstEntity, false);
      Mockito.doThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  dependentEntity.getFullyQualifiedName()))
          .doNothing()
          .when(repository)
          .prepareInternal(dependentEntity, false);

      testCsv.queueEntityWithType(firstRecord, firstEntity, Entity.TABLE);
      testCsv.queueEntityWithType(dependentRecord, dependentEntity, Entity.TABLE);

      Mockito.verify(repository, Mockito.times(2)).prepareInternal(dependentEntity, false);
      assertEquals(1, testCsv.importResult.getNumberOfRowsPassed());
      assertEquals(1, testCsv.pendingEntityOperations.size());
      assertEquals(dependentEntity, testCsv.pendingEntityOperations.get(0).entity);
      assertEquals(List.of(firstEntity), testCsv.pendingSearchIndexUpdates);
      assertEquals(1, testCsv.pendingChangeEvents.size());
      assertFalse(testCsv.pendingEntityFQNs.contains(firstEntity.getFullyQualifiedName()));
      assertTrue(testCsv.pendingEntityFQNs.contains(dependentEntity.getFullyQualifiedName()));
    }
  }

  @Test
  void test_createEntityWithTypeValidationAndUnexpectedFailuresRecordImportErrors()
      throws Exception {
    TestCsv validationCsv = new TestCsv();
    validationCsv.enableProcessing();
    validationCsv.setDryRun(true);
    Table invalidEntity =
        tableEntity("typed_invalid", "service.db.schema.typed_invalid", "Invalid");
    CSVRecord validationRecord =
        singleRecord(validationCsv, invalidEntity.getFullyQualifiedName(), "", "");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> validationRepository = mock(EntityRepository.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(validationRepository);
      validatorUtil.when(() -> ValidatorUtil.validate(invalidEntity)).thenReturn("[typed missing]");

      validationCsv.queueEntityWithType(validationRecord, invalidEntity, Entity.TABLE);

      assertEquals(1, validationCsv.importResult.getNumberOfRowsFailed());
      assertFalse(validationCsv.isProcessRecord());
      assertTrue(validationCsv.pendingEntityOperations.isEmpty());
      Mockito.verify(validationRepository, Mockito.never()).findMatchForImport(invalidEntity);
    }

    TestCsv failingCsv = new TestCsv();
    failingCsv.enableProcessing();
    failingCsv.setDryRun(false);
    Table failingEntity =
        tableEntity("typed_failing", "service.db.schema.typed_failing", "Failing");
    CSVRecord failingRecord =
        singleRecord(failingCsv, failingEntity.getFullyQualifiedName(), "", "");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> failingRepository = mock(EntityRepository.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(failingRepository);
      validatorUtil.when(() -> ValidatorUtil.validate(failingEntity)).thenReturn(null);
      Mockito.doThrow(new IllegalStateException("typed prepare failure"))
          .when(failingRepository)
          .setFullyQualifiedName(failingEntity);

      failingCsv.queueEntityWithType(failingRecord, failingEntity, Entity.TABLE);

      assertEquals(1, failingCsv.importResult.getNumberOfRowsFailed());
      assertEquals(ApiStatus.FAILURE, failingCsv.importResult.getStatus());
      assertEquals("typed prepare failure", failingCsv.pendingCsvResults.get(failingRecord));
      assertTrue(failingCsv.pendingEntityOperations.isEmpty());
    }
  }

  @Test
  void test_changeEventHelpersHandleNoChangeAndQueueEvents() throws Exception {
    TestCsv testCsv = new TestCsv();
    Table entity = tableEntity("orders", "service.db.schema.orders", "Orders");
    PutResponse<EntityInterface> updatedResponse =
        new PutResponse<>(Response.Status.OK, entity, EventType.ENTITY_UPDATED);
    PutResponse<EntityInterface> noChangeResponse =
        new PutResponse<>(Response.Status.OK, entity, EventType.ENTITY_NO_CHANGE);
    ChangeEvent changeEvent =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntity(entity)
            .withEventType(EventType.ENTITY_UPDATED);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);

    Mockito.when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);

    try (MockedStatic<Entity> entityStatic = Mockito.mockStatic(Entity.class);
        MockedStatic<FormatterUtil> formatterUtil = Mockito.mockStatic(FormatterUtil.class)) {
      entityStatic.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.createChangeEventForEntity(
                      "admin", EventType.ENTITY_UPDATED, entity))
          .thenReturn(changeEvent);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.createChangeEventForEntity(
                      "admin", EventType.ENTITY_CREATED, entity))
          .thenReturn(
              new ChangeEvent()
                  .withEntityType(Entity.TABLE)
                  .withEntity(entity)
                  .withEventType(EventType.ENTITY_CREATED));

      testCsv.invokeCreateChangeEventAndUpdateInES(updatedResponse, "admin");
      testCsv.invokeCreateChangeEventAndUpdateInES(noChangeResponse, "admin");
      testCsv.invokeCreateChangeEventForBatchedEntity(entity, EventType.ENTITY_CREATED);

      assertEquals(List.of(entity), testCsv.pendingSearchIndexUpdates);
      assertEquals(1, testCsv.pendingChangeEvents.size());
      assertTrue(testCsv.pendingChangeEvents.get(0).contains(entity.getFullyQualifiedName()));
      Mockito.verify(changeEventDAO).insert(Mockito.anyString());
    }
  }

  @Test
  void test_flushPendingTableUpdatesPatchesTablesAndTracksDryRunEntities() {
    TestCsv testCsv = new TestCsv();
    testCsv.setDryRun(false);

    Table original =
        new Table().withId(UUID.randomUUID()).withFullyQualifiedName("service.db.schema.orders");
    Table updated =
        new Table().withId(original.getId()).withFullyQualifiedName("service.db.schema.orders");
    CSVRecord record =
        columnRecord(
            testCsv,
            "customer_id",
            "",
            "",
            "service.db.schema.orders.customer_id",
            "",
            "INT",
            "",
            "");

    TableRepository repository = mock(TableRepository.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      testCsv.queuePendingTableUpdate("service.db.schema.orders", original, updated, record);

      testCsv.flushPendingTableUpdates(mock(CSVPrinter.class));

      Mockito.verify(repository)
          .patch(
              Mockito.isNull(), Mockito.eq(original.getId()), Mockito.eq("admin"), Mockito.any());
      assertTrue(testCsv.pendingTableUpdates.isEmpty());
      assertEquals(1, testCsv.importResult.getNumberOfRowsPassed());
      assertEquals(0, testCsv.importResult.getNumberOfRowsFailed());
    }
  }

  @Test
  void test_flushPendingTableUpdatesMarksCsvRowsFailedWhenPatchFails() {
    TestCsv testCsv = new TestCsv();
    testCsv.setDryRun(false);

    Table original =
        new Table().withId(UUID.randomUUID()).withFullyQualifiedName("service.db.schema.orders");
    Table updated =
        new Table().withId(original.getId()).withFullyQualifiedName("service.db.schema.orders");
    CSVRecord record =
        columnRecord(
            testCsv,
            "customer_id",
            "",
            "",
            "service.db.schema.orders.customer_id",
            "",
            "INT",
            "",
            "");

    TableRepository repository = mock(TableRepository.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      Mockito.doThrow(new IllegalStateException("patch failed"))
          .when(repository)
          .patch(
              Mockito.isNull(), Mockito.eq(original.getId()), Mockito.eq("admin"), Mockito.any());
      testCsv.queuePendingTableUpdate("service.db.schema.orders", original, updated, record);

      testCsv.flushPendingTableUpdates(mock(CSVPrinter.class));

      assertEquals(ApiStatus.PARTIAL_SUCCESS, testCsv.importResult.getStatus());
      assertEquals(0, testCsv.importResult.getNumberOfRowsPassed());
      assertEquals(1, testCsv.importResult.getNumberOfRowsFailed());
      assertEquals("patch failed", testCsv.pendingCsvResults.get(record));
      assertTrue(testCsv.pendingTableUpdates.isEmpty());
    }
  }

  @Test
  void test_createColumnEntityUsesPendingTableFromCurrentBatch() {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(false);

    Table pendingTable =
        new Table()
            .withFullyQualifiedName("service.db.schema.orders")
            .withColumns(new ArrayList<>());
    testCsv.dryRunCreatedEntities.put(pendingTable.getFullyQualifiedName(), pendingTable);
    testCsv.pendingEntityFQNs.add(pendingTable.getFullyQualifiedName());

    CSVRecord record =
        columnRecord(
            testCsv,
            "customer_id",
            "Customer Id",
            "Customer identifier",
            "service.db.schema.orders.customer_id",
            "",
            "INT",
            "",
            "");

    testCsv.createColumnEntity(
        mock(CSVPrinter.class), record, "service.db.schema.orders.customer_id");

    assertEquals(1, pendingTable.getColumns().size());
    Column column = pendingTable.getColumns().get(0);
    assertEquals("customer_id", column.getName());
    assertEquals(ENTITY_UPDATED, testCsv.pendingCsvResults.get(record));
    assertEquals(1, testCsv.importResult.getNumberOfRowsPassed());
  }

  @Test
  void test_getEntityWithDependencyResolutionFlushesPendingEntitiesAndRetriesLookup()
      throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(false);

    CSVRecord record = singleRecord(testCsv, "service.db.schema.pending_table", "", "");
    Table pendingEntity =
        new Table()
            .withName("pending_table")
            .withFullyQualifiedName("service.db.schema.pending_table");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);
    ChangeEvent createdChangeEvent =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntity(pendingEntity)
            .withEventType(EventType.ENTITY_CREATED);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class);
        MockedStatic<FormatterUtil> formatterUtil = Mockito.mockStatic(FormatterUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TABLE,
                      "service.db.schema.pending_table",
                      "owners",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName("pending_table"))
          .thenReturn(pendingEntity);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil.when(() -> ValidatorUtil.validate(pendingEntity)).thenReturn(null);
      formatterUtil
          .when(
              () ->
                  FormatterUtil.createChangeEventForEntity(
                      "admin", EventType.ENTITY_CREATED, pendingEntity))
          .thenReturn(createdChangeEvent);

      Mockito.when(repository.findMatchForImport(pendingEntity)).thenReturn(null);
      Mockito.when(repository.createManyEntitiesForImport(List.of(pendingEntity), "admin"))
          .thenReturn(List.of(pendingEntity));

      testCsv.queueEntity(record, pendingEntity);

      EntityInterface resolved =
          testCsv.getEntityWithDependencyResolution(
              Entity.TABLE,
              "service.db.schema.pending_table",
              "owners",
              org.openmetadata.schema.type.Include.NON_DELETED);

      assertEquals(pendingEntity, resolved);
      assertTrue(testCsv.pendingEntityOperations.isEmpty());
      assertTrue(testCsv.pendingEntityFQNs.isEmpty());
    }
  }

  @Test
  void test_createSchemaEntityDryRunBuildsSchemaFromMissingDatabase() throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(true);

    CSVRecord record = entityRecord(testCsv, "sales", "Sales", "Sales schema");
    DatabaseSchemaRepository repository = mock(DatabaseSchemaRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityByNameWithExcludedFields(
                      Entity.DATABASE,
                      "service.db",
                      "owners,tags,domains,extension",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName("service.db"));
      entity
          .when(
              () ->
                  Entity.getEntityByNameWithExcludedFields(
                      Entity.DATABASE_SCHEMA,
                      "service.db.sales",
                      "owners,tags,domains,extension",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  "service.db.sales"));
      entity.when(() -> Entity.getEntityRepository(Entity.DATABASE_SCHEMA)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil
          .when(() -> ValidatorUtil.validate(Mockito.any(DatabaseSchema.class)))
          .thenReturn(null);

      DatabaseSchema[] captured = new DatabaseSchema[1];
      Mockito.doAnswer(
              invocation -> {
                captured[0] = invocation.getArgument(0);
                return null;
              })
          .when(repository)
          .findMatchForImport(Mockito.any(DatabaseSchema.class));

      testCsv.createSchemaEntity(mock(CSVPrinter.class), record, "service.db.sales");

      assertNotNull(captured[0]);
      assertEquals("sales", captured[0].getName());
      assertEquals("Sales", captured[0].getDisplayName());
      assertEquals("Sales schema", captured[0].getDescription());
      assertEquals("service.db.sales", captured[0].getFullyQualifiedName());
      assertEquals("service.db", captured[0].getDatabase().getName());
      assertEquals(ENTITY_CREATED, testCsv.pendingCsvResults.get(record));
      assertEquals(1, testCsv.importResult.getNumberOfRowsPassed());
      assertEquals(captured[0], testCsv.dryRunCreatedEntities.get("service.db.sales"));
    }
  }

  @Test
  void test_createSchemaEntityRequiresFqnAndExistingDatabaseOutsideDryRun() {
    TestCsv nullFqnCsv = new TestCsv();
    nullFqnCsv.enableProcessing();

    IllegalArgumentException missingFqn =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                nullFqnCsv.createSchemaEntity(
                    mock(CSVPrinter.class), entityRecord(nullFqnCsv, "sales", "", ""), null));
    assertEquals(
        "Schema import requires fullyQualifiedName to determine the schema it belongs to",
        missingFqn.getMessage());

    TestCsv missingDatabaseCsv = new TestCsv();
    missingDatabaseCsv.enableProcessing();
    missingDatabaseCsv.setDryRun(false);
    CSVRecord record = entityRecord(missingDatabaseCsv, "sales", "Sales", "Sales schema");

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityByNameWithExcludedFields(
                      Entity.DATABASE,
                      "service.db",
                      "owners,tags,domains,extension",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName("service.db"));

      IllegalArgumentException missingDatabase =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  missingDatabaseCsv.createSchemaEntity(
                      mock(CSVPrinter.class), record, "service.db.sales"));
      assertEquals("Database not found: service.db", missingDatabase.getMessage());
    }
  }

  @Test
  void test_createTableEntityDryRunSimulatesMissingSchemaAndTable() throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(true);

    String tableFqn = "service.db.schema.orders";
    CSVRecord record = entityRecord(testCsv, "orders", "Orders", "Orders table");
    TableRepository repository = mock(TableRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.DATABASE_SCHEMA,
                      "service.db.schema",
                      "name,displayName,service,database",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  "service.db.schema"));
      entity
          .when(
              () ->
                  Entity.getEntityByNameWithExcludedFields(
                      Entity.TABLE,
                      tableFqn,
                      "owners,tags,domains,extension",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(org.openmetadata.service.exception.EntityNotFoundException.byName(tableFqn));
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil.when(() -> ValidatorUtil.validate(Mockito.any(Table.class))).thenReturn(null);

      Table[] captured = new Table[1];
      Mockito.doAnswer(
              invocation -> {
                captured[0] = invocation.getArgument(0);
                return null;
              })
          .when(repository)
          .findMatchForImport(Mockito.any(Table.class));

      testCsv.createTableEntity(mock(CSVPrinter.class), record, tableFqn);

      assertNotNull(captured[0]);
      assertEquals("orders", captured[0].getName());
      assertEquals(tableFqn, captured[0].getFullyQualifiedName());
      assertNull(captured[0].getDatabase());
      assertNull(captured[0].getService());
      assertEquals(0, captured[0].getColumns().size());
      assertEquals(ENTITY_CREATED, testCsv.pendingCsvResults.get(record));
      assertEquals(1, testCsv.importResult.getNumberOfRowsPassed());
      assertEquals(captured[0], testCsv.dryRunCreatedEntities.get(tableFqn));
    }
  }

  @Test
  void test_createTableEntityRejectsMissingFqnAndSchemaOutsideDryRun() {
    TestCsv nullFqnCsv = new TestCsv();
    nullFqnCsv.enableProcessing();

    IllegalArgumentException missingFqn =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                nullFqnCsv.createTableEntity(
                    mock(CSVPrinter.class), entityRecord(nullFqnCsv, "orders", "", ""), null));
    assertEquals(
        "Table import requires fullyQualifiedName to determine the schema it belongs to",
        missingFqn.getMessage());

    TestCsv missingSchemaCsv = Mockito.spy(new TestCsv());
    missingSchemaCsv.enableProcessing();
    missingSchemaCsv.setDryRun(false);
    CSVRecord record = entityRecord(missingSchemaCsv, "orders", "Orders", "Orders table");

    Mockito.doThrow(
            org.openmetadata.service.exception.EntityNotFoundException.byName("service.db.schema"))
        .when(missingSchemaCsv)
        .getEntityWithDependencyResolution(
            Entity.DATABASE_SCHEMA,
            "service.db.schema",
            "name,displayName,service,database",
            org.openmetadata.schema.type.Include.NON_DELETED);

    IllegalArgumentException missingSchema =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                missingSchemaCsv.createTableEntity(
                    mock(CSVPrinter.class), record, "service.db.schema.orders"));
    assertEquals("Schema not found: service.db.schema", missingSchema.getMessage());
  }

  @Test
  void test_createTableEntityQueuesNewTableUsingResolvedSchema() throws Exception {
    TestCsv testCsv = Mockito.spy(new TestCsv());
    testCsv.enableProcessing();
    testCsv.setDryRun(false);

    DatabaseSchema schema =
        new DatabaseSchema()
            .withId(UUID.randomUUID())
            .withName("schema")
            .withFullyQualifiedName("service.db.schema")
            .withDatabase(new EntityReference().withId(UUID.randomUUID()).withName("service.db"))
            .withService(new EntityReference().withId(UUID.randomUUID()).withName("service"));
    String tableFqn = "service.db.schema.orders";
    CSVRecord record = entityRecord(testCsv, "orders", "Orders", "Orders table");
    TableRepository repository = mock(TableRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    Mockito.doReturn(schema)
        .when(testCsv)
        .getEntityWithDependencyResolution(
            Entity.DATABASE_SCHEMA,
            "service.db.schema",
            "name,displayName,service,database",
            org.openmetadata.schema.type.Include.NON_DELETED);
    Mockito.doThrow(org.openmetadata.service.exception.EntityNotFoundException.byName(tableFqn))
        .when(testCsv)
        .getEntityWithDependencyResolution(
            Entity.TABLE,
            tableFqn,
            "owners,tags,domains,extension",
            org.openmetadata.schema.type.Include.NON_DELETED);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil.when(() -> ValidatorUtil.validate(Mockito.any(Table.class))).thenReturn(null);

      Table[] captured = new Table[1];
      Mockito.doAnswer(
              invocation -> {
                captured[0] = invocation.getArgument(0);
                return null;
              })
          .when(repository)
          .findMatchForImport(Mockito.any(Table.class));

      testCsv.createTableEntity(mock(CSVPrinter.class), record, tableFqn);

      assertNotNull(captured[0]);
      assertEquals("orders", captured[0].getName());
      assertEquals(tableFqn, captured[0].getFullyQualifiedName());
      assertEquals("service.db", captured[0].getDatabase().getName());
      assertEquals("schema", captured[0].getDatabaseSchema().getName());
      assertEquals("Orders", captured[0].getDisplayName());
      assertEquals("Orders table", captured[0].getDescription());
      assertEquals(1, testCsv.pendingEntityOperations.size());
      assertTrue(testCsv.pendingEntityFQNs.contains(tableFqn));
      assertEquals(ENTITY_CREATED, testCsv.pendingCsvResults.get(record));
    }
  }

  @Test
  void test_createStoredProcedureEntityRejectsMissingFqnAndSchemaOutsideDryRun() {
    TestCsv nullFqnCsv = new TestCsv();
    nullFqnCsv.enableProcessing();
    CSVRecord nullFqnRecord =
        storedProcedureRecord(
            nullFqnCsv, "daily_sales", "Daily Sales", "Daily sales procedure", "select 1", "SQL");

    IllegalArgumentException missingFqn =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                nullFqnCsv.createStoredProcedureEntity(
                    mock(CSVPrinter.class), nullFqnRecord, null));
    assertEquals(
        "Stored procedure import requires fullyQualifiedName to determine the schema it belongs to",
        missingFqn.getMessage());

    TestCsv missingSchemaCsv = Mockito.spy(new TestCsv());
    missingSchemaCsv.enableProcessing();
    missingSchemaCsv.setDryRun(false);
    CSVRecord record =
        storedProcedureRecord(
            missingSchemaCsv,
            "daily_sales",
            "Daily Sales",
            "Daily sales procedure",
            "select 1",
            "SQL");

    Mockito.doThrow(
            org.openmetadata.service.exception.EntityNotFoundException.byName("service.db.schema"))
        .when(missingSchemaCsv)
        .getEntityWithDependencyResolution(
            Entity.DATABASE_SCHEMA,
            "service.db.schema",
            "name,displayName,service,database",
            org.openmetadata.schema.type.Include.NON_DELETED);

    IllegalArgumentException missingSchema =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                missingSchemaCsv.createStoredProcedureEntity(
                    mock(CSVPrinter.class), record, "service.db.schema.daily_sales"));
    assertEquals("Schema not found: service.db.schema", missingSchema.getMessage());
  }

  @Test
  void test_createStoredProcedureEntityDryRunBuildsStoredProcedureCode() throws Exception {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(true);

    String storedProcedureFqn = "service.db.schema.daily_sales";
    CSVRecord record =
        storedProcedureRecord(
            testCsv, "daily_sales", "Daily Sales", "Daily sales procedure", "select 1", "SQL");
    StoredProcedureRepository repository = mock(StoredProcedureRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.DATABASE_SCHEMA,
                      "service.db.schema",
                      "name,displayName,service,database",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  "service.db.schema"));
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.STORED_PROCEDURE,
                      storedProcedureFqn,
                      "name,displayName,fullyQualifiedName",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  storedProcedureFqn));
      entity.when(() -> Entity.getEntityRepository(Entity.STORED_PROCEDURE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil
          .when(() -> ValidatorUtil.validate(Mockito.any(StoredProcedure.class)))
          .thenReturn(null);

      Mockito.doAnswer(
              invocation -> {
                StoredProcedure storedProcedure = invocation.getArgument(0);
                storedProcedure.setFullyQualifiedName(storedProcedureFqn);
                return null;
              })
          .when(repository)
          .setFullyQualifiedName(Mockito.any(StoredProcedure.class));

      StoredProcedure[] captured = new StoredProcedure[1];
      Mockito.doAnswer(
              invocation -> {
                captured[0] = invocation.getArgument(0);
                return null;
              })
          .when(repository)
          .findMatchForImport(Mockito.any(StoredProcedure.class));

      testCsv.createStoredProcedureEntity(mock(CSVPrinter.class), record, storedProcedureFqn);

      assertNotNull(captured[0]);
      assertEquals("daily_sales", captured[0].getName());
      assertEquals("select 1", captured[0].getStoredProcedureCode().getCode());
      assertEquals(StoredProcedureLanguage.SQL, captured[0].getStoredProcedureCode().getLanguage());
      assertEquals(ENTITY_CREATED, testCsv.pendingCsvResults.get(record));
      assertEquals(1, testCsv.importResult.getNumberOfRowsPassed());
      assertEquals(captured[0], testCsv.dryRunCreatedEntities.get(storedProcedureFqn));
    }
  }

  @Test
  void test_createStoredProcedureEntityQueuesMissingProcedureWhenSchemaExists() throws Exception {
    TestCsv testCsv = Mockito.spy(new TestCsv());
    testCsv.enableProcessing();
    testCsv.setDryRun(false);

    String storedProcedureFqn = "service.db.schema.daily_sales";
    CSVRecord record =
        storedProcedureRecord(
            testCsv, "daily_sales", "Daily Sales", "Daily sales procedure", "select 1", "SQL");
    DatabaseSchema schema =
        new DatabaseSchema()
            .withId(UUID.randomUUID())
            .withName("schema")
            .withFullyQualifiedName("service.db.schema")
            .withDatabase(new EntityReference().withId(UUID.randomUUID()).withName("service.db"))
            .withService(new EntityReference().withId(UUID.randomUUID()).withName("service"));
    StoredProcedureRepository repository = mock(StoredProcedureRepository.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    Mockito.doReturn(schema)
        .when(testCsv)
        .getEntityWithDependencyResolution(
            Entity.DATABASE_SCHEMA,
            "service.db.schema",
            "name,displayName,service,database",
            org.openmetadata.schema.type.Include.NON_DELETED);
    Mockito.doThrow(
            org.openmetadata.service.exception.EntityNotFoundException.byName(storedProcedureFqn))
        .when(testCsv)
        .getEntityWithDependencyResolution(
            Entity.STORED_PROCEDURE,
            storedProcedureFqn,
            "name,displayName,fullyQualifiedName",
            org.openmetadata.schema.type.Include.NON_DELETED);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<RuleEngine> ruleEngineStatic = Mockito.mockStatic(RuleEngine.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.STORED_PROCEDURE)).thenReturn(repository);
      ruleEngineStatic.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      validatorUtil
          .when(() -> ValidatorUtil.validate(Mockito.any(StoredProcedure.class)))
          .thenReturn(null);

      Mockito.doAnswer(
              invocation -> {
                StoredProcedure storedProcedure = invocation.getArgument(0);
                storedProcedure.setFullyQualifiedName(storedProcedureFqn);
                return null;
              })
          .when(repository)
          .setFullyQualifiedName(Mockito.any(StoredProcedure.class));

      StoredProcedure[] captured = new StoredProcedure[1];
      Mockito.doAnswer(
              invocation -> {
                captured[0] = invocation.getArgument(0);
                return null;
              })
          .when(repository)
          .findMatchForImport(Mockito.any(StoredProcedure.class));
      Mockito.doNothing()
          .when(repository)
          .prepareInternal(Mockito.any(StoredProcedure.class), Mockito.eq(false));

      testCsv.createStoredProcedureEntity(mock(CSVPrinter.class), record, storedProcedureFqn);

      assertNotNull(captured[0]);
      assertEquals("daily_sales", captured[0].getName());
      assertEquals(storedProcedureFqn, captured[0].getFullyQualifiedName());
      assertEquals("service", captured[0].getService().getName());
      assertEquals("service.db", captured[0].getDatabase().getName());
      assertEquals("select 1", captured[0].getStoredProcedureCode().getCode());
      assertEquals(StoredProcedureLanguage.SQL, captured[0].getStoredProcedureCode().getLanguage());
      assertEquals(1, testCsv.pendingEntityOperations.size());
      assertTrue(testCsv.pendingEntityFQNs.contains(storedProcedureFqn));
      assertEquals(ENTITY_CREATED, testCsv.pendingCsvResults.get(record));
    }
  }

  @Test
  void test_createStoredProcedureEntityRejectsInvalidLanguage() {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(true);

    String storedProcedureFqn = "service.db.schema.bad_language";
    CSVRecord record =
        storedProcedureRecord(
            testCsv, "bad_language", "Bad Language", "Invalid language", "select 1", "Ruby");

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.DATABASE_SCHEMA,
                      "service.db.schema",
                      "name,displayName,service,database",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  "service.db.schema"));
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.STORED_PROCEDURE,
                      storedProcedureFqn,
                      "name,displayName,fullyQualifiedName",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  storedProcedureFqn));

      IllegalArgumentException exception =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  testCsv.createStoredProcedureEntity(
                      mock(CSVPrinter.class), record, storedProcedureFqn));

      assertEquals("Invalid storedProcedure.language: Ruby", exception.getMessage());
    }
  }

  @Test
  void test_createColumnEntityDryRunCreatesPendingTableAndFlushesToCache() {
    TestCsv testCsv = new TestCsv();
    testCsv.enableProcessing();
    testCsv.setDryRun(true);

    CSVRecord record =
        columnRecord(
            testCsv,
            "customer_id",
            "Customer Id",
            "Customer identifier",
            "service.db.schema.orders.customer_id",
            "",
            "INT",
            "",
            "");
    TableRepository repository = mock(TableRepository.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.DATABASE_SCHEMA,
                      "service.db.schema",
                      "name,displayName,service,database",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  "service.db.schema"));
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TABLE,
                      "service.db.schema.orders",
                      "name,displayName,fullyQualifiedName,columns,tags",
                      org.openmetadata.schema.type.Include.NON_DELETED))
          .thenThrow(
              org.openmetadata.service.exception.EntityNotFoundException.byName(
                  "service.db.schema.orders"));
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);

      testCsv.createColumnEntity(
          mock(CSVPrinter.class), record, "service.db.schema.orders.customer_id");

      assertEquals(1, testCsv.pendingTableUpdates.size());
      assertEquals(ENTITY_UPDATED, testCsv.pendingCsvResults.get(record));
      assertEquals(1, testCsv.importResult.getNumberOfRowsPassed());

      testCsv.flushPendingTableUpdates(mock(CSVPrinter.class));

      Table cachedTable = (Table) testCsv.dryRunCreatedEntities.get("service.db.schema.orders");
      assertNotNull(cachedTable);
      assertEquals(1, cachedTable.getColumns().size());
      assertEquals("customer_id", cachedTable.getColumns().get(0).getName());
      Mockito.verify(repository).setFullyQualifiedName(cachedTable);
      assertTrue(testCsv.pendingTableUpdates.isEmpty());
    }
  }

  @Test
  void test_flushPendingSearchIndexUpdatesClearsQueueOnSuccessAndFailure() {
    SearchRepository searchRepository = mock(SearchRepository.class);
    Table successEntity = tableEntity("orders", "service.db.schema.orders", "Orders");
    Table failedEntity = tableEntity("payments", "service.db.schema.payments", "Payments");
    List<List<EntityInterface>> capturedBatches = new ArrayList<>();

    TestCsv successfulCsv = new TestCsv();
    successfulCsv.pendingSearchIndexUpdates.add(successEntity);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      Mockito.doAnswer(
              invocation -> {
                capturedBatches.add(new ArrayList<>(invocation.getArgument(0)));
                return null;
              })
          .when(searchRepository)
          .updateEntitiesBulk(Mockito.anyList());
      successfulCsv.flushPendingSearchIndexUpdates();
      assertEquals(List.of(successEntity), capturedBatches.get(0));
      assertTrue(successfulCsv.pendingSearchIndexUpdates.isEmpty());
    }

    TestCsv failingCsv = new TestCsv();
    failingCsv.pendingSearchIndexUpdates.add(failedEntity);
    SearchRepository failingRepository = mock(SearchRepository.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(failingRepository);
      Mockito.doThrow(new IllegalStateException("search bulk failed"))
          .when(failingRepository)
          .updateEntitiesBulk(List.of(failedEntity));

      failingCsv.flushPendingSearchIndexUpdates();

      assertTrue(failingCsv.pendingSearchIndexUpdates.isEmpty());
    }
  }

  @Test
  void test_flushPendingChangeEventsSubmitsBatchInsertAndClearsQueue() {
    TestCsv testCsv = new TestCsv();
    testCsv.pendingChangeEvents.add("event-1");
    testCsv.pendingChangeEvents.add("event-2");

    AsyncService asyncService = mock(AsyncService.class);
    @SuppressWarnings("unchecked")
    java.util.concurrent.ExecutorService executor =
        mock(java.util.concurrent.ExecutorService.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);

    Mockito.when(asyncService.getExecutorService()).thenReturn(executor);
    Mockito.when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    Mockito.when(executor.submit(Mockito.any(Runnable.class)))
        .thenAnswer(
            invocation -> {
              ((Runnable) invocation.getArgument(0)).run();
              return CompletableFuture.completedFuture(null);
            });

    try (MockedStatic<AsyncService> asyncServiceStatic = Mockito.mockStatic(AsyncService.class);
        MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      asyncServiceStatic.when(AsyncService::getInstance).thenReturn(asyncService);
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      testCsv.flushPendingChangeEvents();

      Mockito.verify(changeEventDAO).insertBatch(List.of("event-1", "event-2"));
      assertTrue(testCsv.pendingChangeEvents.isEmpty());
    }
  }

  @Test
  void test_flushPendingCsvResultsWritesSuccessAndFailureRows() throws Exception {
    TestCsv testCsv = new TestCsv();
    CSVRecord successRecord = singleRecord(testCsv, "success", "value", "details");
    CSVRecord failedRecord = singleRecord(testCsv, "failure", "value", "details");
    testCsv.pendingCsvResults.put(successRecord, ENTITY_CREATED);
    testCsv.pendingCsvResults.put(failedRecord, "boom");

    StringWriter writer = new StringWriter();
    try (CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT)) {
      testCsv.flushPendingCsvResults(printer);
    }

    String output = writer.toString();
    assertTrue(output.contains(EntityCsv.IMPORT_SUCCESS));
    assertTrue(output.contains(ENTITY_CREATED));
    assertTrue(output.contains(EntityCsv.IMPORT_FAILED));
    assertTrue(output.contains("boom"));
    assertTrue(testCsv.pendingCsvResults.isEmpty());
  }

  @Test
  void test_createUserEntityDryRunValidatesAndTracksCreateVsUpdate() throws Exception {
    UserCsv userCsv = new UserCsv();
    userCsv.enableProcessing();
    userCsv.setDryRun(true);

    UserRepository repository = mock(UserRepository.class);
    User createdUser = user("alice");
    User updatedUser = user("bob");
    CSVRecord createdRecord = userRecord(userCsv, "alice", "", "", "alice@example.com");
    CSVRecord updatedRecord = userRecord(userCsv, "bob", "", "", "bob@example.com");
    CSVPrinter printer = mock(CSVPrinter.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(repository);
      validatorUtil.when(() -> ValidatorUtil.validate(createdUser)).thenReturn(null);
      validatorUtil.when(() -> ValidatorUtil.validate(updatedUser)).thenReturn(null);
      validatorUtil
          .when(() -> ValidatorUtil.validateUserNameWithEmailPrefix(createdRecord))
          .thenReturn("");
      validatorUtil
          .when(() -> ValidatorUtil.validateUserNameWithEmailPrefix(updatedRecord))
          .thenReturn("");
      Mockito.when(repository.isUpdateForImport(createdUser)).thenReturn(false);
      Mockito.when(repository.isUpdateForImport(updatedUser)).thenReturn(true);

      userCsv.createUserEntity(printer, createdRecord, createdUser);
      userCsv.createUserEntity(printer, updatedRecord, updatedUser);

      assertEquals(2, userCsv.importResult.getNumberOfRowsPassed());
      assertEquals(createdUser, userCsv.dryRunCreatedEntities.get("alice"));
      assertEquals(updatedUser, userCsv.dryRunCreatedEntities.get("bob"));
    }
  }

  @Test
  void test_createUserEntityNonDryRunPublishesChangeEventWithoutAuthMechanism() throws Exception {
    UserCsv userCsv = new UserCsv();
    userCsv.enableProcessing();
    userCsv.setDryRun(false);

    User user =
        user("charlie")
            .withAuthenticationMechanism(new AuthenticationMechanism())
            .withDisplayName("Charlie");
    CSVRecord record = userRecord(userCsv, "charlie", "Charlie", "", "charlie@example.com");
    UserRepository repository = mock(UserRepository.class);
    AsyncService asyncService = mock(AsyncService.class);
    @SuppressWarnings("unchecked")
    java.util.concurrent.ExecutorService executor =
        mock(java.util.concurrent.ExecutorService.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    ChangeEvent changeEvent =
        new ChangeEvent().withEntityType(Entity.USER).withEventType(EventType.ENTITY_CREATED);
    EntityInterface[] eventEntity = new EntityInterface[1];

    Mockito.when(asyncService.getExecutorService()).thenReturn(executor);
    Mockito.when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    Mockito.when(executor.submit(Mockito.any(Runnable.class)))
        .thenAnswer(
            invocation -> {
              ((Runnable) invocation.getArgument(0)).run();
              return CompletableFuture.completedFuture(null);
            });

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<AsyncService> asyncServiceStatic = Mockito.mockStatic(AsyncService.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class);
        MockedStatic<FormatterUtil> formatterUtil = Mockito.mockStatic(FormatterUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(repository);
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      asyncServiceStatic.when(AsyncService::getInstance).thenReturn(asyncService);
      validatorUtil.when(() -> ValidatorUtil.validate(user)).thenReturn(null);
      validatorUtil
          .when(() -> ValidatorUtil.validateUserNameWithEmailPrefix(record))
          .thenReturn("");
      formatterUtil
          .when(
              () ->
                  FormatterUtil.createChangeEventForEntity(
                      Mockito.eq("admin"),
                      Mockito.eq(EventType.ENTITY_CREATED),
                      Mockito.any(EntityInterface.class)))
          .thenAnswer(
              invocation -> {
                eventEntity[0] = invocation.getArgument(2);
                changeEvent.setEntity(eventEntity[0]);
                return changeEvent;
              });
      Mockito.when(repository.isUpdateForImport(user)).thenReturn(false);
      Mockito.when(repository.createOrUpdate(null, user, "admin"))
          .thenReturn(new PutResponse<>(Response.Status.CREATED, user, EventType.ENTITY_CREATED));

      userCsv.createUserEntity(mock(CSVPrinter.class), record, user);

      User redactedUser = assertInstanceOf(User.class, eventEntity[0]);
      assertNull(redactedUser.getAuthenticationMechanism());
      assertEquals(List.of(user), userCsv.pendingSearchIndexUpdates);
      Mockito.verify(changeEventDAO).insert(Mockito.anyString());
      assertEquals(1, userCsv.importResult.getNumberOfRowsPassed());
    }
  }

  @Test
  void test_createUserEntityValidationFailureRecordsImportError() throws Exception {
    UserCsv userCsv = new UserCsv();
    userCsv.enableProcessing();
    userCsv.setDryRun(true);

    User invalidUser = user("dave");
    CSVRecord record = userRecord(userCsv, "dave", "", "", "wrong@example.com");
    UserRepository repository = mock(UserRepository.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<ValidatorUtil> validatorUtil = Mockito.mockStatic(ValidatorUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(repository);
      validatorUtil
          .when(() -> ValidatorUtil.validate(invalidUser))
          .thenReturn("[displayName must not be null]");
      validatorUtil
          .when(() -> ValidatorUtil.validateUserNameWithEmailPrefix(record))
          .thenReturn(ValidatorUtil.NAME_EMAIL_VOILATION);

      userCsv.createUserEntity(mock(CSVPrinter.class), record, invalidUser);

      assertEquals(1, userCsv.importResult.getNumberOfRowsFailed());
      assertEquals(0, userCsv.importResult.getNumberOfRowsPassed());
    }
  }

  private static class TestCsv extends EntityCsv<EntityInterface> {
    private final Map<String, EntityInterface> entitiesByTypeAndName = new HashMap<>();

    protected TestCsv() {
      super(Entity.TABLE, CSV_HEADERS, "admin");
    }

    private void addEntity(String entityType, String fqn, EntityInterface entity) {
      entitiesByTypeAndName.put(entityType + ":" + fqn, entity);
    }

    private void enableProcessing() {
      this.processRecord = true;
      this.recordIndex = 0;
    }

    private boolean isProcessRecord() {
      return processRecord;
    }

    private ApiStatus status() {
      return importResult.getStatus();
    }

    private Integer rowsFailed() {
      return importResult.getNumberOfRowsFailed();
    }

    private void setDryRun(boolean dryRun) {
      importResult.withDryRun(dryRun);
    }

    private void queueEntity(CSVRecord csvRecord, EntityInterface entity) throws IOException {
      createEntity(mock(CSVPrinter.class), csvRecord, entity);
    }

    private void queueEntityWithType(CSVRecord csvRecord, EntityInterface entity, String type)
        throws IOException {
      createEntity(mock(CSVPrinter.class), csvRecord, entity, type);
    }

    private void queuePendingTableUpdate(
        String tableFqn, Table original, Table updated, CSVRecord record) {
      TableUpdateContext context = new TableUpdateContext(original, updated);
      context.csvRecords.add(record);
      pendingTableUpdates.put(tableFqn, context);
      pendingCsvResults.put(record, ENTITY_UPDATED);
      importResult.withNumberOfRowsProcessed((int) record.getRecordNumber());
      importResult.withNumberOfRowsPassed(importResult.getNumberOfRowsPassed() + 1);
    }

    private Boolean parseBoolean(CSVRecord csvRecord, int fieldNumber) {
      return getBoolean(mock(CSVPrinter.class), csvRecord, fieldNumber);
    }

    private List<EntityReference> parseOwners(CSVRecord csvRecord, int fieldNumber) {
      return getOwners(mock(CSVPrinter.class), csvRecord, fieldNumber);
    }

    private List<EntityReference> parseDomains(CSVRecord csvRecord, int fieldNumber) {
      return getDomains(mock(CSVPrinter.class), csvRecord, fieldNumber);
    }

    private EntityReference parseOwnerAsUser(CSVRecord csvRecord, int fieldNumber) {
      return getOwnerAsUser(mock(CSVPrinter.class), csvRecord, fieldNumber);
    }

    private List<EntityReference> parseEntityReferences(
        CSVRecord csvRecord, int fieldNumber, String entityType) {
      return getEntityReferences(mock(CSVPrinter.class), csvRecord, fieldNumber, entityType);
    }

    private List<EntityReference> parseGlossaryTerms(CSVRecord csvRecord, int fieldNumber) {
      return getEntityReferencesForGlossaryTerms(mock(CSVPrinter.class), csvRecord, fieldNumber);
    }

    private Map<String, Object> parseExtension(CSVRecord csvRecord, int fieldNumber)
        throws IOException {
      return getExtension(mock(CSVPrinter.class), csvRecord, fieldNumber);
    }

    private CSVRecord nextRecord(CSVPrinter resultsPrinter, List<CSVRecord> csvRecords)
        throws IOException {
      return getNextRecord(resultsPrinter, csvRecords);
    }

    private String parseFormattedDateTime(
        CSVRecord csvRecord,
        int fieldNumber,
        String fieldName,
        String fieldValue,
        String fieldType,
        String propertyConfig) {
      return parseFormattedDateTimeField(
          mock(CSVPrinter.class),
          csvRecord,
          fieldNumber,
          fieldName,
          fieldValue,
          fieldType,
          propertyConfig);
    }

    @Override
    protected EntityInterface getEntityByName(String entityType, String fqn) {
      EntityInterface entity = entitiesByTypeAndName.get(entityType + ":" + fqn);
      return entity != null ? entity : super.getEntityByName(entityType, fqn);
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
    protected void addRecord(CsvFile csvFile, EntityInterface entity) {
      addRecord(
          csvFile,
          List.of(
              entity.getName(),
              entity.getFullyQualifiedName(),
              nullOrEmpty(entity.getDescription()) ? "" : entity.getDescription()));
    }

    private void updateColumns(Table table, CSVRecord csvRecord) throws Exception {
      Method method =
          EntityCsv.class.getDeclaredMethod(
              "updateColumnsFromCsvRecursive", Table.class, CSVRecord.class, CSVPrinter.class);
      method.setAccessible(true);
      try {
        method.invoke(this, table, csvRecord, mock(CSVPrinter.class));
      } catch (InvocationTargetException e) {
        if (e.getCause() instanceof Exception exception) {
          throw exception;
        }
        throw new RuntimeException(e.getCause());
      }
    }

    private void invokeCreateChangeEventAndUpdateInES(
        PutResponse<EntityInterface> response, String importedBy) throws Exception {
      Method method =
          EntityCsv.class.getDeclaredMethod(
              "createChangeEventAndUpdateInES", PutResponse.class, String.class);
      method.setAccessible(true);
      try {
        method.invoke(this, response, importedBy);
      } catch (InvocationTargetException e) {
        if (e.getCause() instanceof Exception exception) {
          throw exception;
        }
        throw new RuntimeException(e.getCause());
      }
    }

    private void invokeCreateChangeEventForBatchedEntity(
        EntityInterface entity, EventType eventType) throws Exception {
      Method method =
          EntityCsv.class.getDeclaredMethod(
              "createChangeEventForBatchedEntity", EntityInterface.class, EventType.class);
      method.setAccessible(true);
      try {
        method.invoke(this, entity, eventType);
      } catch (InvocationTargetException e) {
        if (e.getCause() instanceof Exception exception) {
          throw exception;
        }
        throw new RuntimeException(e.getCause());
      }
    }
  }

  private static class UserCsv extends EntityCsv<User> {
    protected UserCsv() {
      super(Entity.USER, List.of(new CsvHeader().withName("name").withRequired(true)), "admin");
    }

    private void enableProcessing() {
      this.processRecord = true;
      this.recordIndex = 0;
    }

    private void setDryRun(boolean dryRun) {
      importResult.withDryRun(dryRun);
    }

    @Override
    protected void createEntity(CSVPrinter resultsPrinter, List<CSVRecord> records) {
      throw new UnsupportedOperationException("Not used in UserCsv tests");
    }

    @Override
    protected void addRecord(CsvFile csvFile, User entity) {
      addRecord(csvFile, List.of(entity.getName(), entity.getEmail()));
    }
  }

  private static CSVRecord singleRecord(
      TestCsv testCsv, String first, String second, String third) {
    List<String> records = new ArrayList<>();
    records.add(recordToString(List.of(first, second, third)));
    return testCsv.parse(createCsv(CSV_HEADERS, records), true).get(1);
  }

  private static CSVRecord entityRecord(
      TestCsv testCsv, String name, String displayName, String description) {
    List<String> fields = new ArrayList<>();
    for (int i = 0; i < 12; i++) {
      fields.add("");
    }
    fields.set(0, name);
    fields.set(1, displayName);
    fields.set(2, description);
    return testCsv.parse(recordToString(fields)).get(0);
  }

  private static CSVRecord columnRecord(
      TestCsv testCsv,
      String columnFqn,
      String displayName,
      String description,
      String columnFullyQualifiedName,
      String dataTypeDisplay,
      String dataType,
      String arrayDataType,
      String dataLength) {
    List<String> fields = new ArrayList<>();
    for (int i = 0; i < 18; i++) {
      fields.add("");
    }
    fields.set(0, columnFqn);
    fields.set(1, displayName);
    fields.set(2, description);
    fields.set(13, columnFullyQualifiedName);
    fields.set(14, dataTypeDisplay);
    fields.set(15, dataType);
    fields.set(16, arrayDataType);
    fields.set(17, dataLength);
    return testCsv.parse(recordToString(fields)).get(0);
  }

  private static CSVRecord storedProcedureRecord(
      TestCsv testCsv,
      String name,
      String displayName,
      String description,
      String code,
      String language) {
    List<String> fields = new ArrayList<>();
    for (int i = 0; i < 20; i++) {
      fields.add("");
    }
    fields.set(0, name);
    fields.set(1, displayName);
    fields.set(2, description);
    fields.set(18, code);
    fields.set(19, language);
    return testCsv.parse(recordToString(fields)).get(0);
  }

  private static CSVRecord userRecord(
      UserCsv userCsv, String name, String displayName, String description, String email) {
    List<String> fields = new ArrayList<>();
    for (int i = 0; i < 6; i++) {
      fields.add("");
    }
    fields.set(0, name);
    fields.set(1, displayName);
    fields.set(2, description);
    fields.set(3, email);
    return userCsv.parse(recordToString(fields)).get(0);
  }

  private static User user(String name) {
    User user = new User();
    user.setId(UUID.randomUUID());
    user.setName(name);
    user.setFullyQualifiedName(name);
    user.setEmail(name + "@example.com");
    return user;
  }

  private static Team team(String name) {
    Team team = new Team();
    team.setId(UUID.randomUUID());
    team.setName(name);
    team.setFullyQualifiedName(name);
    return team;
  }

  private static Domain domain(String name) {
    Domain domain = new Domain();
    domain.setId(UUID.randomUUID());
    domain.setName(name);
    domain.setFullyQualifiedName(name);
    return domain;
  }

  private static GlossaryTerm glossaryTerm(String fullyQualifiedName, EntityStatus status) {
    GlossaryTerm glossaryTerm = new GlossaryTerm();
    glossaryTerm.setId(UUID.randomUUID());
    glossaryTerm.setName(fullyQualifiedName);
    glossaryTerm.setFullyQualifiedName(fullyQualifiedName);
    glossaryTerm.setEntityStatus(status);
    return glossaryTerm;
  }

  private static Table tableEntity(String name, String fullyQualifiedName, String description) {
    Table table = new Table();
    table.setName(name);
    table.setFullyQualifiedName(fullyQualifiedName);
    table.setDescription(description);
    return table;
  }

  @SuppressWarnings("unchecked")
  private static <T> T invokePrivate(
      TestCsv testCsv, String methodName, CSVRecord csvRecord, int fieldNumber, Object... extraArgs)
      throws Exception {
    Class<?>[] parameterTypes =
        switch (methodName) {
          case "parseLongField" -> new Class<?>[] {
            CSVPrinter.class, CSVRecord.class, int.class, String.class, String.class, Object.class
          };
          case "parseTimeInterval" -> new Class<?>[] {
            CSVPrinter.class, CSVRecord.class, int.class, String.class, Object.class
          };
          case "parseEnumType" -> new Class<?>[] {
            CSVPrinter.class,
            CSVRecord.class,
            int.class,
            String.class,
            String.class,
            Object.class,
            String.class
          };
          case "parseTableType" -> new Class<?>[] {
            CSVPrinter.class, CSVRecord.class, int.class, String.class, Object.class, String.class
          };
          default -> throw new IllegalArgumentException("Unsupported method " + methodName);
        };

    Method method = EntityCsv.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    Object[] args = new Object[extraArgs.length + 3];
    args[0] = mock(CSVPrinter.class);
    args[1] = csvRecord;
    args[2] = fieldNumber;
    System.arraycopy(extraArgs, 0, args, 3, extraArgs.length);
    try {
      return (T) method.invoke(testCsv, args);
    } catch (InvocationTargetException e) {
      if (e.getCause() instanceof Exception exception) {
        throw exception;
      }
      throw new RuntimeException(e.getCause());
    }
  }
}

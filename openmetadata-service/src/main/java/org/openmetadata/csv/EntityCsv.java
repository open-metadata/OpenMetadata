/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.csv;

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.FIELD_SEPARATOR;
import static org.openmetadata.csv.CsvUtil.recordToString;

import java.io.IOException;
import java.io.Reader;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVFormat.Builder;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.type.csv.CsvImportResult.Status;

/** Generic EntityCsv that each entity must extend to perform entity specific validation */
public abstract class EntityCsv<T extends EntityInterface> {
  private static final String IMPORT_STATUS_HEADER = "status";
  private static final String IMPORT_ERRORS_HEADER = "errors";
  private final List<CsvHeader> csvHeaders;
  private final CsvImportResult importResult = new CsvImportResult();
  private final List<T> entities = new ArrayList<>();

  protected EntityCsv(List<CsvHeader> csvHeaders) {
    this.csvHeaders = csvHeaders;
  }

  // Import entities from the CSV file
  public final CsvImportResult importCsv(String csv, boolean dryRun) throws IOException {
    importResult.withDryRun(dryRun);
    StringWriter writer = new StringWriter();
    CSVPrinter resultsPrinter = getResultsCsv(csvHeaders, writer);
    if (resultsPrinter == null) {
      return importResult;
    }

    // Parse CSV
    Iterator<CSVRecord> records = parse(csv);
    if (records == null) {
      return importResult; // Error during parsing
    }

    // Validate headers
    List<String> expectedHeaders = CsvUtil.getHeaders(csvHeaders);
    if (!validateHeaders(expectedHeaders, records.next())) {
      return importResult;
    }

    // Validate and load each record
    while (records.hasNext()) {
      CSVRecord record = records.next();
      processRecord(resultsPrinter, expectedHeaders, record);
    }
    // Finally, create the entities parsed from the record
    importResult.withImportResultsCsv(writer.toString());
    return importResult;
  }

  /** Implement this method to validate each record */
  protected abstract T toEntity(CSVPrinter resultsPrinter, CSVRecord record);

  public final String exportCsv(List<T> entities) throws IOException {
    CsvFile csvFile = new CsvFile().withHeaders(csvHeaders);
    List<List<String>> records = new ArrayList<>();
    for (T entity : entities) {
      records.add(toRecord(entity));
    }
    csvFile.withRecords(records);
    // TODO Remove CsvFile
    return CsvUtil.formatCsv(csvFile);
  }

  /** Implement this method to turn an entity into a list of fields */
  protected abstract List<String> toRecord(T entity);

  // Create a CSVPrinter to capture the import results
  private CSVPrinter getResultsCsv(List<CsvHeader> csvHeaders, StringWriter writer) {
    List<String> importResultsCsvHeader = listOf(IMPORT_STATUS_HEADER, IMPORT_ERRORS_HEADER);
    importResultsCsvHeader.addAll(CsvUtil.getHeaders(csvHeaders));
    CSVFormat format =
        Builder.create(CSVFormat.DEFAULT).setHeader(importResultsCsvHeader.toArray(new String[0])).build();
    try {
      return new CSVPrinter(writer, format);
    } catch (IOException e) {
      documentFailure(failed(e.getMessage(), CsvErrorType.UNKNOWN));
    }
    return null;
  }

  private Iterator<CSVRecord> parse(String csv) {
    Reader in = new StringReader(csv);
    try {
      return CSVFormat.DEFAULT.parse(in).iterator();
    } catch (IOException e) {
      documentFailure(failed(e.getMessage(), CsvErrorType.PARSER_FAILURE));
    }
    return null;
  }

  private boolean validateHeaders(List<String> expectedHeaders, CSVRecord record) {
    importResult.withNumberOfRowsProcessed((int) record.getRecordNumber());
    if (expectedHeaders.equals(record.toList())) {
      return true;
    }
    documentFailure(invalidHeader(recordToString(expectedHeaders), recordToString(record)));
    return false;
  }

  private void processRecord(CSVPrinter resultsPrinter, List<String> expectedHeader, CSVRecord record)
      throws IOException {
    // Every row must have total fields corresponding to the number of headers
    if (csvHeaders.size() != record.size()) {
      importFailure(resultsPrinter, invalidFieldCount(expectedHeader.size(), record.size()), Status.FAILURE, record);
      return;
    }

    // Check if required values are present
    List<String> errors = new ArrayList<>();
    for (int i = 0; i < csvHeaders.size(); i++) {
      String field = record.get(i);
      boolean fieldRequired = Boolean.TRUE.equals(csvHeaders.get(i).getRequired());
      if (fieldRequired && nullOrEmpty(field)) {
        errors.add(fieldRequired(i + 1));
      }
    }

    if (!errors.isEmpty()) {
      importFailure(resultsPrinter, String.join(FIELD_SEPARATOR, errors), Status.FAILURE, record);
      return;
    }

    // Finally, convert record into entity for importing
    T entity = toEntity(resultsPrinter, record);
    if (entity != null) {
      entities.add(entity);
      importSuccess(resultsPrinter, record);
    }
  }

  public String failed(String exception, CsvErrorType errorType) {
    return String.format("#%s: Failed to parse the CSV filed - reason %s", errorType, exception);
  }

  public static String invalidHeader(String expected, String actual) {
    return String.format("#%s: Headers %s doesn't match %s", CsvErrorType.INVALID_HEADER, actual, expected);
  }

  public static String invalidFieldCount(int expectedFieldCount, int actualFieldCount) {
    return String.format(
        "#%s: Field count %d does not match the expected field count of %d",
        CsvErrorType.INVALID_FIELD_COUNT, actualFieldCount, expectedFieldCount);
  }

  public static String fieldRequired(int field) {
    return String.format("#%s: Field %d is required", CsvErrorType.FIELD_REQUIRED, field);
  }

  public static String invalidField(int field, String error) {
    return String.format("#%s: Field %d is required", CsvErrorType.FIELD_REQUIRED, field);
  }

  private void documentFailure(String error) {
    importResult.withStatus(Status.ABORTED);
    importResult.withAbortReason(error);
  }

  private void importSuccess(CSVPrinter printer, CSVRecord inputRecord) throws IOException {
    // TODO success failure
    List<String> record = listOf("success", "");
    record.addAll(inputRecord.toList());
    printer.printRecord(record);
    importResult.withNumberOfRowsProcessed((int) inputRecord.getRecordNumber());
    importResult.withNumberOfRowsPassed(importResult.getNumberOfRowsPassed() + 1);
  }

  private void importFailure(CSVPrinter printer, String error, Status status, CSVRecord inputRecord)
      throws IOException {
    List<String> record = listOf("failed", error);
    record.addAll(inputRecord.toList());
    printer.printRecord(record);
    importResult.withStatus(status);
    importResult.withNumberOfRowsProcessed((int) inputRecord.getRecordNumber());
    importResult.withNumberOfRowsFailed(importResult.getNumberOfRowsFailed() + 1);
  }
}

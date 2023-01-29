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
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.FIELD_SEPARATOR;
import static org.openmetadata.csv.CsvUtil.recordToString;

import java.io.IOException;
import java.io.Reader;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVFormat.Builder;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.type.csv.CsvImportResult.Status;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * EntityCsv provides export and import capabilities for an entity. Each entity must implement the abstract methods to
 * provide entity specific processing functionality to export an entity to a CSV record, and import an entity from a CSV
 * record.
 */
@Slf4j
public abstract class EntityCsv<T extends EntityInterface> {
  public static final String IMPORT_STATUS_HEADER = "status";
  public static final String IMPORT_STATUS_DETAILS = "details";
  public static final String IMPORT_STATUS_SUCCESS = "success";
  public static final String IMPORT_STATUS_FAILED = "failure";
  private final String entityType;
  private final List<CsvHeader> csvHeaders;
  private final CsvImportResult importResult = new CsvImportResult();
  protected boolean processRecord; // When set to false record processing is discontinued
  public static final String ENTITY_CREATED = "Entity created";
  public static final String ENTITY_UPDATED = "Entity updated";
  private final Map<String, T> dryRunCreatedEntities = new HashMap<>();
  private final String user;

  protected EntityCsv(String entityType, List<CsvHeader> csvHeaders, String user) {
    this.entityType = entityType;
    this.csvHeaders = csvHeaders;
    this.user = user;
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
    importResult.withNumberOfRowsPassed(importResult.getNumberOfRowsPassed() + 1);

    // Validate and load each record
    while (records.hasNext()) {
      CSVRecord record = records.next();
      processRecord(resultsPrinter, expectedHeaders, record);
    }

    // Finally, create the entities parsed from the record
    setFinalStatus();
    importResult.withImportResultsCsv(writer.toString());
    return importResult;
  }

  /** Implement this method to validate each record */
  protected abstract T toEntity(CSVPrinter resultsPrinter, CSVRecord record) throws IOException;

  public final String exportCsv(List<T> entities) throws IOException {
    CsvFile csvFile = new CsvFile().withHeaders(csvHeaders);
    List<List<String>> records = new ArrayList<>();
    for (T entity : entities) {
      records.add(toRecord(entity));
    }
    csvFile.withRecords(records);
    return CsvUtil.formatCsv(csvFile);
  }

  public static CsvDocumentation getCsvDocumentation(String entityType) {
    LOG.info("Initializing CSV documentation for entity {}", entityType);
    String path = String.format(".*json/data/%s/%sCsvDocumentation.json$", entityType, entityType);
    try {
      List<String> jsonDataFiles = EntityUtil.getJsonDataResources(path);
      String json = CommonUtil.getResourceAsStream(EntityRepository.class.getClassLoader(), jsonDataFiles.get(0));
      return JsonUtils.readValue(json, CsvDocumentation.class);
    } catch (IOException e) {
      LOG.error("FATAL - Failed to load CSV documentation for entity {} from the path {}", entityType, path);
    }
    return null;
  }

  /** Implement this method to turn an entity into a list of fields */
  protected abstract List<String> toRecord(T entity);

  protected final EntityReference getEntityReference(
      CSVPrinter printer, CSVRecord record, int fieldNumber, String entityType) throws IOException {
    String fqn = record.get(fieldNumber);
    return getEntityReference(printer, record, fieldNumber, entityType, fqn);
  }

  private EntityInterface getEntity(String entityType, String fqn) {
    EntityInterface entity = entityType.equals(this.entityType) ? dryRunCreatedEntities.get(fqn) : null;
    if (entity == null) {
      EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
      entity = entityRepository.findByNameOrNull(fqn, "", Include.NON_DELETED);
    }
    return entity;
  }

  protected final EntityReference getEntityReference(
      CSVPrinter printer, CSVRecord record, int fieldNumber, String entityType, String fqn) throws IOException {
    if (nullOrEmpty(fqn)) {
      return null;
    }
    EntityInterface entity = getEntity(entityType, fqn);
    if (entity == null) {
      importFailure(printer, entityNotFound(fieldNumber, fqn), record);
      processRecord = false;
      return null;
    }
    return entity.getEntityReference();
  }

  protected final List<EntityReference> getEntityReferences(
      CSVPrinter printer, CSVRecord record, int fieldNumber, String entityType) throws IOException {
    String fqns = record.get(fieldNumber);
    if (nullOrEmpty(fqns)) {
      return null;
    }
    List<String> fqnList = listOrEmpty(CsvUtil.fieldToStrings(fqns));
    List<EntityReference> refs = new ArrayList<>();
    for (String fqn : fqnList) {
      EntityReference ref = getEntityReference(printer, record, fieldNumber, entityType, fqn);
      if (!processRecord) {
        return null;
      }
      if (ref != null) {
        refs.add(ref);
      }
    }
    return refs.isEmpty() ? null : refs;
  }

  protected final List<TagLabel> getTagLabels(CSVPrinter printer, CSVRecord record, int fieldNumber)
      throws IOException {
    List<EntityReference> refs = getEntityReferences(printer, record, fieldNumber, Entity.TAG);
    if (!processRecord || nullOrEmpty(refs)) {
      return null;
    }
    List<TagLabel> tagLabels = new ArrayList<>();
    for (EntityReference ref : refs) {
      tagLabels.add(new TagLabel().withSource(TagSource.TAG).withTagFQN(ref.getFullyQualifiedName()));
    }
    return tagLabels;
  }

  public static String[] getResultHeaders(List<CsvHeader> csvHeaders) {
    List<String> importResultsCsvHeader = listOf(IMPORT_STATUS_HEADER, IMPORT_STATUS_DETAILS);
    importResultsCsvHeader.addAll(CsvUtil.getHeaders(csvHeaders));
    return importResultsCsvHeader.toArray(new String[0]);
  }

  // Create a CSVPrinter to capture the import results
  private CSVPrinter getResultsCsv(List<CsvHeader> csvHeaders, StringWriter writer) {
    CSVFormat format = Builder.create(CSVFormat.DEFAULT).setHeader(getResultHeaders(csvHeaders)).build();
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
    importResult.withNumberOfRowsFailed(1);
    documentFailure(invalidHeader(recordToString(expectedHeaders), recordToString(record)));
    return false;
  }

  private void processRecord(CSVPrinter resultsPrinter, List<String> expectedHeader, CSVRecord record)
      throws IOException {
    processRecord = true;
    // Every row must have total fields corresponding to the number of headers
    if (csvHeaders.size() != record.size()) {
      importFailure(resultsPrinter, invalidFieldCount(expectedHeader.size(), record.size()), record);
      return;
    }

    // Check if required values are present
    List<String> errors = new ArrayList<>();
    for (int i = 0; i < csvHeaders.size(); i++) {
      String field = record.get(i);
      boolean fieldRequired = Boolean.TRUE.equals(csvHeaders.get(i).getRequired());
      if (fieldRequired && nullOrEmpty(field)) {
        errors.add(fieldRequired(i));
      }
    }

    if (!errors.isEmpty()) {
      importFailure(resultsPrinter, String.join(FIELD_SEPARATOR, errors), record);
      return;
    }

    // Finally, convert record into entity for importing
    T entity = toEntity(resultsPrinter, record);
    if (entity != null) {
      // Finally, create entities
      createEntity(resultsPrinter, record, entity);
    }
  }

  private void createEntity(CSVPrinter resultsPrinter, CSVRecord record, T entity) throws IOException {
    entity.setId(UUID.randomUUID());
    entity.setUpdatedBy(user);
    entity.setUpdatedAt(System.currentTimeMillis());
    EntityRepository<EntityInterface> repository = Entity.getEntityRepository(entityType);
    Response.Status responseStatus;
    if (!importResult.getDryRun()) {
      try {
        repository.prepareInternal(entity);
        PutResponse<EntityInterface> response = repository.createOrUpdate(null, entity);
        responseStatus = response.getStatus();
      } catch (Exception ex) {
        importFailure(resultsPrinter, ex.getMessage(), record);
        return;
      }
    } else {
      repository.setFullyQualifiedName(entity);
      responseStatus =
          repository.findByNameOrNull(entity.getFullyQualifiedName(), "", Include.NON_DELETED) == null
              ? Response.Status.CREATED
              : Response.Status.OK;
      // Track the dryRun created entities, as they may be referred by other entities being created during import
      dryRunCreatedEntities.put(entity.getFullyQualifiedName(), entity);
    }

    if (Response.Status.CREATED.equals(responseStatus)) {
      importSuccess(resultsPrinter, record, ENTITY_CREATED);
    } else {
      importSuccess(resultsPrinter, record, ENTITY_UPDATED);
    }
  }

  public String failed(String exception, CsvErrorType errorType) {
    return String.format("#%s: Failed to parse the CSV filed - reason %s", errorType, exception);
  }

  public static String invalidHeader(String expected, String actual) {
    return String.format("#%s: Headers [%s] doesn't match [%s]", CsvErrorType.INVALID_HEADER, actual, expected);
  }

  public static String invalidFieldCount(int expectedFieldCount, int actualFieldCount) {
    return String.format(
        "#%s: Field count %d does not match the expected field count of %d",
        CsvErrorType.INVALID_FIELD_COUNT, actualFieldCount, expectedFieldCount);
  }

  public static String fieldRequired(int field) {
    return String.format("#%s: Field %d is required", CsvErrorType.FIELD_REQUIRED, field + 1);
  }

  public static String invalidField(int field, String error) {
    return String.format("#%s: Field %d error - %s", CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String entityNotFound(int field, String fqn) {
    String error = String.format("Entity %s not found", fqn);
    return String.format("#%s: Field %d error - %s", CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  private void documentFailure(String error) {
    importResult.withStatus(Status.ABORTED);
    importResult.withAbortReason(error);
  }

  private void importSuccess(CSVPrinter printer, CSVRecord inputRecord, String successDetails) throws IOException {
    List<String> record = listOf(IMPORT_STATUS_SUCCESS, successDetails);
    record.addAll(inputRecord.toList());
    printer.printRecord(record);
    importResult.withNumberOfRowsProcessed((int) inputRecord.getRecordNumber());
    importResult.withNumberOfRowsPassed(importResult.getNumberOfRowsPassed() + 1);
  }

  protected void importFailure(CSVPrinter printer, String failedReason, CSVRecord inputRecord) throws IOException {
    List<String> record = listOf(IMPORT_STATUS_FAILED, failedReason);
    record.addAll(inputRecord.toList());
    printer.printRecord(record);
    importResult.withNumberOfRowsProcessed((int) inputRecord.getRecordNumber());
    importResult.withNumberOfRowsFailed(importResult.getNumberOfRowsFailed() + 1);
    processRecord = false;
  }

  private void setFinalStatus() {
    Status status =
        importResult.getNumberOfRowsPassed().equals(importResult.getNumberOfRowsProcessed())
            ? Status.SUCCESS
            : importResult.getNumberOfRowsPassed() > 1 ? Status.PARTIAL_SUCCESS : Status.FAILURE;
    importResult.setStatus(status);
  }
}

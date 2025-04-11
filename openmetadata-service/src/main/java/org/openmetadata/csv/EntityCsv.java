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
import static org.openmetadata.csv.CsvUtil.ENTITY_TYPE_SEPARATOR;
import static org.openmetadata.csv.CsvUtil.FIELD_SEPARATOR;
import static org.openmetadata.csv.CsvUtil.fieldToColumns;
import static org.openmetadata.csv.CsvUtil.fieldToEntities;
import static org.openmetadata.csv.CsvUtil.fieldToExtensionStrings;
import static org.openmetadata.csv.CsvUtil.fieldToInternalArray;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.service.events.ChangeEventHandler.copyChangeEvent;

import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.ValidationMessage;
import java.io.IOException;
import java.io.Reader;
import java.io.StringReader;
import java.io.StringWriter;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAccessor;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVFormat.Builder;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.type.customProperties.TableConfig;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.ValidatorUtil;

/**
 * EntityCsv provides export and import capabilities for an entity. Each entity must implement the
 * abstract methods to provide entity specific processing functionality to export an entity to a CSV
 * record, and import an entity from a CSV record.
 */
@Slf4j
public abstract class EntityCsv<T extends EntityInterface> {
  public static final String FIELD_ERROR_MSG = "#%s: Field %d error - %s";
  public static final String IMPORT_STATUS_HEADER = "status";
  public static final String IMPORT_STATUS_DETAILS = "details";
  public static final String IMPORT_SUCCESS = "success";
  public static final String IMPORT_FAILED = "failure";
  public static final String IMPORT_SKIPPED = "skipped";
  public static final String ENTITY_CREATED = "Entity created";
  public static final String ENTITY_UPDATED = "Entity updated";
  private final String entityType;
  private final List<CsvHeader> csvHeaders;
  private final List<String> expectedHeaders;
  protected final CsvImportResult importResult = new CsvImportResult();
  protected boolean processRecord; // When set to false record processing is discontinued
  protected final Map<String, T> dryRunCreatedEntities = new HashMap<>();
  protected final String importedBy;
  protected int recordIndex = 0;

  protected EntityCsv(String entityType, List<CsvHeader> csvHeaders, String importedBy) {
    this.entityType = entityType;
    this.csvHeaders = csvHeaders;
    this.expectedHeaders = CsvUtil.getHeaders(csvHeaders);
    this.importedBy = importedBy;
  }

  /** Import entities from a CSV file */
  public final CsvImportResult importCsv(String csv, boolean dryRun) throws IOException {
    importResult.withDryRun(dryRun);
    StringWriter writer = new StringWriter();
    CSVPrinter resultsPrinter = getResultsCsv(csvHeaders, writer);
    if (resultsPrinter == null) {
      return importResult;
    }

    // Parse CSV
    List<CSVRecord> records = parse(csv);
    if (records == null) {
      return importResult; // Error during parsing
    }

    // First record is CSV header - Validate headers
    if (!validateHeaders(records.get(recordIndex++))) {
      return importResult;
    }
    importResult.withNumberOfRowsPassed(importResult.getNumberOfRowsPassed() + 1);

    // Validate and load each record
    while (recordIndex < records.size()) {
      processRecord(resultsPrinter, records);
    }

    // Finally, create the entities parsed from the record
    setFinalStatus();
    importResult.withImportResultsCsv(writer.toString());
    return importResult;
  }

  /** Implement this method to a CSV record and turn it into an entity */
  protected abstract void createEntity(CSVPrinter resultsPrinter, List<CSVRecord> csvRecords)
      throws IOException;

  public final String exportCsv(T entity) throws IOException {
    CsvFile csvFile = new CsvFile().withHeaders(csvHeaders);
    addRecord(csvFile, entity);
    return CsvUtil.formatCsv(csvFile);
  }

  public final String exportCsv(List<T> entities) throws IOException {
    CsvFile csvFile = new CsvFile().withHeaders(csvHeaders);
    for (T entity : entities) {
      addRecord(csvFile, entity);
    }
    return CsvUtil.formatCsv(csvFile);
  }

  public static CsvDocumentation getCsvDocumentation(String entityType) {
    LOG.info("Initializing CSV documentation for entity {}", entityType);
    String path = String.format(".*json/data/%s/%sCsvDocumentation.json$", entityType, entityType);
    try {
      List<String> jsonDataFiles = EntityUtil.getJsonDataResources(path);
      String json =
          CommonUtil.getResourceAsStream(
              EntityRepository.class.getClassLoader(), jsonDataFiles.get(0));
      return JsonUtils.readValue(json, CsvDocumentation.class);
    } catch (IOException e) {
      LOG.error(
          "FATAL - Failed to load CSV documentation for entity {} from the path {}",
          entityType,
          path);
    }
    return null;
  }

  /** Implement this method to export an entity into a list of fields to create a CSV record */
  protected abstract void addRecord(CsvFile csvFile, T entity);

  /** Implement this method to export an entity into a list of fields to create a CSV record */
  public final void addRecord(CsvFile csvFile, List<String> recordList) {
    List<List<String>> list = csvFile.getRecords();
    list.add(recordList);
    csvFile.withRecords(list);
  }

  /** Owner field is in entityType:entityName format */
  public List<EntityReference> getOwners(
      CSVPrinter printer,
      CSVRecord csvRecord,
      int fieldNumber,
      Function<Integer, String> invalidMessageCreator)
      throws IOException {
    if (!processRecord) {
      return null;
    }
    String ownersRecord = csvRecord.get(fieldNumber);
    if (nullOrEmpty(ownersRecord)) {
      return null;
    }
    List<String> owners = listOrEmpty(CsvUtil.fieldToStrings(ownersRecord));
    List<EntityReference> refs = new ArrayList<>();
    for (String owner : owners) {
      List<String> ownerTypes = listOrEmpty(CsvUtil.fieldToEntities(owner));
      if (ownerTypes.size() != 2) {
        importFailure(printer, invalidMessageCreator.apply(fieldNumber), csvRecord);
        return Collections.emptyList();
      }
      EntityReference ownerRef =
          getEntityReference(printer, csvRecord, fieldNumber, ownerTypes.get(0), ownerTypes.get(1));
      if (ownerRef != null) {
        refs.add(ownerRef);
      }
    }
    return refs.isEmpty() ? null : refs;
  }

  public List<EntityReference> getOwners(CSVPrinter printer, CSVRecord csvRecord, int fieldNumber)
      throws IOException {
    return getOwners(printer, csvRecord, fieldNumber, EntityCsv::invalidOwner);
  }

  public List<EntityReference> getReviewers(
      CSVPrinter printer, CSVRecord csvRecord, int fieldNumber) throws IOException {
    return getOwners(printer, csvRecord, fieldNumber, EntityCsv::invalidReviewer);
  }

  /** Owner field is in entityName format */
  public EntityReference getOwnerAsUser(CSVPrinter printer, CSVRecord csvRecord, int fieldNumber)
      throws IOException {
    if (!processRecord) {
      return null;
    }
    String owner = csvRecord.get(fieldNumber);
    if (nullOrEmpty(owner)) {
      return null;
    }
    return getEntityReference(printer, csvRecord, fieldNumber, Entity.USER, owner);
  }

  protected final Boolean getBoolean(CSVPrinter printer, CSVRecord csvRecord, int fieldNumber)
      throws IOException {
    String field = csvRecord.get(fieldNumber);
    if (nullOrEmpty(field)) {
      return null;
    }
    if (field.equals(Boolean.TRUE.toString())) {
      return true;
    }
    if (field.equals(Boolean.FALSE.toString())) {
      return false;
    }
    importFailure(printer, invalidBoolean(fieldNumber, field), csvRecord);
    processRecord = false;
    return false;
  }

  protected final EntityReference getEntityReference(
      CSVPrinter printer, CSVRecord csvRecord, int fieldNumber, String entityType)
      throws IOException {
    if (!processRecord) {
      return null;
    }
    String fqn = csvRecord.get(fieldNumber);
    return getEntityReference(printer, csvRecord, fieldNumber, entityType, fqn);
  }

  protected EntityInterface getEntityByName(String entityType, String fqn) {
    EntityInterface entity =
        entityType.equals(this.entityType) ? dryRunCreatedEntities.get(fqn) : null;
    if (entity == null) {
      EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
      entity = entityRepository.findByNameOrNull(fqn, Include.NON_DELETED);
    }
    return entity;
  }

  protected final EntityReference getEntityReference(
      CSVPrinter printer, CSVRecord csvRecord, int fieldNumber, String entityType, String fqn)
      throws IOException {
    if (nullOrEmpty(fqn)) {
      return null;
    }
    EntityInterface entity = getEntityByName(entityType, fqn);
    if (entity == null) {
      importFailure(printer, entityNotFound(fieldNumber, entityType, fqn), csvRecord);
      processRecord = false;
      return null;
    }
    return entity.getEntityReference();
  }

  protected final List<EntityReference> getEntityReferences(
      CSVPrinter printer, CSVRecord csvRecord, int fieldNumber, String entityType)
      throws IOException {
    if (!processRecord) {
      return null;
    }
    String fqns = csvRecord.get(fieldNumber);
    if (nullOrEmpty(fqns)) {
      return null;
    }
    List<String> fqnList = listOrEmpty(CsvUtil.fieldToStrings(fqns));
    List<EntityReference> refs = new ArrayList<>();
    for (String fqn : fqnList) {
      EntityReference ref = getEntityReference(printer, csvRecord, fieldNumber, entityType, fqn);
      if (!processRecord) {
        return null;
      }
      if (ref != null) {
        refs.add(ref);
      }
    }
    refs.sort(Comparator.comparing(EntityReference::getName));
    return refs.isEmpty() ? null : refs;
  }

  protected final List<TagLabel> getTagLabels(
      CSVPrinter printer,
      CSVRecord csvRecord,
      List<Pair<Integer, TagSource>> fieldNumbersWithSource)
      throws IOException {
    if (!processRecord) {
      return null;
    }
    List<TagLabel> tagLabels = new ArrayList<>();
    for (Pair<Integer, TagSource> pair : fieldNumbersWithSource) {
      int fieldNumbers = pair.getLeft();
      TagSource source = pair.getRight();
      List<EntityReference> refs =
          source == TagSource.CLASSIFICATION
              ? getEntityReferences(printer, csvRecord, fieldNumbers, Entity.TAG)
              : getEntityReferences(printer, csvRecord, fieldNumbers, Entity.GLOSSARY_TERM);
      if (processRecord && !nullOrEmpty(refs)) {
        for (EntityReference ref : refs) {
          tagLabels.add(new TagLabel().withSource(source).withTagFQN(ref.getFullyQualifiedName()));
        }
      }
    }
    return tagLabels;
  }

  public Map<String, Object> getExtension(CSVPrinter printer, CSVRecord csvRecord, int fieldNumber)
      throws IOException {
    String extensionString = csvRecord.get(fieldNumber);
    if (nullOrEmpty(extensionString)) {
      return null;
    }

    Map<String, Object> extensionMap = new HashMap<>();

    for (String extensions : fieldToExtensionStrings(extensionString)) {
      // Split on the first occurrence of ENTITY_TYPE_SEPARATOR to get key-value pair
      int separatorIndex = extensions.indexOf(ENTITY_TYPE_SEPARATOR);

      if (separatorIndex == -1) {
        importFailure(printer, invalidExtension(fieldNumber, extensions, "null"), csvRecord);
        continue;
      }

      String key = extensions.substring(0, separatorIndex);
      String value = extensions.substring(separatorIndex + 1);

      if (key.isEmpty() || value.isEmpty()) {
        importFailure(printer, invalidExtension(fieldNumber, key, value), csvRecord);
      } else {
        extensionMap.put(key, value);
      }
    }

    validateExtension(printer, fieldNumber, csvRecord, extensionMap);
    return extensionMap;
  }

  private void validateExtension(
      CSVPrinter printer, int fieldNumber, CSVRecord csvRecord, Map<String, Object> extensionMap)
      throws IOException {
    for (Map.Entry<String, Object> entry : extensionMap.entrySet()) {
      String fieldName = entry.getKey();
      Object fieldValue = entry.getValue();

      JsonSchema jsonSchema = TypeRegistry.instance().getSchema(entityType, fieldName);
      if (jsonSchema == null) {
        importFailure(printer, invalidCustomPropertyKey(fieldNumber, fieldName), csvRecord);
        return;
      }
      String customPropertyType = TypeRegistry.getCustomPropertyType(entityType, fieldName);
      String propertyConfig = TypeRegistry.getCustomPropertyConfig(entityType, fieldName);

      switch (customPropertyType) {
        case "entityReference", "entityReferenceList" -> {
          boolean isList = "entityReferenceList".equals(customPropertyType);
          fieldValue =
              parseEntityReferences(printer, csvRecord, fieldNumber, fieldValue.toString(), isList);
        }
        case "date-cp", "dateTime-cp", "time-cp" -> fieldValue =
            parseFormattedDateTimeField(
                printer,
                csvRecord,
                fieldNumber,
                fieldName,
                fieldValue.toString(),
                customPropertyType,
                propertyConfig);
        case "enum" -> fieldValue =
            parseEnumType(
                printer,
                csvRecord,
                fieldNumber,
                fieldName,
                customPropertyType,
                fieldValue,
                propertyConfig);
        case "timeInterval" -> fieldValue =
            parseTimeInterval(printer, csvRecord, fieldNumber, fieldName, fieldValue);
        case "number", "integer", "timestamp" -> fieldValue =
            parseLongField(
                printer, csvRecord, fieldNumber, fieldName, customPropertyType, fieldValue);
        case "table-cp" -> fieldValue =
            parseTableType(printer, csvRecord, fieldNumber, fieldName, fieldValue, propertyConfig);

        default -> {}
      }
      // Validate the field against the JSON schema
      validateAndUpdateExtension(
          printer,
          csvRecord,
          fieldNumber,
          fieldName,
          fieldValue,
          customPropertyType,
          extensionMap,
          jsonSchema);
    }
  }

  private Object parseEntityReferences(
      CSVPrinter printer, CSVRecord csvRecord, int fieldNumber, String fieldValue, boolean isList)
      throws IOException {
    List<EntityReference> entityReferences = new ArrayList<>();

    List<String> entityRefStrings =
        isList
            ? listOrEmpty(fieldToInternalArray(fieldValue))
            : Collections.singletonList(fieldValue);

    for (String entityRefStr : entityRefStrings) {
      List<String> entityRefTypeAndValue = listOrEmpty(fieldToEntities(entityRefStr));

      if (entityRefTypeAndValue.size() == 2) {
        EntityReference entityRef =
            getEntityReference(
                printer,
                csvRecord,
                fieldNumber,
                entityRefTypeAndValue.get(0),
                entityRefTypeAndValue.get(1));
        Optional.ofNullable(entityRef).ifPresent(entityReferences::add);
      }
    }

    return isList ? entityReferences : entityReferences.isEmpty() ? null : entityReferences.get(0);
  }

  protected String parseFormattedDateTimeField(
      CSVPrinter printer,
      CSVRecord csvRecord,
      int fieldNumber,
      String fieldName,
      String fieldValue,
      String fieldType,
      String propertyConfig)
      throws IOException {
    try {
      DateTimeFormatter formatter = DateTimeFormatter.ofPattern(propertyConfig, Locale.ENGLISH);

      return switch (fieldType) {
        case "date-cp" -> {
          TemporalAccessor date = formatter.parse(fieldValue);
          yield formatter.format(date);
        }
        case "dateTime-cp" -> {
          LocalDateTime dateTime = LocalDateTime.parse(fieldValue, formatter);
          yield dateTime.format(formatter);
        }
        case "time-cp" -> {
          LocalTime time = LocalTime.parse(fieldValue, formatter);
          yield time.format(formatter);
        }
        default -> throw new IllegalStateException("Unexpected value: " + fieldType);
      };
    } catch (DateTimeParseException e) {
      importFailure(
          printer,
          invalidCustomPropertyFieldFormat(fieldNumber, fieldName, fieldType, propertyConfig),
          csvRecord);
      return null;
    }
  }

  private Map<String, Long> parseTimeInterval(
      CSVPrinter printer, CSVRecord csvRecord, int fieldNumber, String fieldName, Object fieldValue)
      throws IOException {
    List<String> timestampValues = fieldToEntities(fieldValue.toString());
    Map<String, Long> timestampMap = new HashMap<>();
    if (timestampValues.size() == 2) {
      try {
        timestampMap.put("start", Long.parseLong(timestampValues.get(0)));
        timestampMap.put("end", Long.parseLong(timestampValues.get(1)));
      } catch (NumberFormatException e) {
        importFailure(
            printer,
            invalidCustomPropertyValue(
                fieldNumber, fieldName, "timeInterval", fieldValue.toString()),
            csvRecord);
        return null;
      }
    } else {
      importFailure(
          printer,
          invalidCustomPropertyFieldFormat(fieldNumber, fieldName, "timeInterval", "start:end"),
          csvRecord);
      return null;
    }
    return timestampMap;
  }

  private Object parseLongField(
      CSVPrinter printer,
      CSVRecord csvRecord,
      int fieldNumber,
      String fieldName,
      String customPropertyType,
      Object fieldValue)
      throws IOException {
    try {
      return Long.parseLong(fieldValue.toString());
    } catch (NumberFormatException e) {
      importFailure(
          printer,
          invalidCustomPropertyValue(
              fieldNumber, fieldName, customPropertyType, fieldValue.toString()),
          csvRecord);
      return null;
    }
  }

  private Object parseTableType(
      CSVPrinter printer,
      CSVRecord csvRecord,
      int fieldNumber,
      String fieldName,
      Object fieldValue,
      String propertyConfig)
      throws IOException {
    List<String> tableValues = listOrEmpty(fieldToInternalArray(fieldValue.toString()));
    List<Map<String, String>> rows = new ArrayList<>();
    TableConfig tableConfig =
        JsonUtils.treeToValue(JsonUtils.readTree(propertyConfig), TableConfig.class);

    for (String row : tableValues) {
      List<String> columns = listOrEmpty(fieldToColumns(row));
      Map<String, String> rowMap = new LinkedHashMap<>();
      Iterator<String> columnIterator = tableConfig.getColumns().iterator();
      Iterator<String> valueIterator = columns.iterator();

      if (columns.size() > tableConfig.getColumns().size()) {
        importFailure(
            printer,
            invalidCustomPropertyValue(
                fieldNumber,
                fieldName,
                "table",
                "Column count should be less than or equal to " + tableConfig.getColumns().size()),
            csvRecord);
        return null;
      }

      while (columnIterator.hasNext() && valueIterator.hasNext()) {
        rowMap.put(columnIterator.next(), valueIterator.next());
      }

      rows.add(rowMap);
    }

    Map<String, Object> tableJson = new LinkedHashMap<>();
    tableJson.put("rows", rows);
    tableJson.put("columns", tableConfig.getColumns());
    return tableJson;
  }

  private Object parseEnumType(
      CSVPrinter printer,
      CSVRecord csvRecord,
      int fieldNumber,
      String fieldName,
      String customPropertyType,
      Object fieldValue,
      String propertyConfig)
      throws IOException {
    List<String> enumKeys = listOrEmpty(fieldToInternalArray(fieldValue.toString()));
    try {
      EntityRepository.validateEnumKeys(fieldName, JsonUtils.valueToTree(enumKeys), propertyConfig);
    } catch (Exception e) {
      importFailure(
          printer,
          invalidCustomPropertyValue(fieldNumber, fieldName, customPropertyType, e.getMessage()),
          csvRecord);
    }
    return enumKeys.isEmpty() ? null : enumKeys;
  }

  private void validateAndUpdateExtension(
      CSVPrinter printer,
      CSVRecord csvRecord,
      int fieldNumber,
      String fieldName,
      Object fieldValue,
      String customPropertyType,
      Map<String, Object> extensionMap,
      JsonSchema jsonSchema)
      throws IOException {
    if (fieldValue != null) {
      JsonNode jsonNodeValue = JsonUtils.convertValue(fieldValue, JsonNode.class);

      Set<ValidationMessage> validationMessages = jsonSchema.validate(jsonNodeValue);
      if (!validationMessages.isEmpty()) {
        importFailure(
            printer,
            invalidCustomPropertyValue(
                fieldNumber, fieldName, customPropertyType, validationMessages.toString()),
            csvRecord);
      } else {
        extensionMap.put(fieldName, fieldValue);
      }
    }
  }

  public static String[] getResultHeaders(List<CsvHeader> csvHeaders) {
    List<String> importResultsCsvHeader = listOf(IMPORT_STATUS_HEADER, IMPORT_STATUS_DETAILS);
    importResultsCsvHeader.addAll(CsvUtil.getHeaders(csvHeaders));
    return importResultsCsvHeader.toArray(new String[0]);
  }

  // Create a CSVPrinter to capture the import results
  private CSVPrinter getResultsCsv(List<CsvHeader> csvHeaders, StringWriter writer) {
    CSVFormat format =
        Builder.create(CSVFormat.DEFAULT).setHeader(getResultHeaders(csvHeaders)).build();
    try {
      return new CSVPrinter(writer, format);
    } catch (IOException e) {
      documentFailure(failed(e.getMessage(), CsvErrorType.UNKNOWN));
    }
    return null;
  }

  private List<CSVRecord> parse(String csv) {
    Reader in = new StringReader(csv);
    try {
      return CSVFormat.DEFAULT.parse(in).stream().toList();
    } catch (IOException e) {
      documentFailure(failed(e.getMessage(), CsvErrorType.PARSER_FAILURE));
    }
    return null;
  }

  private boolean validateHeaders(CSVRecord csvRecord) {
    importResult.withNumberOfRowsProcessed((int) csvRecord.getRecordNumber());
    if (expectedHeaders.equals(csvRecord.toList())) {
      return true;
    }
    importResult.withNumberOfRowsFailed(1);
    documentFailure(invalidHeader(recordToString(expectedHeaders), recordToString(csvRecord)));
    return false;
  }

  private void processRecord(CSVPrinter resultsPrinter, List<CSVRecord> csvRecords)
      throws IOException {
    processRecord = true;
    createEntity(resultsPrinter, csvRecords); // Convert record into entity for
  }

  public final CSVRecord getNextRecord(
      CSVPrinter resultsPrinter, List<CsvHeader> csvHeaders, List<CSVRecord> csvRecords)
      throws IOException {
    CSVRecord csvRecord = csvRecords.get(recordIndex++);
    // Every row must have total fields corresponding to the number of headers
    if (csvHeaders.size() != csvRecord.size()) {
      importFailure(
          resultsPrinter, invalidFieldCount(expectedHeaders.size(), csvRecord.size()), csvRecord);
      return null;
    }

    // Check if required values are present
    List<String> errors = new ArrayList<>();
    for (int i = 0; i < csvHeaders.size(); i++) {
      String field = csvRecord.get(i);
      boolean fieldRequired = Boolean.TRUE.equals(csvHeaders.get(i).getRequired());
      if (fieldRequired && nullOrEmpty(field)) {
        errors.add(fieldRequired(i));
      }
    }

    if (!errors.isEmpty()) {
      importFailure(resultsPrinter, String.join(FIELD_SEPARATOR, errors), csvRecord);
      return null;
    }
    return csvRecord;
  }

  public final CSVRecord getNextRecord(CSVPrinter resultsPrinter, List<CSVRecord> csvRecords)
      throws IOException {
    return getNextRecord(resultsPrinter, csvHeaders, csvRecords);
  }

  @Transaction
  protected void createEntity(CSVPrinter resultsPrinter, CSVRecord csvRecord, T entity)
      throws IOException {
    entity.setId(UUID.randomUUID());
    entity.setUpdatedBy(importedBy);
    entity.setUpdatedAt(System.currentTimeMillis());
    EntityRepository<T> repository = (EntityRepository<T>) Entity.getEntityRepository(entityType);
    Response.Status responseStatus;
    String violations = ValidatorUtil.validate(entity);
    if (violations != null) {
      // JSON schema based validation failed for the entity
      importFailure(resultsPrinter, violations, csvRecord);
      return;
    }
    if (Boolean.FALSE.equals(importResult.getDryRun())) { // If not dry run, create the entity
      try {
        // In case of updating entity , prepareInternal as update=True
        repository.prepareInternal(
            entity,
            repository.findByNameOrNull(entity.getFullyQualifiedName(), Include.ALL) != null);
        PutResponse<T> response = repository.createOrUpdate(null, entity, importedBy);
        responseStatus = response.getStatus();
        AsyncService.getInstance()
            .getExecutorService()
            .submit(() -> createChangeEventAndUpdateInES(response, importedBy));
      } catch (Exception ex) {
        importFailure(resultsPrinter, ex.getMessage(), csvRecord);
        importResult.setStatus(ApiStatus.FAILURE);
        return;
      }
    } else { // Dry run don't create the entity
      repository.setFullyQualifiedName(entity);
      responseStatus =
          repository.findByNameOrNull(entity.getFullyQualifiedName(), Include.NON_DELETED) == null
              ? Response.Status.CREATED
              : Response.Status.OK;
      // Track the dryRun created entities, as they may be referred by other entities being created
      // during import
      dryRunCreatedEntities.put(entity.getFullyQualifiedName(), entity);
    }

    if (Response.Status.CREATED.equals(responseStatus)) {
      importSuccess(resultsPrinter, csvRecord, ENTITY_CREATED);
    } else {
      importSuccess(resultsPrinter, csvRecord, ENTITY_UPDATED);
    }
  }

  private void createChangeEventAndUpdateInES(PutResponse<T> response, String importedBy) {
    if (!response.getChangeType().equals(EventType.ENTITY_NO_CHANGE)) {
      ChangeEvent changeEvent =
          FormatterUtil.createChangeEventForEntity(
              importedBy, response.getChangeType(), response.getEntity());
      Object entity = changeEvent.getEntity();
      changeEvent = copyChangeEvent(changeEvent);
      changeEvent.setEntity(JsonUtils.pojoToMaskedJson(entity));
      // Change Event and Update in Es
      Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
      Entity.getSearchRepository().updateEntity(response.getEntity().getEntityReference());
    }
  }

  @Transaction
  protected void createUserEntity(CSVPrinter resultsPrinter, CSVRecord csvRecord, T entity)
      throws IOException {
    entity.setId(UUID.randomUUID());
    entity.setUpdatedBy(importedBy);
    entity.setUpdatedAt(System.currentTimeMillis());
    EntityRepository<T> repository = (EntityRepository<T>) Entity.getEntityRepository(entityType);
    Response.Status responseStatus;

    List<String> violationList = new ArrayList<>();

    String violations = ValidatorUtil.validate(entity);
    if (violations != null && !violations.isEmpty()) {
      violationList.addAll(
          Arrays.asList(violations.substring(1, violations.length() - 1).split(", ")));
    }

    String userNameEmailViolation = "";

    if (violations == null || violations.isEmpty()) {
      userNameEmailViolation = ValidatorUtil.validateUserNameWithEmailPrefix(csvRecord);
    } else if (!violations.contains("name must match \"^((?!::).)*$\"")
        && !violations.contains("email must be a well-formed email address")) {
      userNameEmailViolation = ValidatorUtil.validateUserNameWithEmailPrefix(csvRecord);
    }

    if (!userNameEmailViolation.isEmpty()) {
      violationList.add(userNameEmailViolation);
    }

    if (!violationList.isEmpty()) {
      // JSON schema based validation failed for the entity
      importFailure(resultsPrinter, violationList.toString(), csvRecord);
      return;
    }

    if (Boolean.FALSE.equals(importResult.getDryRun())) { // If not dry run, create the entity
      try {
        // In case of updating entity , prepareInternal as update=True
        repository.prepareInternal(
            entity,
            repository.findByNameOrNull(entity.getFullyQualifiedName(), Include.ALL) != null);
        PutResponse<T> response = repository.createOrUpdate(null, entity, importedBy);
        responseStatus = response.getStatus();
      } catch (Exception ex) {
        importFailure(resultsPrinter, ex.getMessage(), csvRecord);
        importResult.setStatus(ApiStatus.FAILURE);
        return;
      }
    } else { // Dry run don't create the entity
      repository.setFullyQualifiedName(entity);
      responseStatus =
          repository.findByNameOrNull(entity.getFullyQualifiedName(), Include.NON_DELETED) == null
              ? Response.Status.CREATED
              : Response.Status.OK;
      // Track the dryRun created entities, as they may be referred by other entities being created
      // during import
      dryRunCreatedEntities.put(entity.getFullyQualifiedName(), entity);
    }

    if (Response.Status.CREATED.equals(responseStatus)) {
      importSuccess(resultsPrinter, csvRecord, ENTITY_CREATED);
    } else {
      importSuccess(resultsPrinter, csvRecord, ENTITY_UPDATED);
    }
  }

  public String failed(String exception, CsvErrorType errorType) {
    return String.format("#%s: Failed to parse the CSV filed - reason %s", errorType, exception);
  }

  public static String invalidHeader(String expected, String actual) {
    return String.format(
        "#%s: Headers [%s] doesn't match [%s]", CsvErrorType.INVALID_HEADER, actual, expected);
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
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String entityNotFound(int field, String entityType, String fqn) {
    String error = String.format("Entity %s of type %s not found", fqn, entityType);
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String columnNotFound(int field, String columnFqn) {
    String error = String.format("Column %s not found", columnFqn);
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String invalidOwner(int field) {
    String error = "Owner should be of format user:userName or team:teamName";
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String invalidReviewer(int field) {
    String error = "Reviewer should be of format user:userName or team:teamName";
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String invalidExtension(int field, String key, String value) {
    String error =
        "Invalid key-value pair in extension string: Key = "
            + key
            + ", Value = "
            + value
            + " . Extensions should be of format customPropertyName:customPropertyValue";
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String invalidCustomPropertyKey(int field, String key) {
    String error = String.format("Unknown custom field: %s", key);
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String invalidCustomPropertyValue(
      int field, String key, String fieldType, String value) {
    String error =
        String.format("Invalid value of Key = %s of type %s, Value = %s", key, fieldType, value);
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String invalidCustomPropertyFieldFormat(
      int field, String fieldName, String fieldType, String propertyConfig) {
    String error =
        String.format(
            "Custom field %s value of type %s is not as per defined format %s",
            fieldName, fieldType, propertyConfig);
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static String invalidBoolean(int field, String fieldValue) {
    String error = String.format("Field %s should be either 'true' of 'false'", fieldValue);
    return String.format(FIELD_ERROR_MSG, CsvErrorType.INVALID_FIELD, field + 1, error);
  }

  public static List<CsvHeader> resetRequiredColumns(
      List<CsvHeader> headers, final List<String> columnNames) {
    if (nullOrEmpty(columnNames)) {
      return headers;
    }
    headers.forEach(
        header -> {
          if (columnNames.contains(header.getName())) {
            header.withRequired(false);
          }
        });
    return headers;
  }

  private void documentFailure(String error) {
    importResult.withStatus(ApiStatus.ABORTED);
    importResult.withAbortReason(error);
  }

  protected void importSuccess(CSVPrinter printer, CSVRecord inputRecord, String successDetails)
      throws IOException {
    List<String> recordList = listOf(IMPORT_SUCCESS, successDetails);
    recordList.addAll(inputRecord.toList());
    printer.printRecord(recordList);
    importResult.withNumberOfRowsProcessed((int) inputRecord.getRecordNumber());
    importResult.withNumberOfRowsPassed(importResult.getNumberOfRowsPassed() + 1);
  }

  protected void importFailure(CSVPrinter printer, String failedReason, CSVRecord inputRecord)
      throws IOException {
    List<String> recordList = listOf(IMPORT_FAILED, failedReason);
    recordList.addAll(inputRecord.toList());
    printer.printRecord(recordList);
    importResult.withNumberOfRowsProcessed((int) inputRecord.getRecordNumber());
    importResult.withNumberOfRowsFailed(importResult.getNumberOfRowsFailed() + 1);
    processRecord = false;
  }

  private void setFinalStatus() {
    ApiStatus status = ApiStatus.FAILURE;
    if (importResult.getNumberOfRowsPassed().equals(importResult.getNumberOfRowsProcessed())) {
      status = ApiStatus.SUCCESS;
    } else if (importResult.getNumberOfRowsPassed() >= 1) {
      status = ApiStatus.PARTIAL_SUCCESS;
    }
    importResult.setStatus(status);
  }

  public record ImportResult(String result, CSVRecord record, String details) {}
}

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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addDomains;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addGlossaryTerms;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.SPREADSHEET;
import static org.openmetadata.service.Entity.WORKSHEET;

import com.google.gson.Gson;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.drives.WorksheetResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class WorksheetRepository extends EntityRepository<Worksheet> {
  static final String PATCH_FIELDS = "columns";
  static final String UPDATE_FIELDS = "columns";
  private static final Set<String> CHANGE_SUMMARY_FIELDS =
      Set.of("description", "owners", "columns.description");

  public WorksheetRepository() {
    super(
        WorksheetResource.COLLECTION_PATH,
        Entity.WORKSHEET,
        Worksheet.class,
        Entity.getCollectionDAO().worksheetDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS,
        CHANGE_SUMMARY_FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(Worksheet worksheet) {
    Spreadsheet spreadsheet = Entity.getEntity(worksheet.getSpreadsheet(), "", Include.NON_DELETED);
    worksheet.setFullyQualifiedName(
        FullyQualifiedName.add(spreadsheet.getFullyQualifiedName(), worksheet.getName()));
    ColumnUtil.setColumnFQN(worksheet.getFullyQualifiedName(), worksheet.getColumns());
  }

  @Override
  public void prepare(Worksheet worksheet, boolean update) {
    // Validate parent spreadsheet first
    Spreadsheet spreadsheet =
        Entity.getEntity(worksheet.getSpreadsheet(), "service", Include.NON_DELETED);
    worksheet.setSpreadsheet(spreadsheet.getEntityReference());

    // If service is not set or is incorrect, get it from the spreadsheet
    if (worksheet.getService() == null
        || !Entity.DRIVE_SERVICE.equals(worksheet.getService().getType())) {
      worksheet.setService(spreadsheet.getService());
      worksheet.setServiceType(spreadsheet.getServiceType());
    } else {
      // Validate service
      DriveService driveService = Entity.getEntity(worksheet.getService(), "", Include.NON_DELETED);
      worksheet.setService(driveService.getEntityReference());
      worksheet.setServiceType(driveService.getServiceType());

      // Ensure the spreadsheet belongs to the same service
      if (!spreadsheet.getService().getId().equals(driveService.getId())) {
        throw new IllegalArgumentException(
            String.format(
                "Spreadsheet %s does not belong to service %s",
                spreadsheet.getFullyQualifiedName(), driveService.getFullyQualifiedName()));
      }
    }

    // During updates, ensure FQN is set if not already present
    if (update && worksheet.getFullyQualifiedName() == null) {
      worksheet.setFullyQualifiedName(
          FullyQualifiedName.add(spreadsheet.getFullyQualifiedName(), worksheet.getName()));
    }

    // Set column FQNs if columns are present (important for patch operations)
    if (worksheet.getColumns() != null && worksheet.getFullyQualifiedName() != null) {
      ColumnUtil.setColumnFQN(worksheet.getFullyQualifiedName(), worksheet.getColumns());
    }
  }

  @Override
  public void storeEntity(Worksheet worksheet, boolean update) {
    // Relationships and fields such as service and spreadsheet are derived and not stored as part
    // of json
    EntityReference service = worksheet.getService();
    EntityReference spreadsheet = worksheet.getSpreadsheet();
    worksheet.withService(null).withSpreadsheet(null);

    // Don't store column tags as JSON but build it on the fly based on relationships
    List<Column> columnWithTags = worksheet.getColumns();
    worksheet.setColumns(ColumnUtil.cloneWithoutTags(columnWithTags));
    worksheet.getColumns().forEach(column -> column.setTags(null));
    store(worksheet, update);
    // Restore the relationships
    worksheet.withColumns(columnWithTags).withService(service).withSpreadsheet(spreadsheet);
  }

  @Override
  public void storeEntities(List<Worksheet> worksheets) {
    List<Worksheet> worksheetsToStore = new ArrayList<>();
    Gson gson = new Gson();

    for (Worksheet worksheet : worksheets) {
      // Save entity-specific relationships
      EntityReference service = worksheet.getService();
      EntityReference spreadsheet = worksheet.getSpreadsheet();
      List<Column> columnWithTags = worksheet.getColumns();

      // Nullify for storage (same as storeEntity)
      worksheet.withService(null).withSpreadsheet(null);
      worksheet.setColumns(ColumnUtil.cloneWithoutTags(columnWithTags));
      if (worksheet.getColumns() != null) {
        worksheet.getColumns().forEach(column -> column.setTags(null));
      }

      // Clone for storage
      String jsonCopy = gson.toJson(worksheet);
      worksheetsToStore.add(gson.fromJson(jsonCopy, Worksheet.class));

      // Restore in original
      worksheet.withColumns(columnWithTags).withService(service).withSpreadsheet(spreadsheet);
    }

    storeMany(worksheetsToStore);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<Worksheet> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Worksheet::getId).toList();
    deleteToMany(ids, Entity.WORKSHEET, Relationship.CONTAINS, Entity.SPREADSHEET);
  }

  @Override
  public void storeRelationships(Worksheet worksheet) {
    if (worksheet.getSpreadsheet() == null) {
      LOG.error("Spreadsheet is null for worksheet {}", worksheet.getId());
      return;
    }
    addRelationship(
        worksheet.getSpreadsheet().getId(),
        worksheet.getId(),
        SPREADSHEET,
        WORKSHEET,
        Relationship.CONTAINS);
    LOG.info(
        "Added CONTAINS relationship from spreadsheet {} to worksheet {}",
        worksheet.getSpreadsheet().getId(),
        worksheet.getId());
  }

  @Override
  public void clearFields(Worksheet worksheet, EntityUtil.Fields fields) {
    worksheet.withUsageSummary(
        fields.contains("usageSummary") ? worksheet.getUsageSummary() : null);
    worksheet.withColumns(fields.contains(COLUMN_FIELD) ? worksheet.getColumns() : null);
    worksheet.withSampleData(fields.contains("sampleData") ? worksheet.getSampleData() : null);
    // Note: spreadsheet and service are always included (like database in Table)
  }

  @Override
  public void setFields(
      Worksheet worksheet, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    setDefaultFields(worksheet);
    setInheritedFields(worksheet, fields);
    if (fields.contains(COLUMN_FIELD) && worksheet.getColumns() != null) {
      ColumnUtil.setColumnFQN(worksheet.getFullyQualifiedName(), worksheet.getColumns());
      Entity.populateEntityFieldTags(
          entityType,
          worksheet.getColumns(),
          worksheet.getFullyQualifiedName(),
          fields.contains(FIELD_TAGS));
    }
  }

  @Override
  public void setInheritedFields(Worksheet worksheet, EntityUtil.Fields fields) {
    // Inherit owners and domains from spreadsheet
    if (worksheet.getSpreadsheet() != null) {
      Spreadsheet spreadsheet =
          Entity.getEntity(
              SPREADSHEET, worksheet.getSpreadsheet().getId(), "owners,domains", Include.ALL);
      inheritOwners(worksheet, fields, spreadsheet);
      inheritDomains(worksheet, fields, spreadsheet);
    }
  }

  @Override
  protected void setInheritedFields(List<Worksheet> worksheets, EntityUtil.Fields fields) {
    // Only fetch spreadsheets if we need to inherit owners or domains
    if (!fields.contains(FIELD_OWNERS) && !fields.contains(FIELD_DOMAINS)) {
      return;
    }

    // Collect unique spreadsheet IDs
    Set<UUID> spreadsheetIds =
        worksheets.stream()
            .map(w -> w.getSpreadsheet())
            .filter(Objects::nonNull)
            .map(EntityReference::getId)
            .collect(Collectors.toSet());

    if (spreadsheetIds.isEmpty()) {
      return;
    }

    // Batch fetch spreadsheets with owners and domains
    SpreadsheetRepository spreadsheetRepo =
        (SpreadsheetRepository) Entity.getEntityRepository(SPREADSHEET);
    List<Spreadsheet> spreadsheets =
        spreadsheetRepo.getDao().findEntitiesByIds(new ArrayList<>(spreadsheetIds), Include.ALL);
    spreadsheetRepo.setFieldsInBulk(
        new EntityUtil.Fields(Set.of("owners", "domains"), "owners,domains"), spreadsheets);

    // Create a map for quick lookup
    Map<UUID, Spreadsheet> spreadsheetMap =
        spreadsheets.stream().collect(Collectors.toMap(Spreadsheet::getId, s -> s));

    // Inherit fields for each worksheet
    for (Worksheet worksheet : worksheets) {
      if (worksheet.getSpreadsheet() != null) {
        Spreadsheet spreadsheet = spreadsheetMap.get(worksheet.getSpreadsheet().getId());
        if (spreadsheet != null) {
          inheritOwners(worksheet, fields, spreadsheet);
          inheritDomains(worksheet, fields, spreadsheet);
        }
      }
    }
  }

  private void setDefaultFields(Worksheet worksheet) {
    EntityReference spreadsheet = getSpreadsheet(worksheet);
    EntityReference service =
        getFromEntityRef(
            spreadsheet.getId(), SPREADSHEET, Relationship.CONTAINS, Entity.DRIVE_SERVICE, true);
    worksheet.withService(service);
    worksheet.withSpreadsheet(spreadsheet);
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<Worksheet> worksheets) {
    // Always set default fields (spreadsheet and service) - they're part of the base entity
    worksheets.forEach(this::setDefaultFields);

    // Fetch and set standard fields (owners, tags, domains, etc.) using parent's batch fetchers
    fetchAndSetFields(worksheets, fields);

    // Set inherited fields (owners, domains) if requested
    setInheritedFields(worksheets, fields);

    // Handle worksheet-specific fields based on what was requested
    worksheets.forEach(
        worksheet -> {
          if (fields.contains(COLUMN_FIELD) && worksheet.getColumns() != null) {
            ColumnUtil.setColumnFQN(worksheet.getFullyQualifiedName(), worksheet.getColumns());
            Entity.populateEntityFieldTags(
                entityType,
                worksheet.getColumns(),
                worksheet.getFullyQualifiedName(),
                fields.contains(FIELD_TAGS));
          }
          // Clear fields that weren't requested
          clearFields(worksheet, fields);
        });
  }

  @Override
  public void restorePatchAttributes(Worksheet original, Worksheet updated) {
    // Patch can't change service or spreadsheet
    updated.withService(original.getService()).withSpreadsheet(original.getSpreadsheet());
  }

  @Override
  public EntityUpdater getUpdater(
      Worksheet original, Worksheet updated, Operation operation, ChangeSource changeSource) {
    return new WorksheetUpdater(original, updated, operation, changeSource);
  }

  @Override
  public void applyTags(Worksheet worksheet) {
    // Add worksheet level tags by adding tag to worksheet relationship
    super.applyTags(worksheet);
    // Apply tags to columns
    applyColumnTags(worksheet.getColumns());
  }

  private EntityReference getSpreadsheet(Worksheet worksheet) {
    return getFromEntityRef(worksheet.getId(), Relationship.CONTAINS, SPREADSHEET, true);
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    Worksheet worksheet = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new WorksheetCsv(worksheet, user).exportCsv(listOf(worksheet), callback);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) {
    // For worksheets, we need the spreadsheet context for import
    throw new UnsupportedOperationException(
        "Worksheet import requires spreadsheet context. Use spreadsheet import instead.");
  }

  public static class WorksheetCsv extends EntityCsv<Worksheet> {
    public static final List<CsvHeader> HEADERS;
    public static final CsvDocumentation DOCUMENTATION;

    static {
      HEADERS =
          listOf(
              new CsvHeader().withName("name").withRequired(true),
              new CsvHeader().withName("displayName"),
              new CsvHeader().withName("description"),
              new CsvHeader().withName("spreadsheet").withRequired(true),
              new CsvHeader().withName("worksheetId"),
              new CsvHeader().withName("index"),
              new CsvHeader().withName("rowCount"),
              new CsvHeader().withName("columnCount"),
              new CsvHeader().withName("isHidden"),
              new CsvHeader().withName("columns"),
              new CsvHeader().withName("owners"),
              new CsvHeader().withName("tags"),
              new CsvHeader().withName("glossaryTerms"),
              new CsvHeader().withName("domain"),
              new CsvHeader().withName("dataProducts"));

      DOCUMENTATION = new CsvDocumentation().withHeaders(HEADERS).withSummary("Worksheet");
    }

    private final Worksheet worksheet;

    WorksheetCsv(Worksheet worksheet, String user) {
      super(WORKSHEET, HEADERS, user);
      this.worksheet = worksheet;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);

      // Get worksheet name and spreadsheet FQN
      String worksheetName = csvRecord.get(0);
      String spreadsheetFqn = csvRecord.get(3); // spreadsheet field
      String worksheetFqn = FullyQualifiedName.add(spreadsheetFqn, worksheetName);

      Worksheet newWorksheet;
      try {
        newWorksheet = Entity.getEntityByName(WORKSHEET, worksheetFqn, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException ex) {
        LOG.warn("Worksheet not found: {}, it will be created with Import.", worksheetFqn);

        // Get spreadsheet reference
        EntityReference spreadsheetRef = getEntityReference(printer, csvRecord, 3, SPREADSHEET);
        if (spreadsheetRef == null) {
          importFailure(
              printer, "Spreadsheet not found for worksheet: " + worksheetName, csvRecord);
          return;
        }

        // Get service from spreadsheet
        Spreadsheet spreadsheet =
            Entity.getEntity(SPREADSHEET, spreadsheetRef.getId(), "service", Include.NON_DELETED);

        newWorksheet =
            new Worksheet()
                .withService(spreadsheet.getService())
                .withSpreadsheet(spreadsheetRef)
                .withName(worksheetName)
                .withFullyQualifiedName(worksheetFqn);
      }

      // Update worksheet fields from CSV
      newWorksheet
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withWorksheetId(csvRecord.get(4))
          .withIndex(nullOrEmpty(csvRecord.get(5)) ? null : Integer.parseInt(csvRecord.get(5)))
          .withRowCount(nullOrEmpty(csvRecord.get(6)) ? null : Integer.parseInt(csvRecord.get(6)))
          .withColumnCount(
              nullOrEmpty(csvRecord.get(7)) ? null : Integer.parseInt(csvRecord.get(7)))
          .withIsHidden(getBoolean(printer, csvRecord, 8))
          .withColumns(parseColumns(csvRecord.get(9)))
          .withOwners(getOwners(printer, csvRecord, 10))
          .withTags(
              getTagLabels(
                  printer,
                  csvRecord,
                  List.of(
                      Pair.of(11, TagLabel.TagSource.CLASSIFICATION),
                      Pair.of(12, TagLabel.TagSource.GLOSSARY))))
          .withDomains(getDomains(printer, csvRecord, 13))
          .withDataProducts(getDataProducts(printer, csvRecord, 14));

      if (processRecord) {
        createEntity(printer, csvRecord, newWorksheet, WORKSHEET);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Worksheet entity) {
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addField(recordList, entity.getSpreadsheet().getFullyQualifiedName());
      addField(recordList, entity.getWorksheetId());
      addField(recordList, entity.getIndex() != null ? entity.getIndex().toString() : "");
      addField(recordList, entity.getRowCount() != null ? entity.getRowCount().toString() : "");
      addField(
          recordList, entity.getColumnCount() != null ? entity.getColumnCount().toString() : "");
      addField(recordList, entity.getIsHidden());
      addField(recordList, columnsToJson(entity.getColumns()));
      addOwners(recordList, entity.getOwners());
      addTagLabels(recordList, entity.getTags());
      addGlossaryTerms(recordList, entity.getTags());
      addDomains(recordList, entity.getDomains());
      addField(
          recordList,
          entity.getDataProducts() != null
              ? entity.getDataProducts().stream()
                  .map(EntityReference::getFullyQualifiedName)
                  .collect(Collectors.joining(";"))
              : "");
      addRecord(csvFile, recordList);
    }

    private List<Column> parseColumns(String columnsJson) {
      if (nullOrEmpty(columnsJson)) {
        return null;
      }
      try {
        return JsonUtils.readObjects(columnsJson, Column.class);
      } catch (Exception e) {
        LOG.warn("Failed to parse columns JSON: {}", columnsJson, e);
        return null;
      }
    }

    private String columnsToJson(List<Column> columns) {
      if (nullOrEmpty(columns)) {
        return "";
      }
      return JsonUtils.pojoToJson(columns);
    }

    private List<EntityReference> getDataProducts(
        CSVPrinter printer, CSVRecord csvRecord, int fieldNumber) throws IOException {
      String dataProductsStr = csvRecord.get(fieldNumber);
      if (nullOrEmpty(dataProductsStr)) {
        return Collections.emptyList();
      }
      List<EntityReference> refs = new ArrayList<>();
      String[] dataProducts = dataProductsStr.split(";");
      for (String dataProduct : dataProducts) {
        EntityReference ref =
            getEntityReference(
                printer, csvRecord, fieldNumber, Entity.DATA_PRODUCT, dataProduct.trim());
        if (ref != null) {
          refs.add(ref);
        }
      }
      return refs.isEmpty() ? null : refs;
    }
  }

  public static final String COLUMN_FIELD = "columns";

  public class WorksheetUpdater extends ColumnEntityUpdater {
    public WorksheetUpdater(
        Worksheet original, Worksheet updated, Operation operation, ChangeSource changeSource) {
      super(original, updated, operation, changeSource);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      LOG.info("WorksheetUpdater.entitySpecificUpdate called");
      recordChange("worksheetId", original.getWorksheetId(), updated.getWorksheetId());
      recordChange("index", original.getIndex(), updated.getIndex());
      recordChange("rowCount", original.getRowCount(), updated.getRowCount());
      recordChange("columnCount", original.getColumnCount(), updated.getColumnCount());
      // Use updateColumns for proper column handling including tags
      LOG.info(
          "Calling updateColumns with original columns: {} and updated columns: {}",
          original.getColumns() != null ? original.getColumns().size() : "null",
          updated.getColumns() != null ? updated.getColumns().size() : "null");
      updateColumns(
          COLUMN_FIELD, original.getColumns(), updated.getColumns(), EntityUtil.columnMatch);
      recordChange("isHidden", original.getIsHidden(), updated.getIsHidden());
      recordChange("sampleData", original.getSampleData(), updated.getSampleData());
    }
  }
}

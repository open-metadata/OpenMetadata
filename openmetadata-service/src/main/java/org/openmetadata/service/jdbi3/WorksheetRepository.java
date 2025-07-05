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
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addGlossaryTerms;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.service.Entity.SPREADSHEET;
import static org.openmetadata.service.Entity.WORKSHEET;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.drives.WorksheetResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class WorksheetRepository extends EntityRepository<Worksheet> {
  public WorksheetRepository() {
    super(
        WorksheetResource.COLLECTION_PATH,
        Entity.WORKSHEET,
        Worksheet.class,
        Entity.getCollectionDAO().worksheetDAO(),
        "",
        "");
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(Worksheet worksheet) {
    worksheet.setFullyQualifiedName(
        FullyQualifiedName.add(
            worksheet.getSpreadsheet().getFullyQualifiedName(), worksheet.getName()));
  }

  @Override
  public void prepare(Worksheet worksheet, boolean update) {
    // Validate service
    DriveService driveService = Entity.getEntity(worksheet.getService(), "", Include.NON_DELETED);
    worksheet.setService(driveService.getEntityReference());
    worksheet.setServiceType(driveService.getServiceType());

    // Validate parent spreadsheet
    Spreadsheet spreadsheet = Entity.getEntity(worksheet.getSpreadsheet(), "", Include.NON_DELETED);
    worksheet.setSpreadsheet(spreadsheet.getEntityReference());
  }

  @Override
  public void storeEntity(Worksheet worksheet, boolean update) {
    // Store service relationship
    EntityReference service = worksheet.getService();
    addRelationship(
        service.getId(), worksheet.getId(), service.getType(), WORKSHEET, Relationship.CONTAINS);

    // Store spreadsheet relationship
    EntityReference spreadsheet = worksheet.getSpreadsheet();
    addRelationship(
        spreadsheet.getId(), worksheet.getId(), SPREADSHEET, WORKSHEET, Relationship.CONTAINS);
  }

  @Override
  public void storeRelationships(Worksheet worksheet) {
    // No additional relationships to store
  }

  @Override
  public void setInheritedFields(Worksheet worksheet, EntityUtil.Fields fields) {
    // Inherit domain from spreadsheet if not set
    if (worksheet.getDomain() == null) {
      Spreadsheet spreadsheet =
          Entity.getEntity(worksheet.getSpreadsheet(), "domain", Include.NON_DELETED);
      worksheet.withDomain(spreadsheet.getDomain());
    }
  }

  @Override
  public void clearFields(Worksheet worksheet, EntityUtil.Fields fields) {
    worksheet.withUsageSummary(
        fields.contains("usageSummary") ? worksheet.getUsageSummary() : null);
    worksheet.withColumns(fields.contains("columns") ? worksheet.getColumns() : null);
    worksheet.withSampleData(fields.contains("sampleData") ? worksheet.getSampleData() : null);
  }

  @Override
  public void setFields(Worksheet worksheet, EntityUtil.Fields fields) {
    worksheet.withService(getContainer(worksheet.getId()));
    worksheet.withSpreadsheet(getSpreadsheet(worksheet));
  }

  @Override
  public void restorePatchAttributes(Worksheet original, Worksheet updated) {
    // Patch can't change service or spreadsheet
    updated.withService(original.getService()).withSpreadsheet(original.getSpreadsheet());
  }

  @Override
  public EntityRepository<Worksheet>.EntityUpdater getUpdater(
      Worksheet original, Worksheet updated, Operation operation) {
    return new WorksheetUpdater(original, updated, operation);
  }

  private EntityReference getSpreadsheet(Worksheet worksheet) {
    return getFromEntityRef(worksheet.getId(), Relationship.CONTAINS, SPREADSHEET, true);
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    Worksheet worksheet = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new WorksheetCsv(worksheet, user).exportCsv(listOf(worksheet));
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
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
          .withDomain(getEntityReference(printer, csvRecord, 13, Entity.DOMAIN))
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
      addField(
          recordList,
          entity.getDomain() == null || Boolean.TRUE.equals(entity.getDomain().getInherited())
              ? ""
              : entity.getDomain().getFullyQualifiedName());
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

  public class WorksheetUpdater extends EntityUpdater {
    public WorksheetUpdater(Worksheet original, Worksheet updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("worksheetId", original.getWorksheetId(), updated.getWorksheetId());
      recordChange("index", original.getIndex(), updated.getIndex());
      recordChange("rowCount", original.getRowCount(), updated.getRowCount());
      recordChange("columnCount", original.getColumnCount(), updated.getColumnCount());
      recordChange("columns", original.getColumns(), updated.getColumns());
      recordChange("isHidden", original.getIsHidden(), updated.getIsHidden());
      recordChange("sampleData", original.getSampleData(), updated.getSampleData());
    }
  }
}

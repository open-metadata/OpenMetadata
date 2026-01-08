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
import static org.openmetadata.service.Entity.DIRECTORY;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.SPREADSHEET;
import static org.openmetadata.service.Entity.WORKSHEET;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
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
import org.openmetadata.service.resources.drives.SpreadsheetResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class SpreadsheetRepository extends EntityRepository<Spreadsheet> {
  public SpreadsheetRepository() {
    super(
        SpreadsheetResource.COLLECTION_PATH,
        Entity.SPREADSHEET,
        Spreadsheet.class,
        Entity.getCollectionDAO().spreadsheetDAO(),
        "",
        "");
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(Spreadsheet spreadsheet) {
    if (spreadsheet.getDirectory() != null) {
      // Spreadsheet is within a directory
      Directory directory = Entity.getEntity(spreadsheet.getDirectory(), "", Include.NON_DELETED);
      spreadsheet.setFullyQualifiedName(
          FullyQualifiedName.add(directory.getFullyQualifiedName(), spreadsheet.getName()));
    } else {
      // Spreadsheet is directly under the service
      DriveService service = Entity.getEntity(spreadsheet.getService(), "", Include.NON_DELETED);
      spreadsheet.setFullyQualifiedName(
          FullyQualifiedName.add(service.getFullyQualifiedName(), spreadsheet.getName()));
    }
    LOG.debug(
        "Set FQN for spreadsheet: {} -> {}",
        spreadsheet.getName(),
        spreadsheet.getFullyQualifiedName());
  }

  @Override
  public void prepare(Spreadsheet spreadsheet, boolean update) {
    // Validate service
    DriveService driveService = Entity.getEntity(spreadsheet.getService(), "", Include.NON_DELETED);
    spreadsheet.setService(driveService.getEntityReference());
    spreadsheet.setServiceType(driveService.getServiceType());

    // Validate parent directory if provided
    if (spreadsheet.getDirectory() != null) {
      Directory directory = Entity.getEntity(spreadsheet.getDirectory(), "", Include.NON_DELETED);
      spreadsheet.setDirectory(directory.getEntityReference());

      // Ensure the directory belongs to the same service
      if (!directory.getService().getId().equals(driveService.getId())) {
        throw new IllegalArgumentException(
            String.format(
                "Directory %s does not belong to service %s",
                directory.getFullyQualifiedName(), driveService.getFullyQualifiedName()));
      }
    }
  }

  @Override
  public void storeEntity(Spreadsheet spreadsheet, boolean update) {
    // Store the entity
    store(spreadsheet, update);
  }

  @Override
  public void storeRelationships(Spreadsheet spreadsheet) {
    // Add relationship from service to spreadsheet
    addRelationship(
        spreadsheet.getService().getId(),
        spreadsheet.getId(),
        spreadsheet.getService().getType(),
        SPREADSHEET,
        Relationship.CONTAINS);

    // Add relationship from directory to spreadsheet if present
    if (spreadsheet.getDirectory() != null) {
      addRelationship(
          spreadsheet.getDirectory().getId(),
          spreadsheet.getId(),
          DIRECTORY,
          SPREADSHEET,
          Relationship.CONTAINS);
    }
    LOG.info(
        "Stored relationships for spreadsheet {} with service {} and directory {}",
        spreadsheet.getId(),
        spreadsheet.getService().getId(),
        spreadsheet.getDirectory() != null ? spreadsheet.getDirectory().getId() : "null");
  }

  @Override
  public void setInheritedFields(Spreadsheet spreadsheet, EntityUtil.Fields fields) {
    // Inherit domain from directory if available, otherwise from service
    if (nullOrEmpty(spreadsheet.getDomains())) {
      if (spreadsheet.getDirectory() != null) {
        Directory directory =
            Entity.getEntity(spreadsheet.getDirectory(), "domains,service", Include.ALL);
        inheritDomains(spreadsheet, fields, directory);
      } else {
        DriveService service =
            Entity.getEntity(spreadsheet.getService(), FIELD_DOMAINS, Include.ALL);
        inheritDomains(spreadsheet, fields, service);
      }
    }
  }

  @Override
  public void clearFields(Spreadsheet spreadsheet, EntityUtil.Fields fields) {
    spreadsheet.withUsageSummary(
        fields.contains("usageSummary") ? spreadsheet.getUsageSummary() : null);
    spreadsheet.withWorksheets(fields.contains("worksheets") ? spreadsheet.getWorksheets() : null);
  }

  @Override
  public void setFields(Spreadsheet spreadsheet, EntityUtil.Fields fields) {
    spreadsheet.withService(getContainer(spreadsheet.getId()));
    spreadsheet.withDirectory(getDirectory(spreadsheet));
    if (fields.contains("worksheets")) {
      LOG.info("setFields: Getting worksheets for spreadsheet {}", spreadsheet.getId());
      List<EntityReference> worksheets = getWorksheets(spreadsheet);
      LOG.info("setFields: Found {} worksheets", worksheets.size());
      spreadsheet.withWorksheets(worksheets);
    } else {
      spreadsheet.withWorksheets(null);
    }
  }

  private EntityReference getDirectory(Spreadsheet spreadsheet) {
    return getFromEntityRef(spreadsheet.getId(), Relationship.CONTAINS, DIRECTORY, false);
  }

  private List<EntityReference> getWorksheets(Spreadsheet spreadsheet) {
    // Based on the logs, the relationship is stored with worksheet as "from" and spreadsheet as
    // "to"
    // So we need to use findTo to find worksheets that point to this spreadsheet
    List<CollectionDAO.EntityRelationshipRecord> records =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findTo(spreadsheet.getId(), SPREADSHEET, Relationship.CONTAINS.ordinal(), WORKSHEET);

    List<EntityReference> worksheets = new ArrayList<>();
    for (CollectionDAO.EntityRelationshipRecord record : records) {
      EntityReference ref =
          Entity.getEntityReferenceById(WORKSHEET, record.getId(), Include.NON_DELETED);
      if (ref != null) {
        worksheets.add(ref);
      }
    }
    return worksheets;
  }

  @Override
  public void restorePatchAttributes(Spreadsheet original, Spreadsheet updated) {
    // Patch can't change service or directory
    updated.withService(original.getService()).withDirectory(original.getDirectory());
  }

  @Override
  public EntityRepository<Spreadsheet>.EntityUpdater getUpdater(
      Spreadsheet original, Spreadsheet updated, Operation operation) {
    return new SpreadsheetUpdater(original, updated, operation);
  }

  @Override
  protected void deleteChildren(
      List<CollectionDAO.EntityRelationshipRecord> children, boolean hardDelete, String updatedBy) {
    // Log for debugging
    if (!children.isEmpty()) {
      LOG.info(
          "SpreadsheetRepository.deleteChildren: Found {} children to delete (hardDelete={})",
          children.size(),
          hardDelete);
      for (CollectionDAO.EntityRelationshipRecord child : children) {
        LOG.info("  - Child: type={}, id={}", child.getType(), child.getId());
      }
    }
    super.deleteChildren(children, hardDelete, updatedBy);
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    Spreadsheet spreadsheet = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new SpreadsheetCsv(spreadsheet, user, recursive).exportCsv(listOf(spreadsheet));
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) {
    // For spreadsheets, we need the directory context for import
    throw new UnsupportedOperationException(
        "Spreadsheet import requires directory context. Use directory import instead.");
  }

  public static class SpreadsheetCsv extends EntityCsv<Spreadsheet> {
    public static final List<CsvHeader> HEADERS;
    public static final CsvDocumentation DOCUMENTATION;

    static {
      HEADERS =
          listOf(
              new CsvHeader().withName("name").withRequired(true),
              new CsvHeader().withName("displayName"),
              new CsvHeader().withName("description"),
              new CsvHeader().withName("directory").withRequired(true),
              new CsvHeader().withName("mimeType"),
              new CsvHeader().withName("path"),
              new CsvHeader().withName("size"),
              new CsvHeader().withName("fileVersion"),
              new CsvHeader().withName("owners"),
              new CsvHeader().withName("tags"),
              new CsvHeader().withName("glossaryTerms"),
              new CsvHeader().withName("domain"),
              new CsvHeader().withName("dataProducts"),
              new CsvHeader().withName("experts"),
              new CsvHeader().withName("reviewers"),
              new CsvHeader().withName("createdTime"),
              new CsvHeader().withName("modifiedTime"));

      DOCUMENTATION = new CsvDocumentation().withHeaders(HEADERS).withSummary("Spreadsheet");
    }

    private final Spreadsheet spreadsheet;
    private final boolean recursive;

    SpreadsheetCsv(Spreadsheet spreadsheet, String user, boolean recursive) {
      super(SPREADSHEET, HEADERS, user);
      this.spreadsheet = spreadsheet;
      this.recursive = recursive;
    }

    @Override
    public CsvImportResult importCsv(List<CSVRecord> records, boolean dryRun) throws IOException {
      if (records != null && !records.isEmpty()) {
        initializeArrays(records.size());
      }
      return super.importCsv(records, dryRun);
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      if (csvRecord == null) {
        return;
      }

      if (recursive && csvRecord.size() > 18) {
        String entityType = csvRecord.get(18);
        if (WORKSHEET.equals(entityType)) {
          return;
        }
      }

      String spreadsheetName = csvRecord.get(0);
      String directoryFqn = csvRecord.get(3);
      String spreadsheetFqn = FullyQualifiedName.add(directoryFqn, spreadsheetName);

      Spreadsheet newSpreadsheet;
      boolean spreadsheetExists;
      try {
        newSpreadsheet =
            Entity.getEntityByName(SPREADSHEET, spreadsheetFqn, "*", Include.NON_DELETED);
        spreadsheetExists = true;
      } catch (EntityNotFoundException ex) {
        EntityReference directoryRef = getEntityReference(printer, csvRecord, 3, DIRECTORY);
        if (directoryRef == null) {
          importFailure(
              printer, "Directory not found for spreadsheet: " + spreadsheetName, csvRecord);
          return;
        }
        Directory directory =
            Entity.getEntity(DIRECTORY, directoryRef.getId(), "service", Include.NON_DELETED);
        newSpreadsheet =
            new Spreadsheet()
                .withService(directory.getService())
                .withDirectory(directoryRef)
                .withName(spreadsheetName)
                .withFullyQualifiedName(spreadsheetFqn);
        spreadsheetExists = false;
      }

      // Store create status with null check
      int recordIndex = getRecordIndex(csvRecord);
      if (recordCreateStatusArray != null
          && recordIndex >= 0
          && recordIndex < recordCreateStatusArray.length) {
        recordCreateStatusArray[recordIndex] = !spreadsheetExists;
      }

      List<FieldChange> fieldsAdded = new ArrayList<>();
      List<FieldChange> fieldsUpdated = new ArrayList<>();

      String displayName = csvRecord.get(1);
      String description = csvRecord.get(2);
      CreateSpreadsheet.SpreadsheetMimeType mimeType =
          CreateSpreadsheet.SpreadsheetMimeType.valueOf(csvRecord.get(4));
      String path = csvRecord.get(5);
      Integer size = nullOrEmpty(csvRecord.get(6)) ? null : Integer.parseInt(csvRecord.get(6));
      String fileVersion = csvRecord.get(7);
      List<EntityReference> owners = getOwners(printer, csvRecord, 8);
      List<TagLabel> tags =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(9, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(10, TagLabel.TagSource.GLOSSARY)));
      List<EntityReference> domains = getDomains(printer, csvRecord, 11);
      List<EntityReference> dataProducts = getDataProducts(printer, csvRecord, 12);
      Long createdTime = nullOrEmpty(csvRecord.get(15)) ? null : Long.parseLong(csvRecord.get(15));
      Long modifiedTime = nullOrEmpty(csvRecord.get(16)) ? null : Long.parseLong(csvRecord.get(16));

      if (!spreadsheetExists) {
        if (!nullOrEmpty(displayName)) {
          fieldsAdded.add(new FieldChange().withName("displayName").withNewValue(displayName));
        }
        if (!nullOrEmpty(description)) {
          fieldsAdded.add(new FieldChange().withName("description").withNewValue(description));
        }
        if (mimeType != null) {
          fieldsAdded.add(new FieldChange().withName("mimeType").withNewValue(mimeType.toString()));
        }
        if (!nullOrEmpty(path)) {
          fieldsAdded.add(new FieldChange().withName("path").withNewValue(path));
        }
        if (size != null) {
          fieldsAdded.add(new FieldChange().withName("size").withNewValue(size.toString()));
        }
        if (!nullOrEmpty(fileVersion)) {
          fieldsAdded.add(new FieldChange().withName("fileVersion").withNewValue(fileVersion));
        }
        if (!nullOrEmpty(owners)) {
          fieldsAdded.add(
              new FieldChange().withName("owners").withNewValue(JsonUtils.pojoToJson(owners)));
        }
        if (!nullOrEmpty(tags)) {
          fieldsAdded.add(
              new FieldChange().withName("tags").withNewValue(JsonUtils.pojoToJson(tags)));
        }
        if (!nullOrEmpty(domains)) {
          fieldsAdded.add(
              new FieldChange().withName("domains").withNewValue(JsonUtils.pojoToJson(domains)));
        }
        if (!nullOrEmpty(dataProducts)) {
          fieldsAdded.add(
              new FieldChange()
                  .withName("dataProducts")
                  .withNewValue(JsonUtils.pojoToJson(dataProducts)));
        }
        if (createdTime != null) {
          fieldsAdded.add(
              new FieldChange().withName("createdTime").withNewValue(createdTime.toString()));
        }
        if (modifiedTime != null) {
          fieldsAdded.add(
              new FieldChange().withName("modifiedTime").withNewValue(modifiedTime.toString()));
        }
      } else {
        if (CommonUtil.isChanged(newSpreadsheet.getDisplayName(), displayName)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("displayName")
                  .withOldValue(newSpreadsheet.getDisplayName())
                  .withNewValue(displayName));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getDescription(), description)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("description")
                  .withOldValue(newSpreadsheet.getDescription())
                  .withNewValue(description));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getMimeType(), mimeType)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("mimeType")
                  .withOldValue(
                      newSpreadsheet.getMimeType() != null
                          ? newSpreadsheet.getMimeType().toString()
                          : null)
                  .withNewValue(mimeType != null ? mimeType.toString() : null));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getPath(), path)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("path")
                  .withOldValue(newSpreadsheet.getPath())
                  .withNewValue(path));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getSize(), size)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("size")
                  .withOldValue(
                      newSpreadsheet.getSize() != null ? newSpreadsheet.getSize().toString() : null)
                  .withNewValue(size != null ? size.toString() : null));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getFileVersion(), fileVersion)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("fileVersion")
                  .withOldValue(newSpreadsheet.getFileVersion())
                  .withNewValue(fileVersion));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getOwners(), owners)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("owners")
                  .withOldValue(JsonUtils.pojoToJson(newSpreadsheet.getOwners()))
                  .withNewValue(JsonUtils.pojoToJson(owners)));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getTags(), tags)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("tags")
                  .withOldValue(JsonUtils.pojoToJson(newSpreadsheet.getTags()))
                  .withNewValue(JsonUtils.pojoToJson(tags)));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getDomains(), domains)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("domains")
                  .withOldValue(JsonUtils.pojoToJson(newSpreadsheet.getDomains()))
                  .withNewValue(JsonUtils.pojoToJson(domains)));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getDataProducts(), dataProducts)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("dataProducts")
                  .withOldValue(JsonUtils.pojoToJson(newSpreadsheet.getDataProducts()))
                  .withNewValue(JsonUtils.pojoToJson(dataProducts)));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getCreatedTime(), createdTime)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("createdTime")
                  .withOldValue(
                      newSpreadsheet.getCreatedTime() != null
                          ? newSpreadsheet.getCreatedTime().toString()
                          : null)
                  .withNewValue(createdTime != null ? createdTime.toString() : null));
        }
        if (CommonUtil.isChanged(newSpreadsheet.getModifiedTime(), modifiedTime)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("modifiedTime")
                  .withOldValue(
                      newSpreadsheet.getModifiedTime() != null
                          ? newSpreadsheet.getModifiedTime().toString()
                          : null)
                  .withNewValue(modifiedTime != null ? modifiedTime.toString() : null));
        }
      }

      ChangeDescription changeDescription = new ChangeDescription();
      if (!fieldsAdded.isEmpty()) {
        changeDescription.setFieldsAdded(fieldsAdded);
      }
      if (!fieldsUpdated.isEmpty()) {
        changeDescription.setFieldsUpdated(fieldsUpdated);
      }
      // Store change description with null check
      if (recordFieldChangesArray != null
          && recordIndex >= 0
          && recordIndex < recordFieldChangesArray.length) {
        recordFieldChangesArray[recordIndex] = changeDescription;
      }

      newSpreadsheet
          .withDisplayName(displayName)
          .withDescription(description)
          .withMimeType(mimeType)
          .withPath(path)
          .withSize(size)
          .withFileVersion(fileVersion)
          .withOwners(owners)
          .withTags(tags)
          .withDomains(domains)
          .withDataProducts(dataProducts)
          .withCreatedTime(createdTime)
          .withModifiedTime(modifiedTime);

      if (processRecord) {
        createEntityWithChangeDescription(printer, csvRecord, newSpreadsheet, SPREADSHEET);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Spreadsheet entity) {
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addField(recordList, entity.getDirectory().getFullyQualifiedName());
      addField(recordList, entity.getMimeType() != null ? entity.getMimeType().toString() : "");
      addField(
          recordList, entity.getCreatedTime() != null ? entity.getCreatedTime().toString() : "");
      addField(
          recordList, entity.getModifiedTime() != null ? entity.getModifiedTime().toString() : "");
      addField(recordList, entity.getPath());
      addField(recordList, entity.getSize() != null ? entity.getSize().toString() : "");
      addField(recordList, entity.getFileVersion());
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
      addOwners(recordList, entity.getExperts());
      addOwners(recordList, entity.getReviewers());

      if (recursive) {
        // Add entity type and FQN for recursive export
        addField(recordList, SPREADSHEET);
        addField(recordList, entity.getFullyQualifiedName());

        // Add empty worksheet-specific fields
        addField(recordList, ""); // worksheetId
        addField(recordList, ""); // index
        addField(recordList, ""); // rowCount
        addField(recordList, ""); // columnCount
      }

      addRecord(csvFile, recordList);
    }

    private List<EntityReference> getDataProducts(
        CSVPrinter printer, CSVRecord csvRecord, int fieldNumber) throws IOException {
      String dataProductsStr = csvRecord.get(fieldNumber);
      if (nullOrEmpty(dataProductsStr)) {
        return null;
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

  public class SpreadsheetUpdater extends EntityUpdater {
    public SpreadsheetUpdater(Spreadsheet original, Spreadsheet updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("mimeType", original.getMimeType(), updated.getMimeType());
      recordChange("createdTime", original.getCreatedTime(), updated.getCreatedTime());
      recordChange("modifiedTime", original.getModifiedTime(), updated.getModifiedTime());
      recordChange("path", original.getPath(), updated.getPath());
      recordChange("driveFileId", original.getDriveFileId(), updated.getDriveFileId());
      recordChange("size", original.getSize(), updated.getSize());
      recordChange("fileVersion", original.getFileVersion(), updated.getFileVersion());
    }
  }
}

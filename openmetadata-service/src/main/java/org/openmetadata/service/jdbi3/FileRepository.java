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
import static org.openmetadata.service.Entity.FILE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.FileType;
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
import org.openmetadata.service.resources.drives.FileResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class FileRepository extends EntityRepository<File> {
  public FileRepository() {
    super(
        FileResource.COLLECTION_PATH,
        Entity.FILE,
        File.class,
        Entity.getCollectionDAO().fileDAO(),
        "",
        "");
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(File file) {
    if (file.getDirectory() != null) {
      // File is within a directory
      Directory directory = Entity.getEntity(file.getDirectory(), "", Include.NON_DELETED);
      file.setFullyQualifiedName(
          FullyQualifiedName.add(directory.getFullyQualifiedName(), file.getName()));
    } else {
      // File is directly under the service
      DriveService service = Entity.getEntity(file.getService(), "", Include.NON_DELETED);
      file.setFullyQualifiedName(
          FullyQualifiedName.add(service.getFullyQualifiedName(), file.getName()));
    }
  }

  @Override
  public void prepare(File file, boolean update) {
    // Validate service
    DriveService driveService = Entity.getEntity(file.getService(), "", Include.NON_DELETED);
    file.setService(driveService.getEntityReference());
    file.setServiceType(driveService.getServiceType());

    // Validate parent directory if provided
    if (file.getDirectory() != null) {
      Directory directory = Entity.getEntity(file.getDirectory(), "service", Include.NON_DELETED);
      file.setDirectory(directory.getEntityReference());

      // Ensure the directory belongs to the same service
      if (!directory.getService().getId().equals(driveService.getId())) {
        LOG.error(
            "Service mismatch - Directory service: {} ({}), File service: {} ({})",
            directory.getService().getFullyQualifiedName(),
            directory.getService().getId(),
            driveService.getFullyQualifiedName(),
            driveService.getId());
        throw new IllegalArgumentException(
            String.format(
                "Directory %s does not belong to service %s",
                directory.getFullyQualifiedName(), driveService.getFullyQualifiedName()));
      }
    }
  }

  @Override
  public void storeEntity(File file, boolean update) {
    // Store the entity
    store(file, update);
  }

  @Override
  public void storeRelationships(File file) {
    // Add relationship from service to file
    addRelationship(
        file.getService().getId(),
        file.getId(),
        file.getService().getType(),
        FILE,
        Relationship.CONTAINS);

    // Add relationship from directory to file if present
    if (file.getDirectory() != null) {
      addRelationship(
          file.getDirectory().getId(), file.getId(), DIRECTORY, FILE, Relationship.CONTAINS);
    }
  }

  @Override
  public void setInheritedFields(File file, EntityUtil.Fields fields) {
    // Inherit domain from directory if available, otherwise from service
    if (nullOrEmpty(file.getDomains())) {
      if (file.getDirectory() != null) {
        Directory directory = Entity.getEntity(file.getDirectory(), "domains,service", Include.ALL);
        inheritDomains(file, fields, directory);
      } else {
        DriveService service = Entity.getEntity(file.getService(), FIELD_DOMAINS, Include.ALL);
        inheritDomains(file, fields, service);
      }
    }
  }

  @Override
  public void clearFields(File file, EntityUtil.Fields fields) {
    file.withUsageSummary(fields.contains("usageSummary") ? file.getUsageSummary() : null);
  }

  @Override
  public void setFields(File file, EntityUtil.Fields fields) {
    file.withService(getService(file));
    file.withDirectory(getDirectory(file));
  }

  @Override
  public void restorePatchAttributes(File original, File updated) {
    updated.withService(original.getService()).withDirectory(original.getDirectory());
  }

  @Override
  public EntityRepository<File>.EntityUpdater getUpdater(
      File original, File updated, Operation operation) {
    return new FileUpdater(original, updated, operation);
  }

  private EntityReference getDirectory(File file) {
    return getFromEntityRef(file.getId(), Relationship.CONTAINS, DIRECTORY, false);
  }

  private EntityReference getService(File file) {
    return getFromEntityRef(file.getId(), Relationship.CONTAINS, Entity.DRIVE_SERVICE, true);
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    File file = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new FileCsv(file, user).exportCsv(listOf(file));
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) {
    // For files, we need the directory context for import
    throw new UnsupportedOperationException(
        "File import requires directory context. Use directory import instead.");
  }

  public static class FileCsv extends EntityCsv<File> {
    public static final List<CsvHeader> HEADERS;
    public static final CsvDocumentation DOCUMENTATION;

    static {
      HEADERS =
          listOf(
              new CsvHeader().withName("name").withRequired(true),
              new CsvHeader().withName("displayName"),
              new CsvHeader().withName("description"),
              new CsvHeader().withName("directory").withRequired(true),
              new CsvHeader().withName("fileType"),
              new CsvHeader().withName("mimeType"),
              new CsvHeader().withName("fileExtension"),
              new CsvHeader().withName("path"),
              new CsvHeader().withName("size"),
              new CsvHeader().withName("checksum"),
              new CsvHeader().withName("isShared"),
              new CsvHeader().withName("owners"),
              new CsvHeader().withName("tags"),
              new CsvHeader().withName("glossaryTerms"),
              new CsvHeader().withName("domain"),
              new CsvHeader().withName("dataProducts"),
              new CsvHeader().withName("experts"),
              new CsvHeader().withName("reviewers"));

      DOCUMENTATION = new CsvDocumentation().withHeaders(HEADERS).withSummary("File");
    }

    private final File file;

    FileCsv(File file, String user) {
      super(FILE, HEADERS, user);
      this.file = file;
    }

    private boolean[] recordCreateStatusArray;
    private ChangeDescription[] recordFieldChangesArray;

    private void initializeArrays(int csvRecordCount) {
      int arraySize = csvRecordCount > 0 ? csvRecordCount - 1 : 0;
      recordCreateStatusArray = new boolean[arraySize];
      recordFieldChangesArray = new ChangeDescription[arraySize];
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

      // Get file name and directory FQN
      String fileName = csvRecord.get(0);
      String directoryFqn = csvRecord.get(3); // directory field
      String fileFqn = FullyQualifiedName.add(directoryFqn, fileName);

      File newFile;
      boolean fileExists;
      try {
        newFile = Entity.getEntityByName(FILE, fileFqn, "*", Include.NON_DELETED);
        fileExists = true;
      } catch (EntityNotFoundException ex) {
        LOG.warn("File not found: {}, it will be created with Import.", fileFqn);

        // Get directory reference
        EntityReference directoryRef = getEntityReference(printer, csvRecord, 3, DIRECTORY);
        if (directoryRef == null) {
          importFailure(printer, "Directory not found for file: " + fileName, csvRecord);
          return;
        }

        // Get service from directory
        Directory directory =
            Entity.getEntity(DIRECTORY, directoryRef.getId(), "service", Include.NON_DELETED);

        newFile =
            new File()
                .withService(directory.getService())
                .withDirectory(directoryRef)
                .withName(fileName)
                .withFullyQualifiedName(fileFqn);
        fileExists = false;
      }

      // Store create status with null check
      int recordIndex = (int) csvRecord.getRecordNumber() - 2;
      if (recordCreateStatusArray != null
          && recordIndex >= 0
          && recordIndex < recordCreateStatusArray.length) {
        recordCreateStatusArray[recordIndex] = !fileExists;
      }

      List<FieldChange> fieldsAdded = new ArrayList<>();
      List<FieldChange> fieldsUpdated = new ArrayList<>();
      String displayName = csvRecord.get(1);
      String description = csvRecord.get(2);
      FileType fileType = FileType.valueOf(csvRecord.get(4));
      String mimeType = csvRecord.get(5);
      String fileExtension = csvRecord.get(6);
      String path = csvRecord.get(7);
      Integer size = nullOrEmpty(csvRecord.get(8)) ? null : Integer.parseInt(csvRecord.get(8));
      String checksum = csvRecord.get(9);
      Boolean isShared = getBoolean(printer, csvRecord, 10);
      List<EntityReference> owners = getOwners(printer, csvRecord, 11);
      List<TagLabel> tags =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(12, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(13, TagLabel.TagSource.GLOSSARY)));
      List<EntityReference> domains = getDomains(printer, csvRecord, 14);
      List<EntityReference> dataProducts = getDataProducts(printer, csvRecord, 15);

      if (!fileExists) {
        if (!nullOrEmpty(displayName)) {
          fieldsAdded.add(new FieldChange().withName("displayName").withNewValue(displayName));
        }
        if (!nullOrEmpty(description)) {
          fieldsAdded.add(new FieldChange().withName("description").withNewValue(description));
        }
        if (fileType != null) {
          fieldsAdded.add(new FieldChange().withName("fileType").withNewValue(fileType.toString()));
        }
        if (!nullOrEmpty(mimeType)) {
          fieldsAdded.add(new FieldChange().withName("mimeType").withNewValue(mimeType));
        }
        if (!nullOrEmpty(fileExtension)) {
          fieldsAdded.add(new FieldChange().withName("fileExtension").withNewValue(fileExtension));
        }
        if (!nullOrEmpty(path)) {
          fieldsAdded.add(new FieldChange().withName("path").withNewValue(path));
        }
        if (size != null) {
          fieldsAdded.add(new FieldChange().withName("size").withNewValue(size.toString()));
        }
        if (!nullOrEmpty(checksum)) {
          fieldsAdded.add(new FieldChange().withName("checksum").withNewValue(checksum));
        }
        if (isShared != null) {
          fieldsAdded.add(new FieldChange().withName("isShared").withNewValue(isShared));
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
      } else {
        if (!Objects.equals(newFile.getDisplayName(), displayName)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("displayName")
                  .withOldValue(newFile.getDisplayName())
                  .withNewValue(displayName));
        }
        if (!Objects.equals(newFile.getDescription(), description)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("description")
                  .withOldValue(newFile.getDescription())
                  .withNewValue(description));
        }
        if (!Objects.equals(newFile.getFileType(), fileType)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("fileType")
                  .withOldValue(
                      newFile.getFileType() != null ? newFile.getFileType().toString() : null)
                  .withNewValue(fileType != null ? fileType.toString() : null));
        }
        if (!Objects.equals(newFile.getMimeType(), mimeType)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("mimeType")
                  .withOldValue(newFile.getMimeType())
                  .withNewValue(mimeType));
        }
        if (!Objects.equals(newFile.getFileExtension(), fileExtension)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("fileExtension")
                  .withOldValue(newFile.getFileExtension())
                  .withNewValue(fileExtension));
        }
        if (!Objects.equals(newFile.getPath(), path)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("path")
                  .withOldValue(newFile.getPath())
                  .withNewValue(path));
        }
        if (!Objects.equals(newFile.getSize(), size)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("size")
                  .withOldValue(newFile.getSize() != null ? newFile.getSize().toString() : null)
                  .withNewValue(size != null ? size.toString() : null));
        }
        if (!Objects.equals(newFile.getChecksum(), checksum)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("checksum")
                  .withOldValue(newFile.getChecksum())
                  .withNewValue(checksum));
        }
        if (isShared != null && !Objects.equals(newFile.getIsShared(), isShared)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("isShared")
                  .withOldValue(newFile.getIsShared())
                  .withNewValue(isShared));
        }
        if (!Objects.equals(newFile.getOwners(), owners)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("owners")
                  .withOldValue(JsonUtils.pojoToJson(newFile.getOwners()))
                  .withNewValue(JsonUtils.pojoToJson(owners)));
        }
        if (!Objects.equals(newFile.getTags(), tags)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("tags")
                  .withOldValue(JsonUtils.pojoToJson(newFile.getTags()))
                  .withNewValue(JsonUtils.pojoToJson(tags)));
        }
        if (!Objects.equals(newFile.getDomains(), domains)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("domains")
                  .withOldValue(JsonUtils.pojoToJson(newFile.getDomains()))
                  .withNewValue(JsonUtils.pojoToJson(domains)));
        }
        if (!Objects.equals(newFile.getDataProducts(), dataProducts)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("dataProducts")
                  .withOldValue(JsonUtils.pojoToJson(newFile.getDataProducts()))
                  .withNewValue(JsonUtils.pojoToJson(dataProducts)));
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

      newFile
          .withDisplayName(displayName)
          .withDescription(description)
          .withFileType(fileType)
          .withMimeType(mimeType)
          .withFileExtension(fileExtension)
          .withPath(path)
          .withSize(size)
          .withChecksum(checksum)
          .withIsShared(isShared)
          .withOwners(owners)
          .withTags(tags)
          .withDomains(domains)
          .withDataProducts(dataProducts);
      if (processRecord) {
        createEntityWithChangeDescription(printer, csvRecord, newFile);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, File entity) {
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addField(
          recordList,
          entity.getDirectory() != null ? entity.getDirectory().getFullyQualifiedName() : "");
      addField(recordList, entity.getFileType().toString());
      addField(recordList, entity.getMimeType());
      addField(recordList, entity.getFileExtension() != null ? entity.getFileExtension() : "");
      addField(recordList, entity.getPath());
      addField(recordList, entity.getSize() != null ? entity.getSize().toString() : "");
      addField(recordList, entity.getChecksum());
      addField(recordList, entity.getIsShared() != null ? entity.getIsShared().toString() : "");
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

    private void createEntityWithChangeDescription(
        CSVPrinter printer, CSVRecord csvRecord, File file) throws IOException {
      int recordIndex = (int) csvRecord.getRecordNumber() - 2;
      boolean isCreated =
          (recordCreateStatusArray != null
                  && recordIndex >= 0
                  && recordIndex < recordCreateStatusArray.length)
              ? recordCreateStatusArray[recordIndex]
              : false;
      ChangeDescription changeDescription =
          (recordFieldChangesArray != null
                  && recordIndex < recordFieldChangesArray.length
                  && recordFieldChangesArray[recordIndex] != null)
              ? recordFieldChangesArray[recordIndex]
              : new ChangeDescription();

      String status = isCreated ? "EntityCreated" : "EntityUpdated";

      if (!Boolean.TRUE.equals(importResult.getDryRun())) {
        try {
          EntityRepository<File> repository =
              (EntityRepository<File>) Entity.getEntityRepository(FILE);
          repository.createOrUpdate(null, file, importedBy);
        } catch (Exception ex) {
          importFailure(printer, ex.getMessage(), csvRecord);
          importResult.setStatus(ApiStatus.FAILURE);
          return;
        }
      }
      importSuccessWithChangeDescription(printer, csvRecord, status, changeDescription);
    }

    private void importSuccessWithChangeDescription(
        CSVPrinter printer,
        CSVRecord inputRecord,
        String successDetails,
        ChangeDescription changeDescription)
        throws IOException {
      List<String> recordList = listOf(IMPORT_SUCCESS, successDetails);
      recordList.addAll(inputRecord.toList());

      if (changeDescription != null) {
        recordList.add(JsonUtils.pojoToJson(changeDescription));
      } else {
        recordList.add("");
      }

      printer.printRecord(recordList);
      importResult.withNumberOfRowsProcessed((int) inputRecord.getRecordNumber());
      importResult.withNumberOfRowsPassed(importResult.getNumberOfRowsPassed() + 1);
    }
  }

  public class FileUpdater extends EntityUpdater {
    public FileUpdater(File original, File updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("description", original.getDescription(), updated.getDescription());
      recordChange("fileType", original.getFileType(), updated.getFileType());
      recordChange("mimeType", original.getMimeType(), updated.getMimeType());
      recordChange("fileExtension", original.getFileExtension(), updated.getFileExtension());
      recordChange("path", original.getPath(), updated.getPath());
      recordChange("size", original.getSize(), updated.getSize());
      recordChange("checksum", original.getChecksum(), updated.getChecksum());
      recordChange("webViewLink", original.getWebViewLink(), updated.getWebViewLink());
      recordChange("downloadLink", original.getDownloadLink(), updated.getDownloadLink());
      recordChange("isShared", original.getIsShared(), updated.getIsShared());
      recordChange("fileVersion", original.getFileVersion(), updated.getFileVersion());
    }
  }
}

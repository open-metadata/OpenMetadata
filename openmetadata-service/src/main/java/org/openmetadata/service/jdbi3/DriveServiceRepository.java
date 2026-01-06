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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addDomains;
import static org.openmetadata.csv.CsvUtil.addExtension;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addGlossaryTerms;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.csv.CsvUtil.formatCsv;
import static org.openmetadata.service.Entity.DIRECTORY;
import static org.openmetadata.service.Entity.DRIVE_SERVICE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.services.drive.DriveServiceResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DriveServiceRepository extends ServiceEntityRepository<DriveService, DriveConnection> {
  public DriveServiceRepository() {
    super(
        DriveServiceResource.COLLECTION_PATH,
        Entity.DRIVE_SERVICE,
        Entity.getCollectionDAO().driveServiceDAO(),
        DriveConnection.class,
        "",
        ServiceType.DRIVE);
    supportsSearch = true;
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    DriveService driveService =
        getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS); // Validate drive service name
    DirectoryRepository repository = (DirectoryRepository) Entity.getEntityRepository(DIRECTORY);
    List<Directory> directories =
        repository.listAllForCSV(
            repository.getFields("name,owners,tags,domains,extension"),
            driveService.getFullyQualifiedName());

    directories.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new DriveServiceCsv(driveService, user, recursive).exportAllCsv(directories, recursive);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    // Validate drive service
    DriveService driveService =
        getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS); // Validate drive service name
    DriveServiceCsv driveServiceCsv = new DriveServiceCsv(driveService, user, recursive);
    List<CSVRecord> records;
    if (recursive) {
      records = driveServiceCsv.parse(csv, recursive);
    } else {
      records = driveServiceCsv.parse(csv);
    }
    return driveServiceCsv.importCsv(records, dryRun);
  }

  public static class DriveServiceCsv extends EntityCsv<Directory> {
    public final CsvDocumentation DOCUMENTATION;
    public final List<CsvHeader> HEADERS;
    private final DriveService service;
    private final boolean recursive;

    public DriveServiceCsv(DriveService service, String user, boolean recursive) {
      super(DIRECTORY, getCsvDocumentation(DRIVE_SERVICE, recursive).getHeaders(), user);
      this.service = service;
      this.DOCUMENTATION = getCsvDocumentation(DRIVE_SERVICE, recursive);
      this.HEADERS = DOCUMENTATION.getHeaders();
      this.recursive = recursive;
    }

    @Override
    public CsvImportResult importCsv(List<CSVRecord> records, boolean dryRun) throws IOException {
      if (records != null && !records.isEmpty()) {
        initializeArrays(records.size());
      }
      return super.importCsv(records, dryRun);
    }

    /**
     * Export all directories with their child entities (subdirectories, files, spreadsheets, worksheets)
     */
    public String exportAllCsv(List<Directory> directories, boolean recursive) throws IOException {
      if (!recursive) {
        return this.exportCsv(directories);
      }
      CsvFile csvFile = new CsvFile().withHeaders(HEADERS);
      for (Directory directory : directories) {
        addEntityToCSV(csvFile, directory, DIRECTORY);
        DirectoryRepository directoryRepository =
            (DirectoryRepository) Entity.getEntityRepository(DIRECTORY);
        String dirCsv =
            directoryRepository.exportToCsv(
                directory.getFullyQualifiedName(), importedBy, recursive);
        if (dirCsv != null && !dirCsv.isEmpty()) {
          try {
            // Parse the CSV content
            CSVParser parser = CSVParser.parse(dirCsv, CSVFormat.DEFAULT.withFirstRecordAsHeader());
            for (CSVRecord record : parser) {
              // Convert the CSV record to a List<String>
              List<String> recordList = new ArrayList<>();
              for (int i = 0; i < record.size(); i++) {
                recordList.add(record.get(i));
              }
              // Add the record to the CSV file using the overridden addRecord method
              this.addRecord(csvFile, recordList);
            }
          } catch (Exception e) {
            LOG.error("Error parsing directory CSV: {}", e.getMessage());
          }
        }
      }
      return formatCsv(csvFile);
    }

    @Override
    protected void addRecord(CsvFile csvFile, Directory entity) {
      addEntityToCSV(csvFile, entity, DIRECTORY);
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      if (csvRecord == null) {
        return;
      }

      String directoryFqn =
          FullyQualifiedName.add(service.getFullyQualifiedName(), csvRecord.get(0));
      Directory directory;
      boolean directoryExists;
      try {
        directory = Entity.getEntityByName(DIRECTORY, directoryFqn, "*", Include.NON_DELETED);
        directoryExists = true;
      } catch (EntityNotFoundException ex) {
        directory =
            new Directory()
                .withService(service.getEntityReference())
                .withName(csvRecord.get(0))
                .withFullyQualifiedName(directoryFqn);
        directoryExists = false;
      }

      // Store create status with null check
      int recordIndex = (int) csvRecord.getRecordNumber() - 1;
      if (recordCreateStatusArray != null && recordIndex < recordCreateStatusArray.length) {
        recordCreateStatusArray[recordIndex] = !directoryExists;
      }

      List<FieldChange> fieldsAdded = new ArrayList<>();
      List<FieldChange> fieldsUpdated = new ArrayList<>();

      String description = csvRecord.get(1);
      String displayName = csvRecord.get(2);
      List<EntityReference> owners = getOwners(printer, csvRecord, 3);
      List<TagLabel> tags =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(5, TagLabel.TagSource.GLOSSARY)));
      List<EntityReference> domains = getDomains(printer, csvRecord, 6);
      Object extension = getExtension(printer, csvRecord, 7);

      if (!directoryExists) {
        if (description != null) {
          fieldsAdded.add(new FieldChange().withName("description").withNewValue(description));
        }
        if (displayName != null) {
          fieldsAdded.add(new FieldChange().withName("displayName").withNewValue(displayName));
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
        if (extension != null) {
          fieldsAdded.add(
              new FieldChange()
                  .withName("extension")
                  .withNewValue(JsonUtils.pojoToJson(extension)));
        }
      } else {
        if (!Objects.equals(directory.getDescription(), description)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("description")
                  .withOldValue(directory.getDescription())
                  .withNewValue(description));
        }
        if (!Objects.equals(directory.getDisplayName(), displayName)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("displayName")
                  .withOldValue(directory.getDisplayName())
                  .withNewValue(displayName));
        }
        if (!Objects.equals(directory.getOwners(), owners)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("owners")
                  .withOldValue(JsonUtils.pojoToJson(directory.getOwners()))
                  .withNewValue(JsonUtils.pojoToJson(owners)));
        }
        if (!Objects.equals(directory.getTags(), tags)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("tags")
                  .withOldValue(JsonUtils.pojoToJson(directory.getTags()))
                  .withNewValue(JsonUtils.pojoToJson(tags)));
        }
        if (!Objects.equals(directory.getDomains(), domains)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("domains")
                  .withOldValue(JsonUtils.pojoToJson(directory.getDomains()))
                  .withNewValue(JsonUtils.pojoToJson(domains)));
        }
        if (!Objects.equals(directory.getExtension(), extension)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("extension")
                  .withOldValue(JsonUtils.pojoToJson(directory.getExtension()))
                  .withNewValue(JsonUtils.pojoToJson(extension)));
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
      if (recordFieldChangesArray != null && recordIndex < recordFieldChangesArray.length) {
        recordFieldChangesArray[recordIndex] = changeDescription;
      }

      directory
          .withDescription(description)
          .withDisplayName(displayName)
          .withOwners(owners)
          .withTags(tags)
          .withDomains(domains)
          .withExtension(extension);

      if (processRecord) {
        createEntityWithChangeDescription(printer, csvRecord, directory, DIRECTORY);
      }
    }

    protected void addEntityToCSV(CsvFile csvFile, EntityInterface entity, String entityType) {
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addOwners(recordList, entity.getOwners());
      addTagLabels(recordList, entity.getTags());
      addGlossaryTerms(recordList, entity.getTags());
      addDomains(recordList, entity.getDomains());
      addExtension(recordList, entity.getExtension());

      // Add entity type and FQN for recursive export
      if (recursive) {
        addField(recordList, entityType);
        addField(recordList, entity.getFullyQualifiedName());
      }

      addRecord(csvFile, recordList);
    }

    private Directory getEntityFromFQN(String fqn) {
      try {
        return Entity.getEntityByName(DIRECTORY, fqn, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException e) {
        LOG.warn("Directory not found: {}", fqn);
        return null;
      }
    }
  }
}

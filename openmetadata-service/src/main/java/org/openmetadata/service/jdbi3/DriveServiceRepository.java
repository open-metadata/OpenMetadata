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
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.services.DriveServiceResource;
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
      String directoryFqn =
          FullyQualifiedName.add(service.getFullyQualifiedName(), csvRecord.get(0));
      Directory directory;
      try {
        directory = Entity.getEntityByName(DIRECTORY, directoryFqn, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException ex) {
        LOG.warn("Directory not found: {}, it will be created with Import.", directoryFqn);
        directory =
            new Directory()
                .withService(service.getEntityReference())
                .withName(csvRecord.get(0))
                .withFullyQualifiedName(directoryFqn);
      }

      // Update directory fields from CSV
      directory
          .withDescription(csvRecord.get(1))
          .withDisplayName(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(
              getTagLabels(
                  printer,
                  csvRecord,
                  List.of(
                      Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                      Pair.of(5, TagLabel.TagSource.GLOSSARY))))
          .withDomain(getEntityReference(printer, csvRecord, 6, Entity.DOMAIN))
          .withExtension(getExtension(printer, csvRecord, 7));

      if (processRecord) {
        createEntity(printer, csvRecord, directory, DIRECTORY);
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

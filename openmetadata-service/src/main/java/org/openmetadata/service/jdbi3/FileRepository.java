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
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.FILE;

import com.google.gson.Gson;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FileType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.drives.FileResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class FileRepository extends EntityRepository<File> {
  public static final String COLUMN_FIELD = "columns";
  public static final String FILE_SAMPLE_DATA_EXTENSION = "file.sampleData";
  static final String PATCH_FIELDS = "columns";
  static final String UPDATE_FIELDS = "columns";

  public FileRepository() {
    super(
        FileResource.COLLECTION_PATH,
        Entity.FILE,
        File.class,
        Entity.getCollectionDAO().fileDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
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
    // Don't store column tags as JSON but build it on the fly based on relationships
    List<Column> columnsWithTags = file.getColumns();
    file.setColumns(ColumnUtil.cloneWithoutTags(columnsWithTags));
    if (file.getColumns() != null) {
      file.getColumns().forEach(column -> column.setTags(null));
    }
    store(file, update);
    // Restore columns with tags
    file.withColumns(columnsWithTags);
  }

  @Override
  public void storeEntities(List<File> files) {
    List<File> filesToStore = new ArrayList<>();
    Gson gson = new Gson();

    for (File file : files) {
      // Don't store column tags as JSON but build it on the fly based on relationships
      List<Column> columnsWithTags = file.getColumns();
      file.setColumns(ColumnUtil.cloneWithoutTags(columnsWithTags));
      if (file.getColumns() != null) {
        file.getColumns().forEach(column -> column.setTags(null));
      }

      // Clone for storage
      String jsonCopy = gson.toJson(file);
      filesToStore.add(gson.fromJson(jsonCopy, File.class));

      // Restore columns with tags in original
      file.withColumns(columnsWithTags);
    }

    storeMany(filesToStore);
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
    file.withColumns(fields.contains(COLUMN_FIELD) ? file.getColumns() : null);
    file.withSampleData(fields.contains("sampleData") ? file.getSampleData() : null);
  }

  @Override
  public void setFields(File file, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    file.withService(getService(file));
    file.withDirectory(getDirectory(file));
    if (fields.contains(COLUMN_FIELD) && file.getColumns() != null) {
      ColumnUtil.setColumnFQN(file.getFullyQualifiedName(), file.getColumns());
      Entity.populateEntityFieldTags(
          entityType, file.getColumns(), file.getFullyQualifiedName(), fields.contains(FIELD_TAGS));
    }
    if (fields.contains("sampleData")) {
      file.withSampleData(getSampleData(file));
    }
  }

  private TableData getSampleData(File file) {
    return JsonUtils.readValue(
        daoCollection.entityExtensionDAO().getExtension(file.getId(), FILE_SAMPLE_DATA_EXTENSION),
        TableData.class);
  }

  @Override
  public void applyTags(File file) {
    // Add file level tags by adding tag to file relationship
    super.applyTags(file);
    // Apply tags to columns if present
    if (file.getColumns() != null) {
      applyColumnTags(file.getColumns());
    }
  }

  @Override
  public void restorePatchAttributes(File original, File updated) {
    updated.withService(original.getService()).withDirectory(original.getDirectory());
  }

  @Override
  public EntityUpdater getUpdater(
      File original, File updated, Operation operation, ChangeSource changeSource) {
    return new FileUpdater(original, updated, operation, changeSource);
  }

  private EntityReference getDirectory(File file) {
    return getFromEntityRef(file.getId(), Relationship.CONTAINS, DIRECTORY, false);
  }

  private EntityReference getService(File file) {
    return getFromEntityRef(file.getId(), Relationship.CONTAINS, Entity.DRIVE_SERVICE, true);
  }

  @Transaction
  public File addSampleData(UUID fileId, TableData tableData) {
    File file = find(fileId, Include.NON_DELETED);

    // Validate columns match if file has columns defined
    if (file.getColumns() != null && !file.getColumns().isEmpty()) {
      for (String columnName : tableData.getColumns()) {
        validateColumn(file, columnName);
      }
    }

    // Make sure each row has values for all columns
    for (List<Object> row : tableData.getRows()) {
      if (row.size() != tableData.getColumns().size()) {
        throw new IllegalArgumentException(
            String.format(
                "Number of columns is %d but row has %d sample values",
                tableData.getColumns().size(), row.size()));
      }
    }

    daoCollection
        .entityExtensionDAO()
        .insert(fileId, FILE_SAMPLE_DATA_EXTENSION, "tableData", JsonUtils.pojoToJson(tableData));
    setFieldsInternal(file, EntityUtil.Fields.EMPTY_FIELDS);
    return file.withSampleData(tableData);
  }

  public File getSampleData(UUID fileId) {
    File file = find(fileId, Include.NON_DELETED);
    TableData sampleData =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionDAO()
                .getExtension(file.getId(), FILE_SAMPLE_DATA_EXTENSION),
            TableData.class);
    file.setSampleData(sampleData);
    setFieldsInternal(file, EntityUtil.Fields.EMPTY_FIELDS);
    return file;
  }

  @Transaction
  public File deleteSampleData(UUID fileId) {
    File file = find(fileId, Include.NON_DELETED);
    daoCollection.entityExtensionDAO().delete(fileId, FILE_SAMPLE_DATA_EXTENSION);
    setFieldsInternal(file, EntityUtil.Fields.EMPTY_FIELDS);
    return file;
  }

  private void validateColumn(File file, String columnName) {
    if (file.getColumns() == null) {
      return;
    }
    boolean found =
        file.getColumns().stream().anyMatch(column -> column.getName().equals(columnName));
    if (!found) {
      throw new IllegalArgumentException(
          String.format("Column '%s' not found in file columns", columnName));
    }
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    File file = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new FileCsv(file, user).exportCsv(listOf(file), callback);
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

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);

      // Get file name and directory FQN
      String fileName = csvRecord.get(0);
      String directoryFqn = csvRecord.get(3); // directory field
      String fileFqn = FullyQualifiedName.add(directoryFqn, fileName);

      File newFile;
      try {
        newFile = Entity.getEntityByName(FILE, fileFqn, "*", Include.NON_DELETED);
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
      }
      newFile
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withFileType(FileType.valueOf(csvRecord.get(4)))
          .withMimeType(csvRecord.get(5))
          .withFileExtension(csvRecord.get(6))
          .withPath(csvRecord.get(7))
          .withSize(nullOrEmpty(csvRecord.get(8)) ? null : Integer.parseInt(csvRecord.get(8)))
          .withChecksum(csvRecord.get(9))
          .withIsShared(getBoolean(printer, csvRecord, 10))
          .withOwners(getOwners(printer, csvRecord, 11))
          .withTags(
              getTagLabels(
                  printer,
                  csvRecord,
                  List.of(
                      Pair.of(12, TagLabel.TagSource.CLASSIFICATION),
                      Pair.of(13, TagLabel.TagSource.GLOSSARY))))
          .withDomains(getDomains(printer, csvRecord, 14))
          .withDataProducts(getDataProducts(printer, csvRecord, 15));
      if (processRecord) {
        createEntity(printer, csvRecord, newFile, FILE);
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
  }

  public class FileUpdater extends ColumnEntityUpdater {
    public FileUpdater(
        File original, File updated, Operation operation, ChangeSource changeSource) {
      super(original, updated, operation, changeSource);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
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
      // Handle columns with proper column handling including tags
      updateColumns(
          COLUMN_FIELD, original.getColumns(), updated.getColumns(), EntityUtil.columnMatch);
    }
  }
}

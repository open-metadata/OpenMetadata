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
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
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
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.services.DriveService;
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
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.InheritedReferences;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityColumnMutation;
import org.openmetadata.service.entity.write.EntityColumnUpdater;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.drives.FileResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository()
public class FileRepository implements EntityPolicy<File> {

  public static final String COLUMN_FIELD = "columns";

  public static final String FILE_SAMPLE_DATA_EXTENSION = "file.sampleData";

  static final String PATCH_FIELDS = "columns";

  static final String UPDATE_FIELDS = "columns";

  private static final Set<String> CHANGE_SUMMARY_FIELDS = Set.of("columns.description");

  public FileRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                FileResource.COLLECTION_PATH,
                Entity.FILE,
                File.class,
                Entity.getCollectionDAO().fileDAO()),
            new EntityPolicyContext.WriteFields(PATCH_FIELDS, UPDATE_FIELDS, CHANGE_SUMMARY_FIELDS),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // Covered by the parent service delete cascade: search docs by service.id
    // (SearchRepository.deleteOrUpdateChildren) and field_relationship / tag_usage by
    // the root cleanup() FQN prefix (FQNs are service-nested). See
    // EntityRepository#descendantsCoveredByAncestorCascade.
    context().options().setDescendantsCoveredByAncestorCascade(true);
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
    // Columns need their FQN set on the write path too, not only when read back in setFields:
    // the update path compares columns by FQN, and a null one NPEs on every re-ingestion.
    // listOrEmpty because non-tabular files (images, PDFs, ...) carry no columns.
    ColumnUtil.setColumnFQN(file.getFullyQualifiedName(), listOrEmpty(file.getColumns()));
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
  public ObjectNode storageJsonNode(File file) {
    ObjectNode node = EntityPolicy.super.storageJsonNode(file);
    stripColumnTags(node.get("columns"));
    return node;
  }

  private void stripColumnTags(JsonNode columnsNode) {
    if (!(columnsNode instanceof ArrayNode columnArray)) {
      return;
    }
    for (JsonNode column : columnArray) {
      if (!(column instanceof ObjectNode columnNode)) {
        continue;
      }
      columnNode.remove("tags");
      stripColumnTags(columnNode.get("children"));
    }
  }

  @Override
  public void storeEntity(File file, boolean update) {
    persistence().store(file, update);
  }

  @Override
  public void storeEntities(List<File> files) {
    persistence().insertMany(files);
  }

  @Override
  public void storeRelationships(File file) {
    // Add relationship from service to file
    relationshipWrites()
        .add(
            new EntityRelationshipWriter.Edge(
                file.getService().getId(),
                file.getId(),
                file.getService().getType(),
                FILE,
                Relationship.CONTAINS),
            EntityRelationshipWriter.Value.EMPTY,
            false);
    // Add relationship from directory to file if present
    if (file.getDirectory() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  file.getDirectory().getId(),
                  file.getId(),
                  DIRECTORY,
                  FILE,
                  Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public void setInheritedFields(File file, EntityUtil.Fields fields) {
    // Inherit domain from directory if available, otherwise from service
    if (nullOrEmpty(file.getDomains())) {
      if (file.getDirectory() != null) {
        Directory directory = Entity.getEntity(file.getDirectory(), "domains,service", Include.ALL);
        InheritedReferences.apply(InheritedReferences.Field.DOMAINS, file, fields, directory);
      } else {
        DriveService service = Entity.getEntity(file.getService(), FIELD_DOMAINS, Include.ALL);
        InheritedReferences.apply(InheritedReferences.Field.DOMAINS, file, fields, service);
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
          context().schema().entityType(),
          file.getColumns(),
          file.getFullyQualifiedName(),
          fields.contains(FIELD_TAGS));
    }
    if (fields.contains("sampleData")) {
      file.withSampleData(getSampleData(file));
    }
  }

  private TableData getSampleData(File file) {
    return JsonUtils.readValue(
        context()
            .dependencies()
            .daos()
            .entityExtensionDAO()
            .getExtension(file.getId(), FILE_SAMPLE_DATA_EXTENSION),
        TableData.class);
  }

  @Override
  public void applyTags(File file) {
    // Add file level tags by adding tag to file relationship
    EntityPolicy.super.applyTags(file);
    // Apply tags to columns if present
    if (file.getColumns() != null) {
      tagWrites().addColumns(file.getColumns());
    }
  }

  @Override
  public void restorePatchAttributes(File original, File updated) {
    updated.withService(original.getService()).withDirectory(original.getDirectory());
  }

  @Override
  public EntityUpdater<File> getUpdater(
      File original, File updated, EntityOperation operation, ChangeSource changeSource) {
    return new FileUpdater(original, updated, operation, changeSource).mutation();
  }

  private EntityReference getDirectory(File file) {
    return relationships().singleFrom(file.getId(), Relationship.CONTAINS, DIRECTORY, false);
  }

  private EntityReference getService(File file) {
    return relationships()
        .singleFrom(file.getId(), Relationship.CONTAINS, Entity.DRIVE_SERVICE, true);
  }

  @Transaction
  public File addSampleData(UUID fileId, TableData tableData) {
    File file = lookup().byId(fileId, Include.NON_DELETED);
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
    context()
        .dependencies()
        .daos()
        .entityExtensionDAO()
        .insert(fileId, FILE_SAMPLE_DATA_EXTENSION, "tableData", JsonUtils.pojoToJson(tableData));
    setFieldsInternal(file, EntityUtil.Fields.EMPTY_FIELDS);
    return file.withSampleData(tableData);
  }

  public File getSampleData(UUID fileId) {
    File file = lookup().byId(fileId, Include.NON_DELETED);
    TableData sampleData =
        JsonUtils.readValue(
            context()
                .dependencies()
                .daos()
                .entityExtensionDAO()
                .getExtension(file.getId(), FILE_SAMPLE_DATA_EXTENSION),
            TableData.class);
    file.setSampleData(sampleData);
    setFieldsInternal(file, EntityUtil.Fields.EMPTY_FIELDS);
    return file;
  }

  @Transaction
  public File deleteSampleData(UUID fileId) {
    File file = lookup().byId(fileId, Include.NON_DELETED);
    context().dependencies().daos().entityExtensionDAO().delete(fileId, FILE_SAMPLE_DATA_EXTENSION);
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
      // directory field
      String directoryFqn = csvRecord.get(3);
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
          .withDomains(getDomains(printer, csvRecord, 14, newFile.getDomains()))
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
        CSVPrinter printer, CSVRecord csvRecord, int fieldNumber) {
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

  public class FileUpdater implements EntityColumnMutation<File> {

    public FileUpdater(
        File original, File updated, EntityOperation operation, ChangeSource changeSource) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, changeSource, false),
              this);
      this.columnUpdate = new EntityColumnUpdater<>(entityUpdate, this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<File> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "fileType",
          () ->
              entityUpdate.recordChange(
                  "fileType",
                  entityUpdate.getOriginal().getFileType(),
                  entityUpdate.getUpdated().getFileType()));
      entityUpdate.compareAndUpdate(
          "mimeType",
          () ->
              entityUpdate.recordChange(
                  "mimeType",
                  entityUpdate.getOriginal().getMimeType(),
                  entityUpdate.getUpdated().getMimeType()));
      entityUpdate.compareAndUpdate(
          "fileExtension",
          () ->
              entityUpdate.recordChange(
                  "fileExtension",
                  entityUpdate.getOriginal().getFileExtension(),
                  entityUpdate.getUpdated().getFileExtension()));
      entityUpdate.compareAndUpdate(
          "path",
          () ->
              entityUpdate.recordChange(
                  "path",
                  entityUpdate.getOriginal().getPath(),
                  entityUpdate.getUpdated().getPath()));
      entityUpdate.compareAndUpdate(
          "size",
          () ->
              entityUpdate.recordChange(
                  "size",
                  entityUpdate.getOriginal().getSize(),
                  entityUpdate.getUpdated().getSize()));
      entityUpdate.compareAndUpdate(
          "checksum",
          () ->
              entityUpdate.recordChange(
                  "checksum",
                  entityUpdate.getOriginal().getChecksum(),
                  entityUpdate.getUpdated().getChecksum()));
      entityUpdate.compareAndUpdate(
          "webViewLink",
          () ->
              entityUpdate.recordChange(
                  "webViewLink",
                  entityUpdate.getOriginal().getWebViewLink(),
                  entityUpdate.getUpdated().getWebViewLink()));
      entityUpdate.compareAndUpdate(
          "downloadLink",
          () ->
              entityUpdate.recordChange(
                  "downloadLink",
                  entityUpdate.getOriginal().getDownloadLink(),
                  entityUpdate.getUpdated().getDownloadLink()));
      entityUpdate.compareAndUpdate(
          "isShared",
          () ->
              entityUpdate.recordChange(
                  "isShared",
                  entityUpdate.getOriginal().getIsShared(),
                  entityUpdate.getUpdated().getIsShared()));
      entityUpdate.compareAndUpdate(
          "fileVersion",
          () ->
              entityUpdate.recordChange(
                  "fileVersion",
                  entityUpdate.getOriginal().getFileVersion(),
                  entityUpdate.getUpdated().getFileVersion()));
      entityUpdate.compareAndUpdate(
          "columns",
          () ->
              columnUpdate.updateColumns(
                  COLUMN_FIELD,
                  entityUpdate.getOriginal().getColumns(),
                  entityUpdate.getUpdated().getColumns(),
                  EntityUtil.columnMatch));
    }

    private final EntityUpdater<File> entityUpdate;

    public EntityUpdater<File> mutation() {
      return entityUpdate;
    }

    private final EntityColumnUpdater<File> columnUpdate;
  }

  private final EntityPolicyContext<File> entityContext;

  @Override
  public final EntityPolicyContext<File> context() {
    return entityContext;
  }
}

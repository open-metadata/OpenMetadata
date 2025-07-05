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
import static org.openmetadata.service.Entity.DIRECTORY;
import static org.openmetadata.service.Entity.FILE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FileType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
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
    file.setFullyQualifiedName(
        FullyQualifiedName.add(file.getDirectory().getFullyQualifiedName(), file.getName()));
  }

  @Override
  public void prepare(File file, boolean update) {
    // Validate service
    DriveService driveService = Entity.getEntity(file.getService(), "", Include.NON_DELETED);
    file.setService(driveService.getEntityReference());
    file.setServiceType(driveService.getServiceType());

    // Validate parent directory
    Directory directory = Entity.getEntity(file.getDirectory(), "", Include.NON_DELETED);
    file.setDirectory(directory.getEntityReference());
  }

  @Override
  public void storeEntity(File file, boolean update) {
    // Store service relationship
    EntityReference service = file.getService();
    addRelationship(service.getId(), file.getId(), service.getType(), FILE, Relationship.CONTAINS);

    // Store directory relationship
    EntityReference directory = file.getDirectory();
    addRelationship(directory.getId(), file.getId(), DIRECTORY, FILE, Relationship.CONTAINS);
  }

  @Override
  public void storeRelationships(File file) {
    // No additional relationships to store
  }

  @Override
  public void setInheritedFields(File file, EntityUtil.Fields fields) {
    // Inherit domain from directory if not set
    if (file.getDomain() == null) {
      Directory directory = Entity.getEntity(file.getDirectory(), "domain", Include.NON_DELETED);
      file.withDomain(directory.getDomain());
    }
  }

  @Override
  public void clearFields(File file, EntityUtil.Fields fields) {
    file.withUsageSummary(fields.contains("usageSummary") ? file.getUsageSummary() : null);
  }

  @Override
  public void setFields(File file, EntityUtil.Fields fields) {
    file.withService(getContainer(file.getId()));
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
    return getFromEntityRef(file.getId(), Relationship.CONTAINS, DIRECTORY, true);
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    File file = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new FileCsv(file, user).exportCsv(listOf(file));
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
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
              new CsvHeader().withName("extension"),
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
          .withExtension(csvRecord.get(6))
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
          .withDomain(getEntityReference(printer, csvRecord, 14, Entity.DOMAIN))
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
      addField(recordList, entity.getDirectory().getFullyQualifiedName());
      addField(recordList, entity.getFileType().toString());
      addField(recordList, entity.getMimeType());
      addField(recordList, entity.getExtension() != null ? entity.getExtension().toString() : "");
      addField(recordList, entity.getPath());
      addField(recordList, entity.getSize() != null ? entity.getSize().toString() : "");
      addField(recordList, entity.getChecksum());
      addField(recordList, entity.getIsShared() != null ? entity.getIsShared().toString() : "");
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
                  .map(ref -> ref.getFullyQualifiedName())
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

  public class FileUpdater extends EntityUpdater {
    public FileUpdater(File original, File updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("fileType", original.getFileType(), updated.getFileType());
      recordChange("mimeType", original.getMimeType(), updated.getMimeType());
      recordChange("extension", original.getExtension(), updated.getExtension());
      recordChange("path", original.getPath(), updated.getPath());
      recordChange("driveFileId", original.getDriveFileId(), updated.getDriveFileId());
      recordChange("size", original.getSize(), updated.getSize());
      recordChange("checksum", original.getChecksum(), updated.getChecksum());
      recordChange("webViewLink", original.getWebViewLink(), updated.getWebViewLink());
      recordChange("downloadLink", original.getDownloadLink(), updated.getDownloadLink());
      recordChange("isShared", original.getIsShared(), updated.getIsShared());
      recordChange("fileVersion", original.getFileVersion(), updated.getFileVersion());
    }
  }
}

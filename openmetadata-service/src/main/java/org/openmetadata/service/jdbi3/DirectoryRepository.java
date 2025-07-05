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
import static org.openmetadata.service.Entity.SPREADSHEET;

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
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.drives.DirectoryResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DirectoryRepository extends EntityRepository<Directory> {
  public DirectoryRepository() {
    super(
        DirectoryResource.COLLECTION_PATH,
        Entity.DIRECTORY,
        Directory.class,
        Entity.getCollectionDAO().directoryDAO(),
        "",
        "");
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(Directory directory) {
    if (directory.getParent() != null) {
      // Nested directory - build FQN from parent
      Directory parent = Entity.getEntity(directory.getParent(), "", Include.NON_DELETED);
      directory.setFullyQualifiedName(
          FullyQualifiedName.add(parent.getFullyQualifiedName(), directory.getName()));
    } else {
      // Root directory - build FQN from service
      DriveService service = Entity.getEntity(directory.getService(), "", Include.NON_DELETED);
      directory.setFullyQualifiedName(
          FullyQualifiedName.add(service.getFullyQualifiedName(), directory.getName()));
    }
  }

  @Override
  public void prepare(Directory directory, boolean update) {
    // Validate service
    DriveService driveService = Entity.getEntity(directory.getService(), "", Include.NON_DELETED);
    directory.setService(driveService.getEntityReference());
    directory.setServiceType(driveService.getServiceType());

    // Validate parent directory if present
    if (directory.getParent() != null) {
      Directory parentDir = Entity.getEntity(directory.getParent(), "", Include.NON_DELETED);
      directory.setParent(parentDir.getEntityReference());

      // Ensure parent belongs to the same service
      if (!parentDir.getService().getId().equals(driveService.getId())) {
        throw new IllegalArgumentException(
            String.format(
                "Parent directory %s does not belong to service %s",
                parentDir.getFullyQualifiedName(), driveService.getFullyQualifiedName()));
      }
    }
  }

  @Override
  public void storeEntity(Directory directory, boolean update) {
    // Store the entity
    store(directory, update);

    // Store service relationship
    EntityReference service = directory.getService();
    addRelationship(
        service.getId(), directory.getId(), service.getType(), DIRECTORY, Relationship.CONTAINS);

    // Store parent-child relationship if parent exists
    if (directory.getParent() != null) {
      EntityReference parent = directory.getParent();
      addRelationship(
          parent.getId(), directory.getId(), DIRECTORY, DIRECTORY, Relationship.CONTAINS);
    }
  }

  @Override
  public void storeRelationships(Directory directory) {
    // No additional relationships to store
  }

  @Override
  public void setInheritedFields(Directory directory, EntityUtil.Fields fields) {
    // Inherit domain from parent or service if needed
    if (directory.getDomain() == null) {
      if (directory.getParent() != null) {
        Directory parent = Entity.getEntity(directory.getParent(), "domain", Include.NON_DELETED);
        directory.withDomain(parent.getDomain());
      } else {
        DriveService service =
            Entity.getEntity(directory.getService(), "domain", Include.NON_DELETED);
        directory.withDomain(service.getDomain());
      }
    }
  }

  @Override
  public void clearFields(Directory directory, EntityUtil.Fields fields) {
    directory.withUsageSummary(
        fields.contains("usageSummary") ? directory.getUsageSummary() : null);
  }

  @Override
  public void setFields(Directory directory, EntityUtil.Fields fields) {
    directory.withService(getService(directory));
    directory.withParent(getParentDirectory(directory));
    directory.withChildren(fields.contains("children") ? getChildrenRefs(directory) : null);
  }

  @Override
  public void restorePatchAttributes(Directory original, Directory updated) {
    // Patch can't change service or parent
    updated.withService(original.getService()).withParent(original.getParent());
  }

  @Override
  public EntityRepository<Directory>.EntityUpdater getUpdater(
      Directory original, Directory updated, Operation operation) {
    return new DirectoryUpdater(original, updated, operation);
  }

  private EntityReference getParentDirectory(Directory directory) {
    return getFromEntityRef(directory.getId(), Relationship.CONTAINS, DIRECTORY, false);
  }

  private EntityReference getService(Directory directory) {
    return getFromEntityRef(directory.getId(), Relationship.CONTAINS, Entity.DRIVE_SERVICE, true);
  }

  private List<EntityReference> getChildrenRefs(Directory directory) {
    List<EntityReference> children = new ArrayList<>();

    // Get subdirectories
    List<CollectionDAO.EntityRelationshipRecord> subDirs =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findFrom(directory.getId(), DIRECTORY, Relationship.CONTAINS.ordinal(), DIRECTORY);
    for (CollectionDAO.EntityRelationshipRecord rel : subDirs) {
      children.add(Entity.getEntityReferenceById(DIRECTORY, rel.getId(), Include.NON_DELETED));
    }

    // Get files
    List<CollectionDAO.EntityRelationshipRecord> files =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findFrom(directory.getId(), DIRECTORY, Relationship.CONTAINS.ordinal(), FILE);
    for (CollectionDAO.EntityRelationshipRecord rel : files) {
      children.add(Entity.getEntityReferenceById(FILE, rel.getId(), Include.NON_DELETED));
    }

    // Get spreadsheets
    List<CollectionDAO.EntityRelationshipRecord> spreadsheets =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findFrom(directory.getId(), DIRECTORY, Relationship.CONTAINS.ordinal(), SPREADSHEET);
    for (CollectionDAO.EntityRelationshipRecord rel : spreadsheets) {
      children.add(Entity.getEntityReferenceById(SPREADSHEET, rel.getId(), Include.NON_DELETED));
    }

    return children;
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    Directory directory = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new DirectoryCsv(directory, user, recursive).exportCsv(List.of(directory));
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    Directory directory = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new DirectoryCsv(directory, user, recursive).importCsv(csv, dryRun);
  }

  public static class DirectoryCsv extends EntityCsv<Directory> {
    public static final List<CsvHeader> HEADERS;
    public static final CsvDocumentation DOCUMENTATION;

    static {
      HEADERS =
          listOf(
              new CsvHeader().withName("name").withRequired(true),
              new CsvHeader().withName("displayName"),
              new CsvHeader().withName("description"),
              new CsvHeader().withName("parent"),
              new CsvHeader().withName("directoryType"),
              new CsvHeader().withName("path"),
              new CsvHeader().withName("isShared"),
              new CsvHeader().withName("owners"),
              new CsvHeader().withName("tags"),
              new CsvHeader().withName("glossaryTerms"),
              new CsvHeader().withName("domain"),
              new CsvHeader().withName("dataProducts"),
              new CsvHeader().withName("experts"),
              new CsvHeader().withName("reviewers"));

      DOCUMENTATION = new CsvDocumentation().withHeaders(HEADERS).withSummary("Directory");
    }

    private final Directory directory;
    private final boolean recursive;

    DirectoryCsv(Directory directory, String user, boolean recursive) {
      super(DIRECTORY, HEADERS, user);
      this.directory = directory;
      this.recursive = recursive;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);

      // For subdirectories, the FQN includes parent path
      String directoryName = csvRecord.get(0);
      String parentFqn = csvRecord.get(3); // parent field
      String directoryFqn;

      if (nullOrEmpty(parentFqn)) {
        directoryFqn =
            FullyQualifiedName.add(directory.getService().getFullyQualifiedName(), directoryName);
      } else {
        directoryFqn = FullyQualifiedName.add(parentFqn, directoryName);
      }

      Directory newDirectory;
      try {
        newDirectory = Entity.getEntityByName(DIRECTORY, directoryFqn, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException ex) {
        LOG.warn("Directory not found: {}, it will be created with Import.", directoryFqn);
        newDirectory =
            new Directory()
                .withService(directory.getService())
                .withName(directoryName)
                .withFullyQualifiedName(directoryFqn);

        if (!nullOrEmpty(parentFqn)) {
          EntityReference parentRef = getEntityReference(printer, csvRecord, 3, DIRECTORY);
          newDirectory.withParent(parentRef);
        }
      }

      // Update directory fields from CSV
      newDirectory
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withPath(csvRecord.get(5))
          .withIsShared(getBoolean(printer, csvRecord, 6))
          .withOwners(getOwners(printer, csvRecord, 7))
          .withTags(
              getTagLabels(
                  printer,
                  csvRecord,
                  List.of(
                      Pair.of(8, TagLabel.TagSource.CLASSIFICATION),
                      Pair.of(9, TagLabel.TagSource.GLOSSARY))))
          .withDomain(getEntityReference(printer, csvRecord, 10, Entity.DOMAIN))
          .withDataProducts(getDataProducts(printer, csvRecord, 11));

      if (processRecord) {
        createEntity(printer, csvRecord, newDirectory, DIRECTORY);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Directory entity) {
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addField(
          recordList, entity.getParent() != null ? entity.getParent().getFullyQualifiedName() : "");
      addField(
          recordList,
          entity.getDirectoryType() != null ? entity.getDirectoryType().toString() : "");
      addField(recordList, entity.getPath());
      addField(recordList, entity.getIsShared());
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

  public class DirectoryUpdater extends EntityUpdater {
    public DirectoryUpdater(Directory original, Directory updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateFromRelationship(
          "parent",
          DIRECTORY,
          original.getParent(),
          updated.getParent(),
          Relationship.CONTAINS,
          DIRECTORY,
          original.getId());
      recordChange("directoryType", original.getDirectoryType(), updated.getDirectoryType());
      recordChange("path", original.getPath(), updated.getPath());
      recordChange("driveId", original.getDriveId(), updated.getDriveId());
      recordChange("isShared", original.getIsShared(), updated.getIsShared());
      recordChange("numberOfFiles", original.getNumberOfFiles(), updated.getNumberOfFiles());
      recordChange(
          "numberOfSubDirectories",
          original.getNumberOfSubDirectories(),
          updated.getNumberOfSubDirectories());
      recordChange("totalSize", original.getTotalSize(), updated.getTotalSize());
    }
  }
}

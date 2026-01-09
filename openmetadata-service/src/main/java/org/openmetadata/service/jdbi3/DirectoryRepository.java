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
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.entity.data.Directory;
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
  }

  @Override
  public void storeRelationships(Directory directory) {
    // Add relationship from service to directory
    addRelationship(
        directory.getService().getId(),
        directory.getId(),
        directory.getService().getType(),
        DIRECTORY,
        Relationship.CONTAINS);

    // Add relationship from parent directory to this directory if parent exists
    if (directory.getParent() != null) {
      addRelationship(
          directory.getParent().getId(),
          directory.getId(),
          DIRECTORY,
          DIRECTORY,
          Relationship.CONTAINS);
    }
  }

  @Override
  public void setInheritedFields(Directory directory, EntityUtil.Fields fields) {
    // Inherit domain from parent or service if needed
    if (nullOrEmpty(directory.getDomains())) {
      if (directory.getParent() != null) {
        Directory parent = Entity.getEntity(directory.getParent(), FIELD_DOMAINS, Include.ALL);
        inheritDomains(directory, fields, parent);
      } else {
        DriveService service = Entity.getEntity(directory.getService(), FIELD_DOMAINS, Include.ALL);
        inheritDomains(directory, fields, service);
      }
    }
  }

  @Override
  public void clearFields(Directory directory, EntityUtil.Fields fields) {
    directory.withUsageSummary(
        fields.contains("usageSummary") ? directory.getUsageSummary() : null);
    directory.withNumberOfFiles(
        fields.contains("numberOfFiles") ? directory.getNumberOfFiles() : null);
    directory.withNumberOfSubDirectories(
        fields.contains("numberOfSubDirectories") ? directory.getNumberOfSubDirectories() : null);
  }

  @Override
  public void setFields(Directory directory, EntityUtil.Fields fields) {
    directory.withService(getService(directory));
    directory.withParent(getParentDirectory(directory));

    // Calculate and set directory statistics
    if (fields.contains("children")
        || fields.contains("numberOfFiles")
        || fields.contains("numberOfSubDirectories")
        || fields.contains("totalSize")) {
      List<EntityReference> children = getChildrenRefs(directory);
      directory.withChildren(fields.contains("children") ? children : null);

      // Calculate statistics from children
      if (children != null && !children.isEmpty()) {
        int fileCount = 0;
        int dirCount = 0;
        long totalSize = 0L;

        for (EntityReference child : children) {
          if (FILE.equals(child.getType())) {
            fileCount++;
            // Get file size if available
            try {
              org.openmetadata.schema.entity.data.File file =
                  Entity.getEntity(child, "", Include.NON_DELETED);
              if (file.getSize() != null) {
                totalSize += file.getSize();
              }
            } catch (Exception e) {
              // Ignore if file can't be loaded
            }
          } else if (DIRECTORY.equals(child.getType())) {
            dirCount++;
          } else if (SPREADSHEET.equals(child.getType())) {
            fileCount++; // Count spreadsheets as files
            try {
              org.openmetadata.schema.entity.data.Spreadsheet spreadsheet =
                  Entity.getEntity(child, "", Include.NON_DELETED);
              if (spreadsheet.getSize() != null) {
                totalSize += spreadsheet.getSize();
              }
            } catch (Exception e) {
              // Ignore if spreadsheet can't be loaded
            }
          }
        }

        directory.withNumberOfFiles(fileCount);
        directory.withNumberOfSubDirectories(dirCount);
        // Convert long to Integer, checking for overflow
        directory.withTotalSize(
            totalSize > 0
                ? (totalSize > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) totalSize)
                : null);
      }
    } else {
      directory.withChildren(null);
    }
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

    // Get subdirectories - we stored parent as "from" and child as "to"
    // So to find children, we use findTo with parent as "from"
    List<CollectionDAO.EntityRelationshipRecord> subDirs =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findTo(directory.getId(), DIRECTORY, Relationship.CONTAINS.ordinal(), DIRECTORY);
    LOG.debug(
        "Found {} subdirectory relationships for directory {}", subDirs.size(), directory.getId());
    for (CollectionDAO.EntityRelationshipRecord rel : subDirs) {
      EntityReference ref =
          Entity.getEntityReferenceById(DIRECTORY, rel.getId(), Include.NON_DELETED);
      if (ref != null) {
        children.add(ref);
      }
    }

    // Get files
    List<CollectionDAO.EntityRelationshipRecord> files =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findTo(directory.getId(), DIRECTORY, Relationship.CONTAINS.ordinal(), FILE);
    for (CollectionDAO.EntityRelationshipRecord rel : files) {
      EntityReference ref = Entity.getEntityReferenceById(FILE, rel.getId(), Include.NON_DELETED);
      if (ref != null) {
        children.add(ref);
      }
    }

    // Get spreadsheets
    List<CollectionDAO.EntityRelationshipRecord> spreadsheets =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findTo(directory.getId(), DIRECTORY, Relationship.CONTAINS.ordinal(), SPREADSHEET);
    for (CollectionDAO.EntityRelationshipRecord rel : spreadsheets) {
      EntityReference ref =
          Entity.getEntityReferenceById(SPREADSHEET, rel.getId(), Include.NON_DELETED);
      if (ref != null) {
        children.add(ref);
      }
    }

    LOG.debug("Total children found for directory {}: {}", directory.getId(), children.size());
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
              new CsvHeader().withName("domains"),
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

      String directoryName = csvRecord.get(0);
      String parentFqn = csvRecord.get(3);
      String directoryFqn =
          nullOrEmpty(parentFqn)
              ? FullyQualifiedName.add(
                  directory.getService().getFullyQualifiedName(), directoryName)
              : FullyQualifiedName.add(parentFqn, directoryName);

      Directory newDirectory;
      boolean directoryExists;
      try {
        newDirectory = Entity.getEntityByName(DIRECTORY, directoryFqn, "*", Include.NON_DELETED);
        directoryExists = true;
      } catch (EntityNotFoundException ex) {
        newDirectory =
            new Directory()
                .withService(directory.getService())
                .withName(directoryName)
                .withFullyQualifiedName(directoryFqn);
        directoryExists = false;
      }

      // Store create status with null check
      int recordIndex = getRecordIndex(csvRecord);
      if (recordCreateStatusArray != null
          && recordIndex >= 0
          && recordIndex < recordCreateStatusArray.length) {
        recordCreateStatusArray[recordIndex] = !directoryExists;
      }

      List<FieldChange> fieldsAdded = new ArrayList<>();
      List<FieldChange> fieldsUpdated = new ArrayList<>();

      String displayName = csvRecord.get(1);
      String description = csvRecord.get(2);
      String path = csvRecord.get(5);
      Boolean isShared = getBoolean(printer, csvRecord, 6);
      List<EntityReference> owners = getOwners(printer, csvRecord, 7);
      List<TagLabel> tags =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(8, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(9, TagLabel.TagSource.GLOSSARY)));
      List<EntityReference> domains = getDomains(printer, csvRecord, 10);
      List<EntityReference> dataProducts = getDataProducts(printer, csvRecord, 11);
      EntityReference parentRef =
          !nullOrEmpty(parentFqn) ? getEntityReference(printer, csvRecord, 3, DIRECTORY) : null;

      if (!directoryExists) {
        if (!nullOrEmpty(displayName)) {
          fieldsAdded.add(new FieldChange().withName("displayName").withNewValue(displayName));
        }
        if (!nullOrEmpty(description)) {
          fieldsAdded.add(new FieldChange().withName("description").withNewValue(description));
        }
        if (parentRef != null) {
          fieldsAdded.add(
              new FieldChange().withName("parent").withNewValue(JsonUtils.pojoToJson(parentRef)));
        }
        if (!nullOrEmpty(path)) {
          fieldsAdded.add(new FieldChange().withName("path").withNewValue(path));
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
        if (CommonUtil.isChanged(newDirectory.getDisplayName(), displayName)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("displayName")
                  .withOldValue(newDirectory.getDisplayName())
                  .withNewValue(displayName));
        }
        if (CommonUtil.isChanged(newDirectory.getDescription(), description)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("description")
                  .withOldValue(newDirectory.getDescription())
                  .withNewValue(description));
        }
        if (CommonUtil.isChanged(newDirectory.getParent(), parentRef)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("parent")
                  .withOldValue(JsonUtils.pojoToJson(newDirectory.getParent()))
                  .withNewValue(JsonUtils.pojoToJson(parentRef)));
        }
        if (CommonUtil.isChanged(newDirectory.getPath(), path)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("path")
                  .withOldValue(newDirectory.getPath())
                  .withNewValue(path));
        }
        if (isShared != null && CommonUtil.isChanged(newDirectory.getIsShared(), isShared)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("isShared")
                  .withOldValue(newDirectory.getIsShared())
                  .withNewValue(isShared));
        }
        if (CommonUtil.isChanged(newDirectory.getOwners(), owners)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("owners")
                  .withOldValue(JsonUtils.pojoToJson(newDirectory.getOwners()))
                  .withNewValue(JsonUtils.pojoToJson(owners)));
        }
        if (CommonUtil.isChanged(newDirectory.getTags(), tags)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("tags")
                  .withOldValue(JsonUtils.pojoToJson(newDirectory.getTags()))
                  .withNewValue(JsonUtils.pojoToJson(tags)));
        }
        if (CommonUtil.isChanged(newDirectory.getDomains(), domains)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("domains")
                  .withOldValue(JsonUtils.pojoToJson(newDirectory.getDomains()))
                  .withNewValue(JsonUtils.pojoToJson(domains)));
        }
        if (CommonUtil.isChanged(newDirectory.getDataProducts(), dataProducts)) {
          fieldsUpdated.add(
              new FieldChange()
                  .withName("dataProducts")
                  .withOldValue(JsonUtils.pojoToJson(newDirectory.getDataProducts()))
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

      newDirectory
          .withParent(parentRef)
          .withDisplayName(displayName)
          .withDescription(description)
          .withPath(path)
          .withIsShared(isShared)
          .withOwners(owners)
          .withTags(tags)
          .withDomains(domains)
          .withDataProducts(dataProducts);

      if (processRecord) {
        createEntityWithChangeDescription(printer, csvRecord, newDirectory, DIRECTORY);
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

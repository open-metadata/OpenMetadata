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
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_PARENT;
import static org.openmetadata.service.Entity.FILE;
import static org.openmetadata.service.Entity.SPREADSHEET;
import static org.openmetadata.service.Entity.getEntityReferenceById;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DirectoryRepository extends EntityRepository<Directory> {
  private static final String NUMBER_OF_FILES = "numberOfFiles";
  private static final String NUMBER_OF_SUB_DIRECTORIES = "numberOfSubDirectories";
  private static final String TOTAL_SIZE = "totalSize";

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
  public void storeEntities(List<Directory> directories) {
    List<String> fqns = new ArrayList<>(directories.size());
    List<String> jsons = new ArrayList<>(directories.size());

    for (Directory directory : directories) {
      fqns.add(directory.getFullyQualifiedName());
      jsons.add(serializeForStorage(directory));
    }

    dao.insertMany(dao.getTableName(), dao.getNameHashColumn(), fqns, jsons);
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
  public void setFields(
      Directory directory, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
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
  public void setFieldsInBulk(EntityUtil.Fields fields, List<Directory> entities) {
    if (nullOrEmpty(entities)) {
      return;
    }
    fetchAndSetDefaultService(entities);
    fetchAndSetParents(entities, fields);
    fetchAndSetStatistics(entities, fields);
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    for (Directory entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetDefaultService(List<Directory> directories) {
    Map<UUID, EntityReference> serviceMap = batchFetchFromByType(directories, Entity.DRIVE_SERVICE);
    directories.forEach(directory -> directory.withService(serviceMap.get(directory.getId())));
  }

  private void fetchAndSetParents(List<Directory> directories, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_PARENT)) {
      return;
    }
    Map<UUID, EntityReference> parentMap = batchFetchFromByType(directories, DIRECTORY);
    directories.forEach(directory -> directory.withParent(parentMap.get(directory.getId())));
  }

  private Map<UUID, EntityReference> batchFetchFromByType(
      List<Directory> directories, String fromEntityType) {
    Map<UUID, EntityReference> resultMap = new HashMap<>();
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(directories), Relationship.CONTAINS.ordinal());
    Map<UUID, EntityReference> refById = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      if (fromEntityType.equals(record.getFromEntity())) {
        UUID directoryId = UUID.fromString(record.getToId());
        UUID fromId = UUID.fromString(record.getFromId());
        EntityReference ref =
            refById.computeIfAbsent(
                fromId, id -> getEntityReferenceById(fromEntityType, id, Include.NON_DELETED));
        resultMap.put(directoryId, ref);
      }
    }
    return resultMap;
  }

  private void fetchAndSetStatistics(List<Directory> directories, EntityUtil.Fields fields) {
    boolean wantsChildren = fields.contains(FIELD_CHILDREN);
    boolean wantsStats = wantsChildren || wantsAnyStat(fields);
    if (!wantsStats) {
      directories.forEach(directory -> directory.withChildren(null));
      return;
    }
    Map<UUID, List<EntityReference>> childrenMap = batchFetchChildren(directories);
    Map<UUID, Integer> sizeByChildId = batchFetchChildSizes(childrenMap);
    for (Directory directory : directories) {
      List<EntityReference> children = childrenMap.getOrDefault(directory.getId(), List.of());
      directory.withChildren(wantsChildren ? children : null);
      applyStatistics(directory, children, sizeByChildId);
    }
  }

  private boolean wantsAnyStat(EntityUtil.Fields fields) {
    return fields.contains(NUMBER_OF_FILES)
        || fields.contains(NUMBER_OF_SUB_DIRECTORIES)
        || fields.contains(TOTAL_SIZE);
  }

  private void applyStatistics(
      Directory directory, List<EntityReference> children, Map<UUID, Integer> sizeByChildId) {
    if (children.isEmpty()) {
      return;
    }
    int fileCount = 0;
    int dirCount = 0;
    long totalSize = 0L;
    for (EntityReference child : children) {
      if (DIRECTORY.equals(child.getType())) {
        dirCount++;
      } else {
        fileCount++;
        totalSize += sizeByChildId.getOrDefault(child.getId(), 0);
      }
    }
    directory.withNumberOfFiles(fileCount);
    directory.withNumberOfSubDirectories(dirCount);
    directory.withTotalSize(toBoundedSize(totalSize));
  }

  private Integer toBoundedSize(long totalSize) {
    Integer result = null;
    if (totalSize > 0) {
      result = totalSize > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) totalSize;
    }
    return result;
  }

  private Map<UUID, List<EntityReference>> batchFetchChildren(List<Directory> directories) {
    Map<UUID, List<EntityReference>> childrenMap = new HashMap<>();
    directories.forEach(directory -> childrenMap.put(directory.getId(), new ArrayList<>()));
    List<String> parentIds = entityListToStrings(directories);
    addChildRecords(childrenMap, parentIds, DIRECTORY);
    addChildRecords(childrenMap, parentIds, FILE);
    addChildRecords(childrenMap, parentIds, SPREADSHEET);
    return childrenMap;
  }

  private void addChildRecords(
      Map<UUID, List<EntityReference>> childrenMap, List<String> parentIds, String childType) {
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(
                parentIds,
                DIRECTORY,
                childType,
                Relationship.CONTAINS.ordinal(),
                Include.NON_DELETED);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID parentId = UUID.fromString(record.getFromId());
      EntityReference childRef = resolveChildRef(childType, UUID.fromString(record.getToId()));
      if (childRef != null) {
        childrenMap.get(parentId).add(childRef);
      }
    }
  }

  private EntityReference resolveChildRef(String childType, UUID childId) {
    EntityReference childRef = null;
    try {
      childRef = getEntityReferenceById(childType, childId, Include.NON_DELETED);
    } catch (EntityNotFoundException e) {
      // A soft delete flips only the entity row's deleted flag, not the CONTAINS relationship row,
      // so findToBatch(NON_DELETED) still returns the row for a soft-deleted child. Skip it instead
      // of letting the not-found throw abort the whole list response.
      LOG.debug("Skipping soft-deleted {} child {} for directory statistics", childType, childId);
    }
    return childRef;
  }

  private Map<UUID, Integer> batchFetchChildSizes(Map<UUID, List<EntityReference>> childrenMap) {
    List<UUID> fileIds = collectChildIds(childrenMap, FILE);
    List<UUID> spreadsheetIds = collectChildIds(childrenMap, SPREADSHEET);
    Map<UUID, Integer> sizeByChildId = new HashMap<>();
    Entity.getCollectionDAO()
        .fileDAO()
        .findEntitiesByIds(fileIds, Include.NON_DELETED)
        .forEach(file -> putSize(sizeByChildId, file.getId(), file.getSize()));
    Entity.getCollectionDAO()
        .spreadsheetDAO()
        .findEntitiesByIds(spreadsheetIds, Include.NON_DELETED)
        .forEach(sheet -> putSize(sizeByChildId, sheet.getId(), sheet.getSize()));
    return sizeByChildId;
  }

  private void putSize(Map<UUID, Integer> sizeByChildId, UUID id, Integer size) {
    if (size != null) {
      sizeByChildId.put(id, size);
    }
  }

  private List<UUID> collectChildIds(
      Map<UUID, List<EntityReference>> childrenMap, String childType) {
    return childrenMap.values().stream()
        .flatMap(List::stream)
        .filter(ref -> childType.equals(ref.getType()))
        .map(EntityReference::getId)
        .toList();
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
  public boolean supportsBulkImportVersioning() {
    return false;
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    Directory directory = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new DirectoryCsv(directory, user, recursive).exportCsv(List.of(directory), callback);
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
          // Use dependency resolution for parent directory lookup
          EntityReference parentRef = null;
          try {
            Directory parentDirectory =
                getEntityWithDependencyResolution(DIRECTORY, parentFqn, "*", Include.NON_DELETED);
            parentRef = parentDirectory.getEntityReference();
          } catch (EntityNotFoundException parentEx) {
            // Fall back to regular lookup
            parentRef = getEntityReference(printer, csvRecord, 3, DIRECTORY);
          }
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
          .withDomains(getDomains(printer, csvRecord, 10))
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

  public class DirectoryUpdater extends EntityUpdater {
    public DirectoryUpdater(Directory original, Directory updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate("parent", this::run);
      compareAndUpdate(
          "directoryType",
          () ->
              recordChange(
                  "directoryType", original.getDirectoryType(), updated.getDirectoryType()));
      compareAndUpdate("path", () -> recordChange("path", original.getPath(), updated.getPath()));
      compareAndUpdate(
          "isShared",
          () -> recordChange("isShared", original.getIsShared(), updated.getIsShared()));
      compareAndUpdate(
          "numberOfFiles",
          () ->
              recordChange(
                  "numberOfFiles", original.getNumberOfFiles(), updated.getNumberOfFiles()));
      compareAndUpdate(
          "numberOfSubDirectories",
          () ->
              recordChange(
                  "numberOfSubDirectories",
                  original.getNumberOfSubDirectories(),
                  updated.getNumberOfSubDirectories()));
      compareAndUpdate(
          "totalSize",
          () -> recordChange("totalSize", original.getTotalSize(), updated.getTotalSize()));
    }

    private void run() {
      updateFromRelationship(
          "parent",
          DIRECTORY,
          original.getParent(),
          updated.getParent(),
          Relationship.CONTAINS,
          DIRECTORY,
          original.getId());
    }
  }
}

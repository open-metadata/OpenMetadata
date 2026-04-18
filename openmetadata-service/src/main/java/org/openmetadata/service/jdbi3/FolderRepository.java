package org.openmetadata.service.jdbi3;

import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.drive.ContextFileResource;
import org.openmetadata.service.resources.drive.FolderResource;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Folder;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.Repository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository
public class FolderRepository extends EntityRepository<Folder> {
  public static final String FOLDER_ENTITY = "folder";

  public FolderRepository(Jdbi jdbi) {
    super(
        FolderResource.COLLECTION_PATH,
        FOLDER_ENTITY,
        Folder.class,
        jdbi.onDemand(CollectionDAO.class).folderDAO(),
        "",
        "");
    supportsSearch = true;
    // NOTE: SearchIndexFactory registration handled by OpenMetadata core
  }

  @Override
  public void setFields(
      Folder folder, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    folder.setParent(fields.contains("parent") ? getParentFolder(folder) : folder.getParent());
    folder.setChildren(
        fields.contains("children") ? getChildFolders(folder) : folder.getChildren());
  }

  @Override
  public void clearFields(Folder folder, EntityUtil.Fields fields) {
    folder.setParent(fields.contains("parent") ? folder.getParent() : null);
    folder.setChildren(fields.contains("children") ? folder.getChildren() : null);
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<Folder> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }

    if (fields.contains("parent")) {
      var parentMap = batchFetchFromIdsAndRelationSingleRelation(entities, Relationship.CONTAINS);
      entities.forEach(folder -> folder.setParent(parentMap.get(folder.getId())));
    }

    if (fields.contains("children")) {
      var childrenMap = batchFetchToIdsOneToMany(entities, Relationship.CONTAINS, FOLDER_ENTITY);
      entities.forEach(
          folder -> folder.setChildren(childrenMap.getOrDefault(folder.getId(), List.of())));
    }

    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  @Override
  public void setFullyQualifiedName(Folder folder) {
    if (folder.getParent() == null) {
      folder.setFullyQualifiedName(folder.getName());
    } else {
      Folder parentFolder =
          Entity.getEntity(FOLDER_ENTITY, folder.getParent().getId(), "", Include.ALL);
      folder.setFullyQualifiedName(
          FullyQualifiedName.add(parentFolder.getFullyQualifiedName(), folder.getName()));
    }
  }

  @Override
  public void prepare(Folder folder, boolean update) {
    // Resolve parent folder reference if provided
    if (folder.getParent() != null) {
      Folder parent = Entity.getEntity(folder.getParent(), "", Include.NON_DELETED);
      folder.setParent(parent.getEntityReference());
    }
  }

  @Override
  public void storeEntity(Folder folder, boolean update) {
    EntityReference parent = folder.getParent();
    List<EntityReference> children = folder.getChildren();
    folder.withParent(null).withChildren(null);
    store(folder, update);
    folder.withParent(parent).withChildren(children);
  }

  @Override
  public void storeRelationships(Folder folder) {
    if (folder.getParent() != null) {
      addRelationship(
          folder.getParent().getId(),
          folder.getId(),
          FOLDER_ENTITY,
          FOLDER_ENTITY,
          Relationship.CONTAINS);
    }
  }

  @Override
  public EntityUpdater getUpdater(
      Folder original, Folder updated, Operation operation, ChangeSource source) {
    return new FolderUpdater(original, updated, operation);
  }

  private EntityReference getParentFolder(Folder folder) {
    return getFromEntityRef(folder.getId(), Relationship.CONTAINS, FOLDER_ENTITY, false);
  }

  private List<EntityReference> getChildFolders(Folder folder) {
    return findTo(folder.getId(), FOLDER_ENTITY, Relationship.CONTAINS, FOLDER_ENTITY);
  }

  @SuppressWarnings("unchecked")
  public List<Folder> getChildFolderEntities(Folder folder) {
    List<UUID> childIds = getChildFolders(folder).stream().map(EntityReference::getId).toList();
    if (childIds.isEmpty()) {
      return List.of();
    }
    return get(null, childIds, getFields(FolderResource.FIELDS), Include.NON_DELETED).stream()
        .sorted(Comparator.comparing(Folder::getName))
        .toList();
  }

  @SuppressWarnings("unchecked")
  public List<ContextFile> getChildFileEntities(Folder folder) {
    List<UUID> childIds =
        findTo(
                folder.getId(),
                FOLDER_ENTITY,
                Relationship.CONTAINS,
                ContextFileRepository.CONTEXT_FILE_ENTITY)
            .stream()
            .map(EntityReference::getId)
            .toList();
    if (childIds.isEmpty()) {
      return List.of();
    }
    ContextFileRepository fileRepo =
        (ContextFileRepository)
            Entity.getEntityRepository(ContextFileRepository.CONTEXT_FILE_ENTITY);
    return fileRepo
        .get(null, childIds, fileRepo.getFields(ContextFileResource.FIELDS), Include.NON_DELETED)
        .stream()
        .sorted(Comparator.comparing(ContextFile::getName))
        .toList();
  }

  public class FolderUpdater extends EntityUpdater {
    public FolderUpdater(Folder original, Folder updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("icon", original.getIcon(), updated.getIcon());
      recordChange("color", original.getColor(), updated.getColor());
    }
  }
}

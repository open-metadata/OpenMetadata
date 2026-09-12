package org.openmetadata.service.jdbi3;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityCollectionReader;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.drive.ContextFileResource;
import org.openmetadata.service.resources.drive.FolderResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository
public class FolderRepository implements EntityPolicy<Folder> {

  public static final String FOLDER_ENTITY = "folder";

  public FolderRepository(Jdbi jdbi) {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                FolderResource.COLLECTION_PATH,
                FOLDER_ENTITY,
                Folder.class,
                jdbi.onDemand(CollectionDAO.class).folderDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // NOTE: SearchIndexFactory registration handled by OpenMetadata core
  }

  @Override
  public void setFields(
      Folder folder, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    folder.setParent(fields.contains("parent") ? getParentFolder(folder) : folder.getParent());
    folder.setChildren(
        fields.contains("children") ? getChildFolders(folder) : folder.getChildren());
    if (fields.contains("childrenCount")) {
      folder.setChildrenCount(countChildren(folder.getId()));
    }
  }

  @Override
  public void clearFields(Folder folder, EntityUtil.Fields fields) {
    folder.setParent(fields.contains("parent") ? folder.getParent() : null);
    folder.setChildren(fields.contains("children") ? folder.getChildren() : null);
    if (!fields.contains("childrenCount")) {
      folder.setChildrenCount(null);
    }
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<Folder> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    if (fields.contains("parent")) {
      var parentMap = batchReferences().singleIncoming(entities, Relationship.CONTAINS);
      entities.forEach(folder -> folder.setParent(parentMap.get(folder.getId())));
    }
    if (fields.contains("children")) {
      var childrenMap = batchReferences().incoming(entities, Relationship.CONTAINS, FOLDER_ENTITY);
      entities.forEach(
          folder -> folder.setChildren(childrenMap.getOrDefault(folder.getId(), List.of())));
    }
    if (fields.contains("childrenCount")) {
      List<String> ids = entities.stream().map(f -> f.getId().toString()).toList();
      Map<UUID, Integer> countMap =
          context()
              .dependencies()
              .daos()
              .relationshipDAO()
              .countNonDeletedChildFilesBatch(
                  ids,
                  FOLDER_ENTITY,
                  Relationship.CONTAINS.ordinal(),
                  ContextFileRepository.CONTEXT_FILE_ENTITY)
              .stream()
              .collect(
                  Collectors.toMap(
                      CollectionDAO.EntityRelationshipCount::getId,
                      CollectionDAO.EntityRelationshipCount::getCount));
      entities.forEach(folder -> folder.setChildrenCount(countMap.getOrDefault(folder.getId(), 0)));
    }
    fieldLoading().populate(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  private int countChildren(UUID folderId) {
    return context()
        .dependencies()
        .daos()
        .relationshipDAO()
        .countNonDeletedChildFiles(
            folderId,
            FOLDER_ENTITY,
            Relationship.CONTAINS.ordinal(),
            ContextFileRepository.CONTEXT_FILE_ENTITY);
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
    persistence().store(folder, update);
    folder.withParent(parent).withChildren(children);
  }

  @Override
  public void storeRelationships(Folder folder) {
    if (folder.getParent() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  folder.getParent().getId(),
                  folder.getId(),
                  FOLDER_ENTITY,
                  FOLDER_ENTITY,
                  Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public EntityUpdater<Folder> getUpdater(
      Folder original, Folder updated, EntityOperation operation, ChangeSource source) {
    return new FolderUpdater(original, updated, operation).mutation();
  }

  private EntityReference getParentFolder(Folder folder) {
    return relationships().singleFrom(folder.getId(), Relationship.CONTAINS, FOLDER_ENTITY, false);
  }

  private List<EntityReference> getChildFolders(Folder folder) {
    return relationships()
        .to(
            new EntityRelationshipReader.Selection(
                folder.getId(), FOLDER_ENTITY, Relationship.CONTAINS, FOLDER_ENTITY),
            Include.NON_DELETED);
  }

  @SuppressWarnings("unchecked")
  public List<Folder> getChildFolderEntities(Folder folder) {
    List<UUID> childIds = getChildFolders(folder).stream().map(EntityReference::getId).toList();
    if (childIds.isEmpty()) {
      return List.of();
    }
    return collections()
        .byIds(
            childIds,
            new EntityCollectionReader.Projection(
                null, fieldPolicy().parse(FolderResource.FIELDS), Include.NON_DELETED))
        .stream()
        .sorted(Comparator.comparing(Folder::getName))
        .toList();
  }

  @SuppressWarnings("unchecked")
  public List<ContextFile> getChildFileEntities(Folder folder) {
    List<UUID> childIds =
        relationships()
            .to(
                new EntityRelationshipReader.Selection(
                    folder.getId(),
                    FOLDER_ENTITY,
                    Relationship.CONTAINS,
                    ContextFileRepository.CONTEXT_FILE_ENTITY),
                Include.NON_DELETED)
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
        .collections()
        .byIds(
            childIds,
            new EntityCollectionReader.Projection(
                null,
                fileRepo.fieldPolicy().parse(ContextFileResource.FIELDS),
                Include.NON_DELETED))
        .stream()
        .sorted(Comparator.comparing(ContextFile::getName))
        .toList();
  }

  public class FolderUpdater implements EntitySpecificMutation<Folder> {

    public FolderUpdater(Folder original, Folder updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(EntityUpdater<Folder> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.recordChange(
          "icon", entityUpdate.getOriginal().getIcon(), entityUpdate.getUpdated().getIcon());
      entityUpdate.recordChange(
          "color", entityUpdate.getOriginal().getColor(), entityUpdate.getUpdated().getColor());
    }

    private final EntityUpdater<Folder> entityUpdate;

    public EntityUpdater<Folder> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Folder> entityContext;

  @Override
  public final EntityPolicyContext<Folder> context() {
    return entityContext;
  }
}

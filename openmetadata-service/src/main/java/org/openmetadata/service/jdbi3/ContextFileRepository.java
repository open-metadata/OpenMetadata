package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.jdbi3.FolderRepository.FOLDER_ENTITY;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.isNullOrEmptyChangeDescription;

import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.attachments.AssetServiceFactory;
import org.openmetadata.service.cache.ListCountCache;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityCursor;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;
import org.openmetadata.service.resources.drive.ContextFileResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Repository
public class ContextFileRepository implements EntityPolicy<ContextFile> {

  public static final String CONTEXT_FILE_ENTITY = "contextFile";

  private static final String DUPLICATE_FILE_NAME_MESSAGE =
      "A file named '%s' already exists in this folder.";

  private final AssetRepository assetRepository;

  private final ContextFileContentRepository contentRepository;

  private final CollectionDAO.ContextFileDAO contextFileDAO;

  public ContextFileRepository(Jdbi jdbi) {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                ContextFileResource.COLLECTION_PATH,
                CONTEXT_FILE_ENTITY,
                ContextFile.class,
                jdbi.onDemand(CollectionDAO.class).contextFileDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // NOTE: SearchIndexFactory registration handled by OpenMetadata core
    CollectionDAO dao = jdbi.onDemand(CollectionDAO.class);
    this.assetRepository = new AssetRepository(dao.assetDAO());
    this.contentRepository = new ContextFileContentRepository(jdbi);
    this.contextFileDAO = (CollectionDAO.ContextFileDAO) getDao();
  }

  public AssetRepository getAssetRepository() {
    return assetRepository;
  }

  public ContextFileContentRepository getContentRepository() {
    return contentRepository;
  }

  @Override
  public void setFields(
      ContextFile file, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    file.setFolder(fields.contains("folder") ? getFolder(file) : file.getFolder());
  }

  @Override
  public void clearFields(ContextFile file, EntityUtil.Fields fields) {
    file.setFolder(fields.contains("folder") ? file.getFolder() : null);
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<ContextFile> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    if (fields.contains("folder")) {
      var folderMap = batchReferences().singleIncoming(entities, Relationship.CONTAINS);
      entities.forEach(file -> file.setFolder(folderMap.get(file.getId())));
    }
    fieldLoading().populate(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  @Override
  public void setFullyQualifiedName(ContextFile file) {
    if (file.getFolder() == null) {
      file.setFullyQualifiedName(file.getName());
    } else {
      Folder folder = Entity.getEntity(FOLDER_ENTITY, file.getFolder().getId(), "", Include.ALL);
      file.setFullyQualifiedName(
          FullyQualifiedName.add(folder.getFullyQualifiedName(), file.getName()));
    }
  }

  @Override
  public void prepare(ContextFile file, boolean update) {
    if (file.getFolder() != null) {
      Folder folder = Entity.getEntity(file.getFolder(), "", Include.NON_DELETED);
      file.setFolder(folder.getEntityReference());
    }
  }

  @Override
  public void storeEntity(ContextFile file, boolean update) {
    EntityReference folder = file.getFolder();
    file.withFolder(null);
    persistence().store(file, update);
    file.withFolder(folder);
  }

  @Override
  public void storeEntityWithVersion(ContextFile file, boolean update, Double expectedVersion) {
    EntityReference folder = file.getFolder();
    file.withFolder(null);
    try {
      persistence().store(file, update, expectedVersion);
    } finally {
      file.withFolder(folder);
    }
  }

  @Override
  public void storeRelationships(ContextFile file) {
    if (file.getFolder() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  file.getFolder().getId(),
                  file.getId(),
                  FOLDER_ENTITY,
                  CONTEXT_FILE_ENTITY,
                  Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public void restorePatchAttributes(ContextFile original, ContextFile updated) {
    updated.withFolder(original.getFolder());
  }

  @Override
  public EntityUpdater<ContextFile> getUpdater(
      ContextFile original, ContextFile updated, EntityOperation operation, ChangeSource source) {
    return new ContextFileUpdater(original, updated, operation).mutation();
  }

  private EntityReference getFolder(ContextFile file) {
    return relationships().singleFrom(file.getId(), Relationship.CONTAINS, FOLDER_ENTITY, false);
  }

  public ContextFile moveContextFile(UUID id, EntityReference newFolderRef, String user) {
    ContextFile original =
        Entity.getEntity(CONTEXT_FILE_ENTITY, id, "folder,owners,tags", Include.NON_DELETED);
    ContextFile updated = JsonUtils.deepCopy(original, ContextFile.class);
    EntityReference resolvedFolder = null;
    if (newFolderRef != null && newFolderRef.getId() != null) {
      Folder folder =
          Entity.getEntity(FOLDER_ENTITY, newFolderRef.getId(), "", Include.NON_DELETED);
      resolvedFolder = folder.getEntityReference();
    }
    updated.setFolder(resolvedFolder);
    validateNoDuplicateFileName(original.getName(), resolvedFolder, updated.getId());
    setFullyQualifiedName(updated);
    updated.setUpdatedBy(user);
    updated.setUpdatedAt(System.currentTimeMillis());
    EntityUpdater<ContextFile> updater =
        new ContextFileUpdater(original, updated, EntityOperation.PUT).mutation();
    updater.update();
    emitMoveChangeEvent(original, updated);
    return updated;
  }

  private void emitMoveChangeEvent(ContextFile original, ContextFile updated) {
    if (updated.getChangeDescription() == null
        || isNullOrEmptyChangeDescription(updated.getChangeDescription())) {
      return;
    }
    try {
      ChangeEvent changeEvent =
          new ChangeEvent()
              .withId(UUID.randomUUID())
              .withEventType(EventType.ENTITY_UPDATED)
              .withEntityType(context().schema().entityType())
              .withEntityId(updated.getId())
              .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
              .withUserName(updated.getUpdatedBy())
              .withPreviousVersion(original.getVersion())
              .withCurrentVersion(updated.getVersion())
              .withTimestamp(System.currentTimeMillis())
              .withEntity(updated);
      Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
    } catch (Exception e) {
      LOG.error("Failed to insert change event for context file move", e);
    }
  }

  public class ContextFileUpdater implements EntitySpecificMutation<ContextFile> {

    public ContextFileUpdater(
        ContextFile original, ContextFile updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(EntityUpdater<ContextFile> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.recordChange(
          "fileType",
          entityUpdate.getOriginal().getFileType(),
          entityUpdate.getUpdated().getFileType());
      entityUpdate.recordChange(
          "processingStatus",
          entityUpdate.getOriginal().getProcessingStatus(),
          entityUpdate.getUpdated().getProcessingStatus());
      entityUpdate.recordChange(
          "extractedText",
          entityUpdate.getOriginal().getExtractedText(),
          entityUpdate.getUpdated().getExtractedText());
      entityUpdate.recordChange(
          "pageCount",
          entityUpdate.getOriginal().getPageCount(),
          entityUpdate.getUpdated().getPageCount());
      updateFolder();
    }

    private void updateFolder() {
      EntityReference oldFolder = entityUpdate.getOriginal().getFolder();
      EntityReference newFolder = entityUpdate.getUpdated().getFolder();
      if (!entityUpdate.recordChange("folder", oldFolder, newFolder, true, entityReferenceMatch)) {
        return;
      }
      if (oldFolder != null) {
        relationshipWrites()
            .delete(
                new EntityRelationshipWriter.Edge(
                    oldFolder.getId(),
                    entityUpdate.getUpdated().getId(),
                    FOLDER_ENTITY,
                    CONTEXT_FILE_ENTITY,
                    Relationship.CONTAINS));
      }
      if (newFolder != null) {
        relationshipWrites()
            .add(
                new EntityRelationshipWriter.Edge(
                    newFolder.getId(),
                    entityUpdate.getUpdated().getId(),
                    FOLDER_ENTITY,
                    CONTEXT_FILE_ENTITY,
                    Relationship.CONTAINS),
                EntityRelationshipWriter.Value.EMPTY,
                false);
      }
    }

    private final EntityUpdater<ContextFile> entityUpdate;

    public EntityUpdater<ContextFile> mutation() {
      return entityUpdate;
    }
  }

  @Override
  public void entitySpecificCleanup(ContextFile entityInterface) {
    List<ContextFileContent> contents =
        new ArrayList<>(contentRepository.listByContextFileId(entityInterface.getId()));
    if (contents.isEmpty()) {
      UUID headContentId = parseUuid(entityInterface.getHeadContentId());
      if (headContentId != null) {
        try {
          ContextFileContent headContent = contentRepository.getById(headContentId);
          if (headContent != null) {
            contents.add(headContent);
          }
        } catch (Exception ignored) {
          // Fall through to legacy asset cleanup when the content row was never persisted.
        }
      }
    }
    for (ContextFileContent content : contents) {
      deleteContentSnapshot(content);
    }
    if (contents.isEmpty()
        && entityInterface.getAssetId() != null
        && !entityInterface.getAssetId().isEmpty()) {
      deleteAsset(entityInterface.getAssetId());
    }
  }

  public ContextFileContent getContentById(String id) {
    UUID contentId = parseUuid(id);
    return contentId == null ? null : contentRepository.getById(contentId);
  }

  public void validateNoDuplicateFileName(String fileName, EntityReference folder, UUID excludeId) {
    if (fileName == null || fileName.isBlank()) {
      return;
    }
    String folderId = folder == null ? null : folder.getId().toString();
    String excludedId = excludeId == null ? null : excludeId.toString();
    int count =
        contextFileDAO.countByFileNameInFolder(
            fileName.trim(), folderId, excludedId, Relationship.CONTAINS.ordinal());
    if (count > 0) {
      throw new BadRequestException(String.format(DUPLICATE_FILE_NAME_MESSAGE, fileName.trim()));
    }
  }

  public ResultList<ContextFile> listByUpdatedAt(
      UriInfo uriInfo,
      EntityUtil.Fields fields,
      ListFilter filter,
      int limitParam,
      String before,
      String after,
      OrderBy orderBy) {
    int total =
        ListCountCache.getOrCompute(
            context().schema().entityType(),
            filter,
            () -> context().schema().dao().listCount(filter));
    List<ContextFile> entities = new ArrayList<>();
    if (limitParam <= 0) {
      return new ResultList<>(entities, null, null, total);
    }
    if (before != null && !before.isEmpty()) {
      UpdatedAtCursor cursor = parseUpdatedAtCursor(before);
      List<String> jsons =
          orderBy == OrderBy.ASC
              ? contextFileDAO.listBeforeByUpdatedAtAsc(
                  filter.getQueryParams(),
                  filter.getCondition(),
                  limitParam + 1,
                  cursor.updatedAt(),
                  cursor.id())
              : contextFileDAO.listBeforeByUpdatedAtDesc(
                  filter.getQueryParams(),
                  filter.getCondition(),
                  limitParam + 1,
                  cursor.updatedAt(),
                  cursor.id());
      entities = hydrateList(jsons, fields, uriInfo, filter);
      String beforeCursor = null;
      String afterCursor = null;
      if (entities.size() > limitParam) {
        entities.remove(0);
        beforeCursor = updatedAtCursorValue(entities.get(0));
      }
      if (!entities.isEmpty()) {
        afterCursor = updatedAtCursorValue(entities.get(entities.size() - 1));
      }
      return new ResultList<>(entities, beforeCursor, afterCursor, total);
    }
    List<String> jsons;
    if (after == null || after.isEmpty()) {
      jsons =
          orderBy == OrderBy.ASC
              ? contextFileDAO.listByUpdatedAtAsc(
                  filter.getQueryParams(), filter.getCondition(), limitParam + 1)
              : contextFileDAO.listByUpdatedAtDesc(
                  filter.getQueryParams(), filter.getCondition(), limitParam + 1);
    } else {
      UpdatedAtCursor cursor = parseUpdatedAtCursor(after);
      jsons =
          orderBy == OrderBy.ASC
              ? contextFileDAO.listAfterByUpdatedAtAsc(
                  filter.getQueryParams(),
                  filter.getCondition(),
                  limitParam + 1,
                  cursor.updatedAt(),
                  cursor.id())
              : contextFileDAO.listAfterByUpdatedAtDesc(
                  filter.getQueryParams(),
                  filter.getCondition(),
                  limitParam + 1,
                  cursor.updatedAt(),
                  cursor.id());
    }
    entities = hydrateList(jsons, fields, uriInfo, filter);
    String beforeCursor =
        after == null || after.isEmpty() || entities.isEmpty()
            ? null
            : updatedAtCursorValue(entities.get(0));
    String afterCursor = null;
    if (entities.size() > limitParam) {
      entities.remove(limitParam);
      afterCursor = updatedAtCursorValue(entities.get(limitParam - 1));
    }
    return new ResultList<>(entities, beforeCursor, afterCursor, total);
  }

  private List<ContextFile> hydrateList(
      List<String> jsons, EntityUtil.Fields fields, UriInfo uriInfo, ListFilter filter) {
    List<ContextFile> entities = JsonUtils.readObjects(jsons, ContextFile.class);
    setFieldsInBulk(fields, entities, filter);
    entities.forEach(entity -> withHref(uriInfo, entity));
    return entities;
  }

  private UpdatedAtCursor parseUpdatedAtCursor(String cursor) {
    Map<String, String> cursorMap = EntityCursor.parse(RestUtil.decodeCursor(cursor));
    String updatedAt = cursorMap.get("updatedAt");
    String id = cursorMap.get("id");
    if (updatedAt == null || updatedAt.isBlank() || id == null || id.isBlank()) {
      throw new BadRequestException("Invalid cursor for orderBy pagination");
    }
    try {
      return new UpdatedAtCursor(Long.parseLong(updatedAt), id);
    } catch (NumberFormatException e) {
      throw new BadRequestException("Invalid cursor for orderBy pagination");
    }
  }

  private String updatedAtCursorValue(ContextFile file) {
    return JsonUtils.pojoToJson(
        Map.of("updatedAt", String.valueOf(file.getUpdatedAt()), "id", file.getId().toString()));
  }

  private record UpdatedAtCursor(long updatedAt, String id) {}

  private UUID parseUuid(String value) {
    if (value == null || value.isEmpty()) {
      return null;
    }
    try {
      return UUID.fromString(value);
    } catch (IllegalArgumentException ex) {
      return null;
    }
  }

  private void deleteContentSnapshot(ContextFileContent content) {
    if (content.getAssetId() != null && !content.getAssetId().isEmpty()) {
      deleteAsset(content.getAssetId());
    }
    contentRepository.deletes().byId(ADMIN_USER_NAME, content.getId(), false, true);
  }

  private void deleteAsset(String assetId) {
    AssetService assetService = AssetServiceFactory.getService();
    Asset asset = null;
    try {
      asset = assetRepository.getById(assetId);
    } catch (Exception ignored) {
      // If the asset metadata is already gone, continue deleting any remaining references.
    }
    if (asset != null && assetService != null) {
      try {
        assetService
            .delete(asset)
            .thenRun(() -> assetRepository.delete(assetId))
            .exceptionally(
                ex -> {
                  LOG.error(
                      "Failed to delete asset {} from storage, metadata retained", assetId, ex);
                  return null;
                });
      } catch (RejectedExecutionException e) {
        LOG.warn(
            "Object delete queue is full for asset {}. Storage cleanup deferred and metadata retained",
            assetId,
            e);
      }
    } else {
      assetRepository.delete(assetId);
    }
  }

  private final EntityPolicyContext<ContextFile> entityContext;

  @Override
  public final EntityPolicyContext<ContextFile> context() {
    return entityContext;
  }
}

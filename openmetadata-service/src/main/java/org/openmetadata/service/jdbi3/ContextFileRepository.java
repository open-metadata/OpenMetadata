package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.jdbi3.FolderRepository.FOLDER_ENTITY;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.attachments.AssetServiceFactory;
import org.openmetadata.service.resources.drive.ContextFileResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository
public class ContextFileRepository extends EntityRepository<ContextFile> {
  public static final String CONTEXT_FILE_ENTITY = "contextFile";
  private final AssetRepository assetRepository;
  private final ContextFileContentRepository contentRepository;

  public ContextFileRepository(Jdbi jdbi) {
    super(
        ContextFileResource.COLLECTION_PATH,
        CONTEXT_FILE_ENTITY,
        ContextFile.class,
        jdbi.onDemand(CollectionDAO.class).contextFileDAO(),
        "",
        "");
    supportsSearch = true;
    // NOTE: SearchIndexFactory registration handled by OpenMetadata core
    CollectionDAO dao = jdbi.onDemand(CollectionDAO.class);
    this.assetRepository = new AssetRepository(dao.assetDAO());
    this.contentRepository = new ContextFileContentRepository(jdbi);
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
      var folderMap = batchFetchFromIdsAndRelationSingleRelation(entities, Relationship.CONTAINS);
      entities.forEach(file -> file.setFolder(folderMap.get(file.getId())));
    }

    fetchAndSetFields(entities, fields);
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
    store(file, update);
    file.withFolder(folder);
  }

  @Override
  public void storeRelationships(ContextFile file) {
    if (file.getFolder() != null) {
      addRelationship(
          file.getFolder().getId(),
          file.getId(),
          FOLDER_ENTITY,
          CONTEXT_FILE_ENTITY,
          Relationship.CONTAINS);
    }
  }

  @Override
  public void restorePatchAttributes(ContextFile original, ContextFile updated) {
    updated.withFolder(original.getFolder());
  }

  @Override
  public EntityUpdater getUpdater(
      ContextFile original, ContextFile updated, Operation operation, ChangeSource source) {
    return new ContextFileUpdater(original, updated, operation);
  }

  private EntityReference getFolder(ContextFile file) {
    return getFromEntityRef(file.getId(), Relationship.CONTAINS, FOLDER_ENTITY, false);
  }

  public class ContextFileUpdater extends EntityUpdater {
    public ContextFileUpdater(ContextFile original, ContextFile updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("fileType", original.getFileType(), updated.getFileType());
      recordChange(
          "processingStatus", original.getProcessingStatus(), updated.getProcessingStatus());
      recordChange("extractedText", original.getExtractedText(), updated.getExtractedText());
      recordChange("pageCount", original.getPageCount(), updated.getPageCount());
    }
  }

  @Override
  protected void entitySpecificCleanup(ContextFile entityInterface) {
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

    contentRepository.delete(ADMIN_USER_NAME, content.getId(), false, true);
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
}

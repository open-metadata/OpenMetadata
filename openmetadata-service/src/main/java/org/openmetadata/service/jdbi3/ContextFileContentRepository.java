package org.openmetadata.service.jdbi3;

import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository
public class ContextFileContentRepository implements EntityPolicy<ContextFileContent> {

  public static final String CONTEXT_FILE_CONTENT_ENTITY = "contextFileContent";

  public ContextFileContentRepository(Jdbi jdbi) {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                null,
                CONTEXT_FILE_CONTENT_ENTITY,
                ContextFileContent.class,
                jdbi.onDemand(CollectionDAO.class).contextFileContentDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
  }

  @Override
  public void setFields(
      ContextFileContent entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    // No relationship-backed fields for now.
  }

  @Override
  public void clearFields(ContextFileContent entity, EntityUtil.Fields fields) {
    // No relationship-backed fields for now.
  }

  @Override
  public void setFullyQualifiedName(ContextFileContent entity) {
    if (entity.getContextFile() == null
        || entity.getContextFile().getFullyQualifiedName() == null
        || entity.getContextFile().getFullyQualifiedName().isEmpty()) {
      entity.setFullyQualifiedName(entity.getName());
      return;
    }
    entity.setFullyQualifiedName(
        FullyQualifiedName.add(entity.getContextFile().getFullyQualifiedName(), entity.getName()));
  }

  @Override
  public void prepare(ContextFileContent entity, boolean update) {
    if (entity.getContextFile() != null) {
      ContextFile file =
          Entity.getEntity(
              ContextFileRepository.CONTEXT_FILE_ENTITY,
              entity.getContextFile().getId(),
              "",
              Include.ALL);
      entity.setContextFile(file.getEntityReference());
    }
  }

  @Override
  public void storeEntity(ContextFileContent entity, boolean update) {
    persistence().store(entity, update);
  }

  @Override
  public void storeRelationships(ContextFileContent entity) {
    // No relationship-backed fields for now.
  }

  @Override
  public EntityUpdater<ContextFileContent> getUpdater(
      ContextFileContent original,
      ContextFileContent updated,
      EntityOperation operation,
      ChangeSource source) {
    return new ContextFileContentUpdater(original, updated, operation).mutation();
  }

  public ContextFileContent getById(UUID id) {
    return reads()
        .byId(
            id,
            new EntityReadService.Query(
                null,
                fieldPolicy().parse(""),
                RelationIncludes.fromInclude(Include.NON_DELETED),
                false));
  }

  public java.util.List<ContextFileContent> listByContextFileId(UUID contextFileId) {
    return JsonUtils.readObjects(
        ((CollectionDAO.ContextFileContentDAO) context().schema().dao())
            .listByContextFileId(contextFileId.toString()),
        ContextFileContent.class);
  }

  public class ContextFileContentUpdater implements EntitySpecificMutation<ContextFileContent> {

    public ContextFileContentUpdater(
        ContextFileContent original, ContextFileContent updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(
        EntityUpdater<ContextFileContent> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.recordChange(
          "assetId",
          entityUpdate.getOriginal().getAssetId(),
          entityUpdate.getUpdated().getAssetId());
      entityUpdate.recordChange(
          "isCurrent",
          entityUpdate.getOriginal().getIsCurrent(),
          entityUpdate.getUpdated().getIsCurrent());
      entityUpdate.recordChange(
          "processingStatus",
          entityUpdate.getOriginal().getProcessingStatus(),
          entityUpdate.getUpdated().getProcessingStatus());
      entityUpdate.recordChange(
          "processingError",
          entityUpdate.getOriginal().getProcessingError(),
          entityUpdate.getUpdated().getProcessingError());
      entityUpdate.recordChange(
          "extractedText",
          entityUpdate.getOriginal().getExtractedText(),
          entityUpdate.getUpdated().getExtractedText());
    }

    private final EntityUpdater<ContextFileContent> entityUpdate;

    public EntityUpdater<ContextFileContent> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<ContextFileContent> entityContext;

  @Override
  public final EntityPolicyContext<ContextFileContent> context() {
    return entityContext;
  }
}

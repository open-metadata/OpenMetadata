package org.openmetadata.service.jdbi3;

import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.Repository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository
public class ContextFileContentRepository extends EntityRepository<ContextFileContent> {
  public static final String CONTEXT_FILE_CONTENT_ENTITY = "contextFileContent";

  public ContextFileContentRepository(Jdbi jdbi) {
    super(
        null,
        CONTEXT_FILE_CONTENT_ENTITY,
        ContextFileContent.class,
        jdbi.onDemand(CollectionDAO.class).contextFileContentDAO(),
        "",
        "");
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
    store(entity, update);
  }

  @Override
  public void storeRelationships(ContextFileContent entity) {
    // No relationship-backed fields for now.
  }

  @Override
  public EntityUpdater getUpdater(
      ContextFileContent original,
      ContextFileContent updated,
      Operation operation,
      ChangeSource source) {
    return new ContextFileContentUpdater(original, updated, operation);
  }

  public ContextFileContent getById(UUID id) {
    return get(null, id, getFields(""), Include.NON_DELETED, false);
  }

  public java.util.List<ContextFileContent> listByContextFileId(UUID contextFileId) {
    return JsonUtils.readObjects(
        ((CollectionDAO.ContextFileContentDAO) dao).listByContextFileId(contextFileId.toString()),
        ContextFileContent.class);
  }

  public class ContextFileContentUpdater extends EntityUpdater {
    public ContextFileContentUpdater(
        ContextFileContent original, ContextFileContent updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("assetId", original.getAssetId(), updated.getAssetId());
      recordChange("isCurrent", original.getIsCurrent(), updated.getIsCurrent());
      recordChange(
          "processingStatus", original.getProcessingStatus(), updated.getProcessingStatus());
      recordChange("processingError", original.getProcessingError(), updated.getProcessingError());
      recordChange("extractedText", original.getExtractedText(), updated.getExtractedText());
    }
  }
}

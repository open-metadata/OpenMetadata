package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;

import java.io.IOException;
import org.openmetadata.schema.entity.data.knowledge.KnowledgeAsset;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.knowledgeasset.KnowledgeAssetResource;
import org.openmetadata.service.util.EntityUtil;

public class KnowledgeAssetRepository extends EntityRepository<KnowledgeAsset> {

  private static final String PATCH_FIELDS = "owner,tags,followers,url";
  private static final String UPDATE_FIELDS = "owner,tags,votes,followers";

  public KnowledgeAssetRepository(CollectionDAO dao) {
    super(
        KnowledgeAssetResource.COLLECTION_PATH,
        Entity.KNOWLEDGE_ASSET,
        KnowledgeAsset.class,
        dao.knowledgeAssetDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS,
        null);
  }

  @Override
  public KnowledgeAsset setFields(KnowledgeAsset entity, EntityUtil.Fields fields) throws IOException {
    entity.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(entity) : null);
    entity.setVotes(fields.contains("votes") ? this.getVotes(entity) : null);
    return entity;
  }

  @Override
  public void prepare(KnowledgeAsset entity) {
    /* All Prepared */
  }

  @Override
  public void storeEntity(KnowledgeAsset entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    entity.withOwner(null).withFollowers(null);
    store(entity, update);

    // Restore relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(KnowledgeAsset entity) {
    // Add quick-link owner relationship
    storeOwner(entity, entity.getOwner());

    // Add tag to quick-link relationship
    applyTags(entity);
  }

  @Override
  public EntityUpdater getUpdater(KnowledgeAsset original, KnowledgeAsset updated, Operation operation) {
    return new KnowledgeAssetRepository.QuickLinkUpdater(original, updated, operation);
  }

  public class QuickLinkUpdater extends EntityUpdater {
    public QuickLinkUpdater(KnowledgeAsset original, KnowledgeAsset updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // Use Patch to Update the Url
      if (operation.isPatch()) {
        // TODO":
        // recordChange("url", original.getUrl(), updated.getUrl());
      }
    }
  }
}

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;

import java.io.IOException;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.quicklink.QuickLinkResource;
import org.openmetadata.service.util.EntityUtil;

public class QuickLinkRepository extends EntityRepository<QuickLink> {

  private static final String PATCH_FIELDS = "owner,tags,followers,url";
  private static final String UPDATE_FIELDS = "owner,tags,votes,followers";

  public QuickLinkRepository(CollectionDAO dao) {
    super(
        QuickLinkResource.COLLECTION_PATH,
        Entity.QUICK_LINK,
        QuickLink.class,
        dao.quickLinkDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS,
        null);
  }

  @Override
  public QuickLink setFields(QuickLink entity, EntityUtil.Fields fields) throws IOException {
    entity.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(entity) : null);
    entity.setVotes(fields.contains("votes") ? this.getVotes(entity) : null);
    return entity;
  }

  @Override
  public void prepare(QuickLink entity) {
    /* All Prepared */
  }

  @Override
  public void storeEntity(QuickLink entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    entity.withOwner(null).withFollowers(null);
    store(entity, update);

    // Restore relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(QuickLink entity) {
    // Add quick-link owner relationship
    storeOwner(entity, entity.getOwner());

    // Add tag to quick-link relationship
    applyTags(entity);
  }

  @Override
  public EntityUpdater getUpdater(QuickLink original, QuickLink updated, Operation operation) {
    return new QuickLinkRepository.QuickLinkUpdater(original, updated, operation);
  }

  public class QuickLinkUpdater extends EntityUpdater {
    public QuickLinkUpdater(QuickLink original, QuickLink updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // Use Patch to Update the Url
      if (operation.isPatch()) {
        recordChange("url", original.getUrl(), updated.getUrl());
      }
    }
  }
}

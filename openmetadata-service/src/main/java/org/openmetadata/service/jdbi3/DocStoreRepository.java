package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;

import java.io.IOException;
import org.openmetadata.schema.entity.data.doc.DocStore;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.docstore.DocStoreResource;
import org.openmetadata.service.util.EntityUtil;

public class DocStoreRepository extends EntityRepository<DocStore> {

  private static final String PATCH_FIELDS = "owner,tags,followers,url";
  private static final String UPDATE_FIELDS = "owner,tags,votes,followers";

  public DocStoreRepository(CollectionDAO dao) {
    super(
        DocStoreResource.COLLECTION_PATH,
        Entity.DOC_STORE,
        DocStore.class,
        dao.docStoreDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS,
        null);
  }

  @Override
  public DocStore setFields(DocStore entity, EntityUtil.Fields fields) throws IOException {
    entity.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(entity) : null);
    entity.setVotes(fields.contains("votes") ? this.getVotes(entity) : null);
    return entity;
  }

  @Override
  public void prepare(DocStore entity) {
    /* All Prepared */
  }

  @Override
  public void storeEntity(DocStore entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    entity.withOwner(null).withFollowers(null);
    store(entity, update);

    // Restore relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(DocStore entity) {
    // Add quick-link owner relationship
    storeOwner(entity, entity.getOwner());

    // Add tag to quick-link relationship
    applyTags(entity);
  }

  @Override
  public EntityUpdater getUpdater(DocStore original, DocStore updated, Operation operation) {
    return new DocStoreRepository.QuickLinkUpdater(original, updated, operation);
  }

  public class QuickLinkUpdater extends EntityUpdater {
    public QuickLinkUpdater(DocStore original, DocStore updated, Operation operation) {
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

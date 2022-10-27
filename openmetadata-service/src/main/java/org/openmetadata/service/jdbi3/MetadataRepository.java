package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.METADATA;

import java.io.IOException;
import org.openmetadata.schema.entity.metadata.Metadata;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

public class MetadataRepository extends EntityRepository<Metadata> {
  public static final String COLLECTION_PATH = "/v1/metadata";
  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";

  public MetadataRepository(CollectionDAO dao) {
    super(COLLECTION_PATH, METADATA, Metadata.class, dao.metadataDAO(), dao, PATCH_FIELDS, UPDATE_FIELDS);
  }

  @Override
  public Metadata setFields(Metadata entity, EntityUtil.Fields fields) throws IOException {
    entity.setOwner(fields.contains(Entity.FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void prepare(Metadata entity) throws IOException {
    entity.setFullyQualifiedName((entity.getName()));
  }

  @Override
  public void storeEntity(Metadata entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    entity.withOwner(null).withHref(null);
    store(entity.getId(), entity, update);
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(Metadata entity) throws IOException {
    storeOwner(entity, entity.getOwner());
  }
}

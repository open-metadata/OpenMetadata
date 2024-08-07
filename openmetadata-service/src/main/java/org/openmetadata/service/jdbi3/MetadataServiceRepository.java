package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.database.DatabaseServiceResource;

public class MetadataServiceRepository
    extends ServiceEntityRepository<MetadataService, MetadataConnection> {
  private static final String UPDATE_FIELDS = "owners,tags,connection";

  public MetadataServiceRepository() {
    super(
        DatabaseServiceResource.COLLECTION_PATH,
        Entity.METADATA_SERVICE,
        Entity.getCollectionDAO().metadataServiceDAO(),
        MetadataConnection.class,
        UPDATE_FIELDS,
        ServiceType.METADATA);
    supportsSearch = true;
  }
}

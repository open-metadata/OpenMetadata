package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.storage.StorageServiceResource;

public class StorageServiceRepository
    extends ServiceEntityRepository<StorageService, StorageConnection> {
  public StorageServiceRepository() {
    super(
        StorageServiceResource.COLLECTION_PATH,
        Entity.STORAGE_SERVICE,
        Entity.getCollectionDAO().storageServiceDAO(),
        StorageConnection.class,
        "",
        ServiceType.STORAGE);
    supportsSearch = true;
  }
}

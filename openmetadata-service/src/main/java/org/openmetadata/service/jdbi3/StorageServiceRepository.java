package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.storage.StorageServiceResource;
import org.openmetadata.service.search.SearchRepository;

public class StorageServiceRepository extends ServiceEntityRepository<StorageService, StorageConnection> {
  public StorageServiceRepository(CollectionDAO dao, SearchRepository searchRepository) {
    super(
        StorageServiceResource.COLLECTION_PATH,
        Entity.STORAGE_SERVICE,
        dao,
        searchRepository,
        dao.storageServiceDAO(),
        StorageConnection.class,
        "",
        ServiceType.STORAGE);
    supportsSearch = true;
  }
}

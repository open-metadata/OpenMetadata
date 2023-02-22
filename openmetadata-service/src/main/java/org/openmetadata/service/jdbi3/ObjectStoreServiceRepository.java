package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.ObjectStoreService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.ObjectStoreConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.objectstore.ObjectStoreServiceResource;

public class ObjectStoreServiceRepository extends ServiceEntityRepository<ObjectStoreService, ObjectStoreConnection> {
  public ObjectStoreServiceRepository(CollectionDAO dao) {
    super(
        ObjectStoreServiceResource.COLLECTION_PATH,
        Entity.OBJECT_STORE_SERVICE,
        dao,
        dao.objectStoreServiceDAO(),
        ObjectStoreConnection.class,
        ServiceType.OBJECT_STORE);
  }
}

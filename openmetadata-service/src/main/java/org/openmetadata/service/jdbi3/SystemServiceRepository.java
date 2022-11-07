package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.SystemConnection;
import org.openmetadata.schema.entity.services.SystemService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.database.DatabaseServiceResource;

public class SystemServiceRepository extends ServiceEntityRepository<SystemService, SystemConnection> {
  public SystemServiceRepository(CollectionDAO dao) {
    super(
        DatabaseServiceResource.COLLECTION_PATH,
        Entity.SYSTEM_SERVICE,
        dao,
        dao.systemServiceDAO(),
        SystemConnection.class,
        ServiceType.METADATA);
  }
}

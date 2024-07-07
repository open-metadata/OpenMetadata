package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.APIService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.APIServiceConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.apiservices.APIServiceResource;

public class APIServiceRepository
    extends ServiceEntityRepository<APIService, APIServiceConnection> {
  public APIServiceRepository() {
    super(
        APIServiceResource.COLLECTION_PATH,
        Entity.API_SERVICE,
        Entity.getCollectionDAO().apiServiceDAO(),
        APIServiceConnection.class,
        "",
        ServiceType.API);
    supportsSearch = true;
  }
}

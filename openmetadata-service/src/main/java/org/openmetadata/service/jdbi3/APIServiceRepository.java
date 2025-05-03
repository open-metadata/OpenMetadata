package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.ApiConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.apiservices.APIServiceResource;

public class APIServiceRepository extends ServiceEntityRepository<ApiService, ApiConnection> {
  public APIServiceRepository() {
    super(
        APIServiceResource.COLLECTION_PATH,
        Entity.API_SERVICE,
        Entity.getCollectionDAO().apiServiceDAO(),
        ApiConnection.class,
        "",
        ServiceType.API);
    supportsSearch = true;
  }
}

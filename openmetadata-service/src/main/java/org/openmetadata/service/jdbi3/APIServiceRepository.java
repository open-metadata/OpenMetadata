package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.ApiConnection;
import org.openmetadata.schema.type.Relationship;
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

  @Override
  public void storeRelationships(ApiService service) {
    super.storeRelationships(service);
    if (service.getIngestionAgent() != null) {
      addRelationship(
          service.getId(),
          service.getIngestionAgent().getId(),
          entityType,
          service.getIngestionAgent().getType(),
          Relationship.HAS);
    }
  }
}

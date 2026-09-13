package org.openmetadata.service.jdbi3;

import java.util.Set;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.ApiConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.service.EntityServiceAssembly;
import org.openmetadata.service.entity.service.EntityServiceOperations;
import org.openmetadata.service.entity.service.EntityServicePolicy;
import org.openmetadata.service.resources.services.apiservices.APIServiceResource;

@Repository()
public class APIServiceRepository implements EntityServicePolicy<ApiService, ApiConnection> {

  public APIServiceRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                APIServiceResource.COLLECTION_PATH,
                Entity.API_SERVICE,
                ApiService.class,
                Entity.getCollectionDAO().apiServiceDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    this.serviceOperations =
        EntityServiceAssembly.create(this, ApiConnection.class, ServiceType.API);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(true);
  }

  private final EntityPolicyContext<ApiService> entityContext;

  private final EntityServiceOperations<ApiService, ApiConnection> serviceOperations;

  @Override
  public final EntityPolicyContext<ApiService> context() {
    return entityContext;
  }

  @Override
  public final EntityServiceOperations<ApiService, ApiConnection> serviceOperations() {
    return serviceOperations;
  }
}

package org.openmetadata.service.jdbi3;

import java.util.Set;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.service.EntityServiceAssembly;
import org.openmetadata.service.entity.service.EntityServiceOperations;
import org.openmetadata.service.entity.service.EntityServicePolicy;
import org.openmetadata.service.resources.services.storage.StorageServiceResource;

@Repository()
public class StorageServiceRepository
    implements EntityServicePolicy<StorageService, StorageConnection> {

  public StorageServiceRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                StorageServiceResource.COLLECTION_PATH,
                Entity.STORAGE_SERVICE,
                StorageService.class,
                Entity.getCollectionDAO().storageServiceDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    this.serviceOperations =
        EntityServiceAssembly.create(this, StorageConnection.class, ServiceType.STORAGE);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(true);
  }

  private final EntityPolicyContext<StorageService> entityContext;

  private final EntityServiceOperations<StorageService, StorageConnection> serviceOperations;

  @Override
  public final EntityPolicyContext<StorageService> context() {
    return entityContext;
  }

  @Override
  public final EntityServiceOperations<StorageService, StorageConnection> serviceOperations() {
    return serviceOperations;
  }
}

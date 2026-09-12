package org.openmetadata.service.jdbi3;

import java.util.Set;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.service.EntityServiceAssembly;
import org.openmetadata.service.entity.service.EntityServiceOperations;
import org.openmetadata.service.entity.service.EntityServicePolicy;
import org.openmetadata.service.resources.services.metadata.MetadataServiceResource;

@Repository()
public class MetadataServiceRepository
    implements EntityServicePolicy<MetadataService, MetadataConnection> {

  private static final String UPDATE_FIELDS = "owners,tags,connection";

  public MetadataServiceRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                MetadataServiceResource.COLLECTION_PATH,
                Entity.METADATA_SERVICE,
                MetadataService.class,
                Entity.getCollectionDAO().metadataServiceDAO()),
            new EntityPolicyContext.WriteFields("", UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    this.serviceOperations =
        EntityServiceAssembly.create(this, MetadataConnection.class, ServiceType.METADATA);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(true);
  }

  private final EntityPolicyContext<MetadataService> entityContext;

  private final EntityServiceOperations<MetadataService, MetadataConnection> serviceOperations;

  @Override
  public final EntityPolicyContext<MetadataService> context() {
    return entityContext;
  }

  @Override
  public final EntityServiceOperations<MetadataService, MetadataConnection> serviceOperations() {
    return serviceOperations;
  }
}

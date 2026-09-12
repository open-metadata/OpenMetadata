package org.openmetadata.service.jdbi3;

import java.util.Set;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.SearchConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.service.EntityServiceAssembly;
import org.openmetadata.service.entity.service.EntityServiceOperations;
import org.openmetadata.service.entity.service.EntityServicePolicy;
import org.openmetadata.service.resources.services.searchIndexes.SearchServiceResource;

@Repository()
public class SearchServiceRepository
    implements EntityServicePolicy<SearchService, SearchConnection> {

  public SearchServiceRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                SearchServiceResource.COLLECTION_PATH,
                Entity.SEARCH_SERVICE,
                SearchService.class,
                Entity.getCollectionDAO().searchServiceDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    this.serviceOperations =
        EntityServiceAssembly.create(this, SearchConnection.class, ServiceType.SEARCH);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(true);
  }

  private final EntityPolicyContext<SearchService> entityContext;

  private final EntityServiceOperations<SearchService, SearchConnection> serviceOperations;

  @Override
  public final EntityPolicyContext<SearchService> context() {
    return entityContext;
  }

  @Override
  public final EntityServiceOperations<SearchService, SearchConnection> serviceOperations() {
    return serviceOperations;
  }
}

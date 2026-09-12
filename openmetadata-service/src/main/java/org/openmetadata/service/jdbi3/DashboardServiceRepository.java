/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.jdbi3;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.service.EntityServiceAssembly;
import org.openmetadata.service.entity.service.EntityServiceOperations;
import org.openmetadata.service.entity.service.EntityServicePolicy;
import org.openmetadata.service.resources.services.dashboard.DashboardServiceResource;

@Slf4j
@Repository()
public class DashboardServiceRepository
    implements EntityServicePolicy<DashboardService, DashboardConnection> {

  public DashboardServiceRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                DashboardServiceResource.COLLECTION_PATH,
                Entity.DASHBOARD_SERVICE,
                DashboardService.class,
                Entity.getCollectionDAO().dashboardServiceDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    this.serviceOperations =
        EntityServiceAssembly.create(this, DashboardConnection.class, ServiceType.DASHBOARD);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(true);
  }

  private final EntityPolicyContext<DashboardService> entityContext;

  private final EntityServiceOperations<DashboardService, DashboardConnection> serviceOperations;

  @Override
  public final EntityPolicyContext<DashboardService> context() {
    return entityContext;
  }

  @Override
  public final EntityServiceOperations<DashboardService, DashboardConnection> serviceOperations() {
    return serviceOperations;
  }
}

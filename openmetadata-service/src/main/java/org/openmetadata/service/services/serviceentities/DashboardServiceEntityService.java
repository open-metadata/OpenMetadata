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

package org.openmetadata.service.services.serviceentities;

import jakarta.ws.rs.core.SecurityContext;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DashboardServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.ServiceEntityInfo;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.resources.services.dashboard.DashboardServiceMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.DASHBOARD_SERVICE)
public class DashboardServiceEntityService
    extends ServiceEntityResource<
        DashboardService, DashboardServiceRepository, DashboardConnection> {
  public static final String FIELDS = "owners,domains,followers";

  @Getter private final DashboardServiceMapper mapper = new DashboardServiceMapper();

  @Inject
  public DashboardServiceEntityService(
      DashboardServiceRepository repository, Authorizer authorizer, Limits limits) {
    super(
        new ServiceEntityInfo<>(
            Entity.DASHBOARD_SERVICE, ServiceType.DASHBOARD, DashboardService.class),
        repository,
        authorizer,
        limits);
  }

  @Override
  protected DashboardService nullifyConnection(DashboardService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(DashboardService service) {
    return service.getServiceType().value();
  }

  public DashboardService addTestConnectionResult(
      SecurityContext securityContext, UUID serviceId, TestConnectionResult testConnectionResult) {
    OperationContext operationContext =
        new OperationContext(getEntityType(), MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(serviceId));
    DashboardService service = repository.addTestConnectionResult(serviceId, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  public static class DashboardServiceList extends ResultList<DashboardService> {
    /* Required for serde */
  }
}

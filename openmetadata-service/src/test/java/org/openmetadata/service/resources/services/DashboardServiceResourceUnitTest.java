/*
 *  Copyright 2022 Collate
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

package org.openmetadata.service.resources.services;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.FIELD_OWNER;

import java.io.IOException;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.dashboard.TableauConnection;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DashboardServiceRepository;
import org.openmetadata.service.resources.services.dashboard.DashboardServiceResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.security.Authorizer;

public class DashboardServiceResourceUnitTest
    extends ServiceResourceTest<
        DashboardServiceResource, DashboardService, DashboardServiceRepository, DashboardConnection> {

  @Override
  protected DashboardServiceResource newServiceResource(
      CollectionDAO collectionDAO, Authorizer authorizer, SecretsManager secretsManager) {
    return new DashboardServiceResource(collectionDAO, authorizer, secretsManager);
  }

  @Override
  protected void mockServiceResourceSpecific() throws IOException {
    service = mock(DashboardService.class);
    serviceConnectionConfig = new TableauConnection();
    DashboardConnection serviceConnection = mock(DashboardConnection.class);
    lenient().when(serviceConnection.getConfig()).thenReturn(serviceConnectionConfig);
    CollectionDAO.DashboardServiceDAO entityDAO = mock(CollectionDAO.DashboardServiceDAO.class);
    when(collectionDAO.dashboardServiceDAO()).thenReturn(entityDAO);
    lenient().when(service.getServiceType()).thenReturn(CreateDashboardService.DashboardServiceType.Tableau);
    lenient().when(service.getConnection()).thenReturn(serviceConnection);
    lenient().when(service.withConnection(isNull())).thenReturn(service);
    when(entityDAO.findEntityById(any(), any())).thenReturn(service);
    when(entityDAO.getEntityClass()).thenReturn(DashboardService.class);
  }

  @Override
  protected String serviceConnectionType() {
    return CreateDashboardService.DashboardServiceType.Tableau.value();
  }

  @Override
  protected ServiceType serviceType() {
    return ServiceType.DASHBOARD;
  }

  @Override
  protected void verifyServiceWithConnectionCall(boolean shouldBeNull, DashboardService service) {
    verify(service.getConnection(), times(shouldBeNull ? 1 : 0))
        .setConfig(!shouldBeNull ? isNull() : any(TableauConnection.class));
  }

  @Override
  protected DashboardService callGetFromResource(DashboardServiceResource resource) throws IOException {
    return resource.get(mock(UriInfo.class), securityContext, UUID.randomUUID(), FIELD_OWNER, Include.ALL);
  }
}

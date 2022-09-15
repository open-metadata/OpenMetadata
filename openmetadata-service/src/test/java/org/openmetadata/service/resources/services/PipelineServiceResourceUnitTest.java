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
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.pipeline.AirbyteConnection;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.PipelineServiceRepository;
import org.openmetadata.service.resources.services.pipeline.PipelineServiceResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.security.Authorizer;

@ExtendWith(MockitoExtension.class)
public class PipelineServiceResourceUnitTest
    extends ServiceResourceTest<
        PipelineServiceResource, PipelineService, PipelineServiceRepository, PipelineConnection> {

  @Override
  protected PipelineServiceResource newServiceResource(
      CollectionDAO collectionDAO, Authorizer authorizer, SecretsManager secretsManager) {
    return new PipelineServiceResource(collectionDAO, authorizer, secretsManager);
  }

  @Override
  protected void mockServiceResourceSpecific() throws IOException {
    service = mock(PipelineService.class);
    serviceConnectionConfig = new AirbyteConnection();
    PipelineConnection serviceConnection = mock(PipelineConnection.class);
    lenient().when(serviceConnection.getConfig()).thenReturn(serviceConnectionConfig);
    CollectionDAO.PipelineServiceDAO entityDAO = mock(CollectionDAO.PipelineServiceDAO.class);
    when(collectionDAO.pipelineServiceDAO()).thenReturn(entityDAO);
    lenient().when(service.getServiceType()).thenReturn(CreatePipelineService.PipelineServiceType.Airbyte);
    lenient().when(service.getConnection()).thenReturn(serviceConnection);
    lenient().when(service.withConnection(isNull())).thenReturn(service);
    when(entityDAO.findEntityById(any(), any())).thenReturn(service);
    when(entityDAO.getEntityClass()).thenReturn(PipelineService.class);
  }

  @Override
  protected String serviceConnectionType() {
    return CreatePipelineService.PipelineServiceType.Airbyte.value();
  }

  @Override
  protected ServiceType serviceType() {
    return ServiceType.PIPELINE;
  }

  @Override
  protected void verifyServiceWithConnectionCall(boolean shouldBeNull, PipelineService service) {
    verify(service.getConnection(), times(shouldBeNull ? 1 : 0))
        .setConfig(!shouldBeNull ? isNull() : any(AirbyteConnection.class));
  }

  @Override
  protected PipelineService callGetFromResource(PipelineServiceResource resource) throws IOException {
    return resource.get(mock(UriInfo.class), securityContext, UUID.randomUUID(), FIELD_OWNER, Include.ALL);
  }
}

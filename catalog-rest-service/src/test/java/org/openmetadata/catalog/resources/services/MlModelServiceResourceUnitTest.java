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

package org.openmetadata.catalog.resources.services;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;

import java.io.IOException;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.catalog.api.services.CreateMlModelService;
import org.openmetadata.catalog.entity.services.MlModelService;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.MlModelServiceRepository;
import org.openmetadata.catalog.resources.services.mlmodel.MlModelServiceResource;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.MlModelConnection;

@ExtendWith(MockitoExtension.class)
public class MlModelServiceResourceUnitTest
    extends ServiceResourceTest<MlModelServiceResource, MlModelService, MlModelServiceRepository, MlModelConnection> {

  @Override
  protected MlModelServiceResource newServiceResource(
      CollectionDAO collectionDAO, Authorizer authorizer, SecretsManager secretsManager) {
    return new MlModelServiceResource(collectionDAO, authorizer, secretsManager);
  }

  @Override
  protected void mockServiceResourceSpecific() throws IOException {
    service = mock(MlModelService.class);
    CollectionDAO.MlModelServiceDAO entityDAO = mock(CollectionDAO.MlModelServiceDAO.class);
    when(collectionDAO.mlModelServiceDAO()).thenReturn(entityDAO);
    lenient().when(service.getServiceType()).thenReturn(CreateMlModelService.MlModelServiceType.Mlflow);
    lenient().when(service.getConnection()).thenReturn(mock(MlModelConnection.class));
    lenient().when(service.withConnection(isNull())).thenReturn(service);
    when(entityDAO.findEntityById(any(), any())).thenReturn(service);
    when(entityDAO.getEntityClass()).thenReturn(MlModelService.class);
  }

  @Override
  protected String serviceType() {
    return CreateMlModelService.MlModelServiceType.Mlflow.value();
  }

  @Override
  protected void verifyServiceWithConnectionCall(boolean shouldBeNull, MlModelService service) {
    verify(service, times(shouldBeNull ? 1 : 0)).withConnection(isNull());
  }

  @Override
  protected MlModelService callGetFromResource(MlModelServiceResource resource) throws IOException {
    return resource.get(mock(UriInfo.class), securityContext, UUID.randomUUID().toString(), FIELD_OWNER, Include.ALL);
  }
}

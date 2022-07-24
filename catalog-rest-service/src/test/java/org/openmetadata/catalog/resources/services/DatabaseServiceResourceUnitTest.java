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
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository;
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.Include;

public class DatabaseServiceResourceUnitTest
    extends ServiceResourceTest<
        DatabaseServiceResource, DatabaseService, DatabaseServiceRepository, DatabaseConnection> {

  @Override
  protected DatabaseServiceResource newServiceResource(
      CollectionDAO collectionDAO, Authorizer authorizer, SecretsManager secretsManager) {
    return new DatabaseServiceResource(collectionDAO, authorizer, secretsManager);
  }

  @Override
  protected void mockServiceResourceSpecific() throws IOException {
    service = mock(DatabaseService.class);
    CollectionDAO.DatabaseServiceDAO entityDAO = mock(CollectionDAO.DatabaseServiceDAO.class);
    when(collectionDAO.dbServiceDAO()).thenReturn(entityDAO);
    lenient().when(service.getServiceType()).thenReturn(CreateDatabaseService.DatabaseServiceType.Mysql);
    lenient().when(service.getConnection()).thenReturn(mock(DatabaseConnection.class));
    lenient().when(service.withConnection(isNull())).thenReturn(service);
    when(entityDAO.findEntityById(any(), any())).thenReturn(service);
    when(entityDAO.getEntityClass()).thenReturn(DatabaseService.class);
  }

  @Override
  protected String serviceType() {
    return CreateDatabaseService.DatabaseServiceType.Mysql.value();
  }

  @Override
  protected void verifyServiceWithConnectionCall(boolean shouldBeNull, DatabaseService service) {
    verify(service, times(shouldBeNull ? 1 : 0)).withConnection(isNull());
  }

  @Override
  protected DatabaseService callGetFromResource(DatabaseServiceResource resource) throws IOException {
    return resource.get(mock(UriInfo.class), securityContext, UUID.randomUUID().toString(), FIELD_OWNER, Include.ALL);
  }
}

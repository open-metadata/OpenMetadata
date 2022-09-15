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

package org.openmetadata.service.jdbi3;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;

import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.service.secrets.SecretsManager;

public class DatabaseServiceRepositoryUnitTest
    extends ServiceEntityRepositoryTest<DatabaseServiceRepository, DatabaseService, DatabaseConnection> {

  protected DatabaseServiceRepositoryUnitTest() {
    super(ServiceType.DATABASE);
  }

  @Override
  protected DatabaseServiceRepository newServiceRepository(CollectionDAO collectionDAO, SecretsManager secretsManager) {
    return new DatabaseServiceRepository(collectionDAO, secretsManager);
  }

  @Override
  protected void mockServiceResourceSpecific() {
    service = mock(DatabaseService.class);
    serviceConnection = mock(DatabaseConnection.class);
    when(serviceConnection.getConfig()).thenReturn(mock(MysqlConnection.class));
    CollectionDAO.DatabaseServiceDAO entityDAO = mock(CollectionDAO.DatabaseServiceDAO.class);
    when(collectionDAO.dbServiceDAO()).thenReturn(entityDAO);
    when(entityDAO.getEntityClass()).thenReturn(DatabaseService.class);
    when(service.withHref(isNull())).thenReturn(service);
    when(service.withOwner(isNull())).thenReturn(service);
    when(service.getConnection()).thenReturn(serviceConnection);
    when(service.getServiceType()).thenReturn(Mysql);
  }
}

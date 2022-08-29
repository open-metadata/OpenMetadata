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

package org.openmetadata.catalog.jdbi3;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.catalog.api.services.CreateMessagingService.MessagingServiceType.Kafka;

import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;
import org.openmetadata.catalog.type.MessagingConnection;

public class MessagingServiceRepositoryUnitTest
    extends ServiceEntityRepositoryTest<MessagingServiceRepository, MessagingService, MessagingConnection> {

  protected MessagingServiceRepositoryUnitTest() {
    super(ServiceType.MESSAGING);
  }

  @Override
  protected MessagingServiceRepository newServiceRepository(
      CollectionDAO collectionDAO, SecretsManager secretsManager) {
    return new MessagingServiceRepository(collectionDAO, secretsManager);
  }

  @Override
  protected void mockServiceResourceSpecific() {
    service = mock(MessagingService.class);
    serviceConnection = mock(MessagingConnection.class);
    when(serviceConnection.getConfig()).thenReturn(mock(MysqlConnection.class));
    CollectionDAO.MessagingServiceDAO entityDAO = mock(CollectionDAO.MessagingServiceDAO.class);
    when(collectionDAO.messagingServiceDAO()).thenReturn(entityDAO);
    when(entityDAO.getEntityClass()).thenReturn(MessagingService.class);
    when(service.withHref(isNull())).thenReturn(service);
    when(service.withOwner(isNull())).thenReturn(service);
    when(service.getConnection()).thenReturn(serviceConnection);
    when(service.getServiceType()).thenReturn(Kafka);
  }
}

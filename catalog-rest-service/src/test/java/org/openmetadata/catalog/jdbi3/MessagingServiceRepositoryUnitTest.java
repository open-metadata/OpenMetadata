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
    extends ServiceRepositoryTest<MessagingServiceRepository, MessagingService, MessagingConnection> {

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

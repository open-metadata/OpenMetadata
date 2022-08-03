package org.openmetadata.catalog.jdbi3;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;

import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;

public class DatabaseServiceRepositoryUnitTest
    extends ServiceRepositoryTest<DatabaseServiceRepository, DatabaseService, DatabaseConnection> {

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

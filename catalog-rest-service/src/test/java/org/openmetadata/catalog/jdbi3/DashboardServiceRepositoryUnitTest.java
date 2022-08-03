package org.openmetadata.catalog.jdbi3;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.catalog.api.services.CreateDashboardService.DashboardServiceType.Looker;

import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;
import org.openmetadata.catalog.type.DashboardConnection;

public class DashboardServiceRepositoryUnitTest
    extends ServiceRepositoryTest<DashboardServiceRepository, DashboardService, DashboardConnection> {

  protected DashboardServiceRepositoryUnitTest() {
    super(ServiceType.DASHBOARD);
  }

  @Override
  protected DashboardServiceRepository newServiceRepository(
      CollectionDAO collectionDAO, SecretsManager secretsManager) {
    return new DashboardServiceRepository(collectionDAO, secretsManager);
  }

  @Override
  protected void mockServiceResourceSpecific() {
    service = mock(DashboardService.class);
    serviceConnection = mock(DashboardConnection.class);
    when(serviceConnection.getConfig()).thenReturn(mock(MysqlConnection.class));
    CollectionDAO.DashboardServiceDAO entityDAO = mock(CollectionDAO.DashboardServiceDAO.class);
    when(collectionDAO.dashboardServiceDAO()).thenReturn(entityDAO);
    when(entityDAO.getEntityClass()).thenReturn(DashboardService.class);
    when(service.withHref(isNull())).thenReturn(service);
    when(service.withOwner(isNull())).thenReturn(service);
    when(service.getConnection()).thenReturn(serviceConnection);
    when(service.getServiceType()).thenReturn(Looker);
  }
}

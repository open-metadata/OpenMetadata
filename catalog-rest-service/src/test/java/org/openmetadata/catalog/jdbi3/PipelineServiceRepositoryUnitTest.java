package org.openmetadata.catalog.jdbi3;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.catalog.api.services.CreatePipelineService.PipelineServiceType.Airflow;

import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;
import org.openmetadata.catalog.type.PipelineConnection;

public class PipelineServiceRepositoryUnitTest
    extends ServiceRepositoryTest<PipelineServiceRepository, PipelineService, PipelineConnection> {

  protected PipelineServiceRepositoryUnitTest() {
    super(ServiceType.PIPELINE);
  }

  @Override
  protected PipelineServiceRepository newServiceRepository(CollectionDAO collectionDAO, SecretsManager secretsManager) {
    return new PipelineServiceRepository(collectionDAO, secretsManager);
  }

  @Override
  protected void mockServiceResourceSpecific() {
    service = mock(PipelineService.class);
    serviceConnection = mock(PipelineConnection.class);
    when(serviceConnection.getConfig()).thenReturn(mock(MysqlConnection.class));
    CollectionDAO.PipelineServiceDAO entityDAO = mock(CollectionDAO.PipelineServiceDAO.class);
    when(collectionDAO.pipelineServiceDAO()).thenReturn(entityDAO);
    when(entityDAO.getEntityClass()).thenReturn(PipelineService.class);
    when(service.withHref(isNull())).thenReturn(service);
    when(service.withOwner(isNull())).thenReturn(service);
    when(service.getConnection()).thenReturn(serviceConnection);
    when(service.getServiceType()).thenReturn(Airflow);
  }
}

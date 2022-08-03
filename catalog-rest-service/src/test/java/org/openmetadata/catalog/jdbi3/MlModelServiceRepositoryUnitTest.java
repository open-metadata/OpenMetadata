package org.openmetadata.catalog.jdbi3;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.catalog.api.services.CreateMlModelService.MlModelServiceType.Mlflow;

import org.openmetadata.catalog.entity.services.MlModelService;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.services.connections.database.MysqlConnection;
import org.openmetadata.catalog.type.MlModelConnection;

public class MlModelServiceRepositoryUnitTest
    extends ServiceRepositoryTest<MlModelServiceRepository, MlModelService, MlModelConnection> {

  protected MlModelServiceRepositoryUnitTest() {
    super(ServiceType.ML_MODEL);
  }

  @Override
  protected MlModelServiceRepository newServiceRepository(CollectionDAO collectionDAO, SecretsManager secretsManager) {
    return new MlModelServiceRepository(collectionDAO, secretsManager);
  }

  @Override
  protected void mockServiceResourceSpecific() {
    service = mock(MlModelService.class);
    serviceConnection = mock(MlModelConnection.class);
    when(serviceConnection.getConfig()).thenReturn(mock(MysqlConnection.class));
    CollectionDAO.MlModelServiceDAO entityDAO = mock(CollectionDAO.MlModelServiceDAO.class);
    when(collectionDAO.mlModelServiceDAO()).thenReturn(entityDAO);
    when(entityDAO.getEntityClass()).thenReturn(MlModelService.class);
    when(service.withHref(isNull())).thenReturn(service);
    when(service.withOwner(isNull())).thenReturn(service);
    when(service.getConnection()).thenReturn(serviceConnection);
    when(service.getServiceType()).thenReturn(Mlflow);
  }
}

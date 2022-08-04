package org.openmetadata.catalog.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.catalog.ServiceConnectionEntityInterface;
import org.openmetadata.catalog.ServiceEntityInterface;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.secrets.SecretsManager;

@ExtendWith(MockitoExtension.class)
public abstract class ServiceRepositoryTest<
    T extends ServiceRepository<R, S>, R extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface> {

  @Mock protected CollectionDAO collectionDAO;

  @Mock protected SecretsManager secretsManager;

  protected T serviceRepository;

  protected R service;

  protected S serviceConnection;

  private final ServiceType expectedServiceType;

  protected ServiceRepositoryTest(ServiceType serviceType) {
    this.expectedServiceType = serviceType;
  }

  @BeforeEach
  void beforeEach() {
    mockServiceResourceSpecific();
    serviceRepository = newServiceRepository(collectionDAO, secretsManager);
  }

  @AfterEach
  void afterEach() {
    reset(secretsManager, service);
  }

  protected abstract T newServiceRepository(CollectionDAO collectionDAO, SecretsManager secretsManager);

  protected abstract void mockServiceResourceSpecific();

  @Test
  void testStoreEntityCallCorrectlyLocalSecretManager() throws IOException {
    when(service.getName()).thenReturn("local");
    when(secretsManager.isLocal()).thenReturn(true);
    ArgumentCaptor<String> serviceNameCaptor = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<ServiceType> serviceTypeCaptor = ArgumentCaptor.forClass(ServiceType.class);

    serviceRepository.storeEntity(service, true);

    verify(serviceConnection, times(2)).getConfig();
    verify(serviceConnection).setConfig(isNull());
    verify(secretsManager)
        .encryptOrDecryptServiceConnectionConfig(
            any(), any(), serviceNameCaptor.capture(), serviceTypeCaptor.capture(), anyBoolean());
    assertEquals("local", serviceNameCaptor.getValue());
    assertEquals(expectedServiceType, serviceTypeCaptor.getValue());
  }

  @Test
  void testStoreEntityCallCorrectlyNotLocalSecretManager() throws IOException {
    when(service.getName()).thenReturn("not-local");
    ArgumentCaptor<String> serviceNameCaptor = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<ServiceType> serviceTypeCaptor = ArgumentCaptor.forClass(ServiceType.class);

    serviceRepository.storeEntity(service, true);

    verify(serviceConnection, times(2)).getConfig();
    verify(serviceConnection, times(2)).setConfig(isNull());
    verify(secretsManager)
        .encryptOrDecryptServiceConnectionConfig(
            any(), any(), serviceNameCaptor.capture(), serviceTypeCaptor.capture(), anyBoolean());
    assertEquals("not-local", serviceNameCaptor.getValue());
    assertEquals(expectedServiceType, serviceTypeCaptor.getValue());
  }
}

package org.openmetadata.catalog.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.never;
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
import org.openmetadata.catalog.secrets.SecretsManager;

@ExtendWith(MockitoExtension.class)
public abstract class ServiceRepositoryTest<
    T extends ServiceRepository<R, S>, R extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface> {

  @Mock protected CollectionDAO collectionDAO;

  @Mock protected SecretsManager secretsManager;

  protected T serviceRepository;

  protected R service;

  protected S serviceConnection;

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

    serviceRepository.storeEntity(service, true);

    verify(serviceConnection, times(2)).getConfig();
    verify(serviceConnection, never()).setConfig(any());
    verify(secretsManager).encryptOrDecryptServiceConnection(any(), any(), serviceNameCaptor.capture(), anyBoolean());
    assertEquals("local", serviceNameCaptor.getValue());
  }

  @Test
  void testStoreEntityCallCorrectlyNotLocalSecretManager() throws IOException {
    when(service.getName()).thenReturn("not-local");
    ArgumentCaptor<Object> configCaptor = ArgumentCaptor.forClass(Object.class);
    ArgumentCaptor<String> serviceNameCaptor = ArgumentCaptor.forClass(String.class);

    serviceRepository.storeEntity(service, true);

    verify(serviceConnection, times(2)).getConfig();
    verify(serviceConnection, times(2)).setConfig(configCaptor.capture());
    verify(secretsManager).encryptOrDecryptServiceConnection(any(), any(), serviceNameCaptor.capture(), anyBoolean());
    assertNull(configCaptor.getAllValues().get(0));
    assertNotNull(configCaptor.getAllValues().get(1));
    assertEquals("not-local", serviceNameCaptor.getValue());
  }
}

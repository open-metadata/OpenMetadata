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
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.secrets.SecretsManager;

@ExtendWith(MockitoExtension.class)
public abstract class ServiceEntityRepositoryTest<
    T extends ServiceEntityRepository<R, S>,
    R extends ServiceEntityInterface,
    S extends ServiceConnectionEntityInterface> {

  @Mock protected CollectionDAO collectionDAO;

  @Mock protected SecretsManager secretsManager;

  protected T serviceRepository;

  protected R service;

  protected S serviceConnection;

  private final ServiceType expectedServiceType;

  protected ServiceEntityRepositoryTest(ServiceType serviceType) {
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

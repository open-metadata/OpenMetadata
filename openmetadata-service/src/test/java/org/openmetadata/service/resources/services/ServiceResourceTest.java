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

package org.openmetadata.service.resources.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.notNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.UUID;
import javax.ws.rs.core.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

@ExtendWith(MockitoExtension.class)
public abstract class ServiceResourceTest<
    T extends ServiceEntityResource<R, S, U>,
    R extends ServiceEntityInterface,
    S extends ServiceEntityRepository<R, U>,
    U extends ServiceConnectionEntityInterface> {

  T serviceResource;

  @Mock protected CollectionDAO collectionDAO;

  @Mock protected Authorizer authorizer;

  @Mock protected SecretsManager secretsManager;

  protected R service;

  protected Object serviceConnectionConfig;

  @Mock protected SecurityContext securityContext;

  @BeforeEach
  void beforeEach() throws IOException {
    mockServiceResourceSpecific();
    when(collectionDAO.relationshipDAO()).thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    when(service.getId()).thenReturn(UUID.randomUUID());
    when(service.withHref(any())).thenReturn(service);
    lenient()
        .when(
            secretsManager.encryptOrDecryptServiceConnectionConfig(
                any(), anyString(), any(), any(ServiceType.class), anyBoolean()))
        .thenReturn(serviceConnectionConfig);
    serviceResource = newServiceResource(collectionDAO, authorizer, secretsManager);
  }

  protected abstract void mockServiceResourceSpecific() throws IOException;

  protected abstract T newServiceResource(
      CollectionDAO collectionDAO, Authorizer authorizer, SecretsManager secretsManager);

  @ParameterizedTest
  @CsvSource({
    "true, true, true, false",
    "true, true, false, false",
    "true, false, true, false",
    "true, false, false, true",
    "false, true, true, false",
    "false, true, false, false",
    "false, false, true, true",
    "false, false, false, true"
  })
  void testGetCallDecryptOrNullify(boolean isLocalSecretManager, boolean isAdmin, boolean isBot, boolean shouldBeNull)
      throws IOException {
    lenient().when(secretsManager.isLocal()).thenReturn(isLocalSecretManager);

    if (isLocalSecretManager && !isAdmin && !isBot) {
      lenient()
          .doThrow(new AuthorizationException(""))
          .when(authorizer)
          .authorizeAdmin(any(SecurityContext.class), eq(true));
    } else if (!isLocalSecretManager && !isAdmin) {
      lenient()
          .doThrow(new AuthorizationException(""))
          .when(authorizer)
          .authorizeAdmin(any(SecurityContext.class), eq(false));
    }

    R actual = callGetFromResource(serviceResource);

    verify(secretsManager, times(1)).isLocal();
    verify(secretsManager)
        .encryptOrDecryptServiceConnectionConfig(
            notNull(), eq(serviceConnectionType()), any(), eq(serviceType()), eq(false));

    verifyServiceWithConnectionCall(shouldBeNull, service);

    assertEquals(service, actual);
  }

  protected abstract String serviceConnectionType();

  protected abstract ServiceType serviceType();

  protected abstract void verifyServiceWithConnectionCall(boolean shouldBeNull, R service);

  protected abstract R callGetFromResource(T resource) throws IOException;
}

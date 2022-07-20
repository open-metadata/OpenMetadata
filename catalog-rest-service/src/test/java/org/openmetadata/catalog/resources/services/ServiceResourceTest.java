package org.openmetadata.catalog.resources.services;

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
import java.security.Principal;
import java.util.UUID;
import javax.ws.rs.core.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.catalog.ServiceConnectionEntityInterface;
import org.openmetadata.catalog.ServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ServiceRepository;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.security.Authorizer;

@ExtendWith(MockitoExtension.class)
public abstract class ServiceResourceTest<
    T extends ServiceEntityResource<R, S, U>,
    R extends ServiceEntityInterface,
    S extends ServiceRepository<R, U>,
    U extends ServiceConnectionEntityInterface> {

  T serviceResource;

  @Mock protected CollectionDAO collectionDAO;

  @Mock protected Authorizer authorizer;

  @Mock protected SecretsManager secretsManager;

  protected R service;

  @Mock protected SecurityContext securityContext;

  @Mock protected Principal principal;

  @BeforeEach
  void beforeEach() throws IOException {
    mockServiceResourceSpecific();
    when(collectionDAO.relationshipDAO()).thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    when(service.getId()).thenReturn(UUID.randomUUID());
    when(service.withHref(any())).thenReturn(service);
    lenient()
        .when(
            secretsManager.encryptOrDecryptServiceConnectionConfig(
                any(), anyString(), anyString(), anyString(), anyBoolean()))
        .thenReturn(service);
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
    lenient().when(authorizer.isAdmin(any())).thenReturn(isAdmin);
    lenient().when(authorizer.isBot(any())).thenReturn(isBot);

    R actual = callGetFromResource(serviceResource);

    verify(secretsManager, times(1)).isLocal();
    verify(secretsManager, times(shouldBeNull ? 0 : 1))
        .encryptOrDecryptServiceConnection(notNull(), eq(serviceType()), any(), eq(false));

    verifyServiceWithConnectionCall(shouldBeNull, service);

    assertEquals(service, actual);
  }

  protected abstract String serviceType();

  protected abstract void verifyServiceWithConnectionCall(boolean shouldBeNull, R service);

  protected abstract R callGetFromResource(T resource) throws IOException;
}

package org.openmetadata.service.resources.apps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import sun.misc.Unsafe;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AppResourceRetryQueueTest {

  @Mock private AppRepository repository;
  @Mock private UriInfo uriInfo;
  @Mock private CollectionDAO collectionDAO;
  @Mock private CollectionDAO.SearchIndexRetryQueueDAO retryQueueDAO;

  private AppResource appResource;

  @BeforeEach
  void setUp() throws Exception {
    Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    Unsafe unsafe = (Unsafe) unsafeField.get(null);
    appResource = (AppResource) unsafe.allocateInstance(AppResource.class);

    Field repoField = AppResource.class.getSuperclass().getDeclaredField("repository");
    repoField.setAccessible(true);
    repoField.set(appResource, repository);
  }

  @Test
  void listRetryQueue_throwsBadRequestForNonSearchIndexApp() {
    App nonSearchApp = new App().withId(UUID.randomUUID()).withName("DataInsightsApplication");
    when(repository.getByName(any(), eq("DataInsightsApplication"), any()))
        .thenReturn(nonSearchApp);
    when(repository.getFields(eq("id"))).thenReturn(null);

    assertThrows(
        BadRequestException.class,
        () -> appResource.listRetryQueue(uriInfo, null, "DataInsightsApplication", 10, 0));
  }

  @Test
  void listRetryQueue_returnsRecordsForSearchIndexingApplication() {
    App searchApp = new App().withId(UUID.randomUUID()).withName("SearchIndexingApplication");
    when(repository.getByName(any(), eq("SearchIndexingApplication"), any())).thenReturn(searchApp);
    when(repository.getFields(eq("id"))).thenReturn(null);
    when(collectionDAO.searchIndexRetryQueueDAO()).thenReturn(retryQueueDAO);
    when(retryQueueDAO.listAll(10, 0)).thenReturn(List.of());
    when(retryQueueDAO.countAll()).thenReturn(0);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      Response response =
          appResource.listRetryQueue(uriInfo, null, "SearchIndexingApplication", 10, 0);

      assertEquals(200, response.getStatus());
      assertNotNull(response.getEntity());
      verify(retryQueueDAO).listAll(10, 0);
      verify(retryQueueDAO).countAll();
    }
  }

  @Test
  void listRetryQueue_passesLimitAndOffset() {
    App searchApp = new App().withId(UUID.randomUUID()).withName("SearchIndexingApplication");
    when(repository.getByName(any(), eq("SearchIndexingApplication"), any())).thenReturn(searchApp);
    when(repository.getFields(eq("id"))).thenReturn(null);
    when(collectionDAO.searchIndexRetryQueueDAO()).thenReturn(retryQueueDAO);
    when(retryQueueDAO.listAll(50, 25)).thenReturn(List.of());
    when(retryQueueDAO.countAll()).thenReturn(100);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      Response response =
          appResource.listRetryQueue(uriInfo, null, "SearchIndexingApplication", 50, 25);

      assertEquals(200, response.getStatus());
      verify(retryQueueDAO).listAll(50, 25);
    }
  }
}

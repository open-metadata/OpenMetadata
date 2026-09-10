package org.openmetadata.service.resources.apps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Field;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil;
import sun.misc.Unsafe;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AppResourceRetryQueueTest {

  private static final String SEARCH_INDEXING_APP = "SearchIndexingApplication";

  @Mock private AppRepository repository;
  @Mock private UriInfo uriInfo;
  @Mock private CollectionDAO collectionDAO;
  @Mock private CollectionDAO.SearchIndexRetryQueueDAO retryQueueDAO;
  @Mock private Authorizer authorizer;
  @Mock private SecurityContext securityContext;

  private AppResource appResource;

  @BeforeEach
  void setUp() throws Exception {
    Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    Unsafe unsafe = (Unsafe) unsafeField.get(null);
    appResource = (AppResource) unsafe.allocateInstance(AppResource.class);

    setSuperclassField("repository", repository);
    setSuperclassField("authorizer", authorizer);
    setSuperclassField("entityType", Entity.APPLICATION);
  }

  private void setSuperclassField(String name, Object value) throws Exception {
    Field field = AppResource.class.getSuperclass().getDeclaredField(name);
    field.setAccessible(true);
    field.set(appResource, value);
  }

  /**
   * The resource builds a ResourceContext to authorize, and that constructor resolves the entity
   * repository through the static Entity registry, so every call under test needs it stubbed.
   */
  private MockedStatic<Entity> mockEntityRegistry() {
    MockedStatic<Entity> entityMock = mockStatic(Entity.class);
    entityMock.when(() -> Entity.getEntityRepository(anyString())).thenReturn(repository);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    return entityMock;
  }

  private void stubRetryQueue() {
    when(collectionDAO.searchIndexRetryQueueDAO()).thenReturn(retryQueueDAO);
    when(retryQueueDAO.listAll(anyInt(), anyInt())).thenReturn(List.of());
    when(retryQueueDAO.countAll()).thenReturn(0);
  }

  @Test
  void listRetryQueue_throwsBadRequestForNonSearchIndexApp() {
    App nonSearchApp = new App().withId(UUID.randomUUID()).withName("DataInsightsApplication");
    when(repository.getByName(any(), eq("DataInsightsApplication"), any()))
        .thenReturn(nonSearchApp);
    when(repository.getFields(eq("id"))).thenReturn(null);

    try (MockedStatic<Entity> ignored = mockEntityRegistry()) {
      assertThrows(
          BadRequestException.class,
          () ->
              appResource.listRetryQueue(
                  uriInfo, securityContext, "DataInsightsApplication", 10, 0));
    }
  }

  @Test
  void listRetryQueue_returnsRecordsForSearchIndexingApplication() {
    App searchApp = new App().withId(UUID.randomUUID()).withName(SEARCH_INDEXING_APP);
    when(repository.getByName(any(), eq(SEARCH_INDEXING_APP), any())).thenReturn(searchApp);
    when(repository.getFields(eq("id"))).thenReturn(null);

    try (MockedStatic<Entity> ignored = mockEntityRegistry()) {
      stubRetryQueue();

      Response response =
          appResource.listRetryQueue(uriInfo, securityContext, SEARCH_INDEXING_APP, 10, 0);

      assertNotNull(response);
      assertEquals(200, response.getStatus());
      ResultList<?> body = (ResultList<?>) response.getEntity();
      assertEquals(0, body.getData().size());
    }
  }

  @Test
  void listRetryQueue_authorizesViewAllBeforeReadingTheQueue() {
    App searchApp = new App().withId(UUID.randomUUID()).withName(SEARCH_INDEXING_APP);
    when(repository.getByName(any(), eq(SEARCH_INDEXING_APP), any())).thenReturn(searchApp);
    when(repository.getFields(eq("id"))).thenReturn(null);

    try (MockedStatic<Entity> ignored = mockEntityRegistry()) {
      stubRetryQueue();

      appResource.listRetryQueue(uriInfo, securityContext, SEARCH_INDEXING_APP, 10, 0);
    }

    ArgumentCaptor<OperationContext> captor = ArgumentCaptor.forClass(OperationContext.class);
    verify(authorizer).authorize(eq(securityContext), captor.capture(), any());
    assertEquals(
        MetadataOperation.VIEW_ALL,
        captor.getValue().getOperations(null).get(0),
        "the live-indexing-queue read must be gated on ViewAll");
  }

  @Test
  void listRetryQueue_deniedRequestNeverReadsTheQueue() {
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    try (MockedStatic<Entity> ignored = mockEntityRegistry()) {
      assertThrows(
          AuthorizationException.class,
          () -> appResource.listRetryQueue(uriInfo, securityContext, SEARCH_INDEXING_APP, 10, 0));
    }

    verify(retryQueueDAO, never()).listAll(anyInt(), anyInt());
  }

  @Test
  void createOrUpdate_deniedRequestNeverUnschedulesTheApp() throws Exception {
    App app = new App().withId(UUID.randomUUID()).withName("DataInsightsApplication");
    AppMapper mapper = mock(AppMapper.class);
    when(mapper.createToEntity(any(), any())).thenReturn(app);
    Field mapperField = AppResource.class.getDeclaredField("mapper");
    mapperField.setAccessible(true);
    mapperField.set(appResource, mapper);

    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("someone");
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    // The boundary check resolves the stored app to decide Create vs EditAll, which reads the
    // repository's PUT field set.
    when(repository.getPutFields()).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    AppScheduler scheduler = mock(AppScheduler.class);
    try (MockedStatic<Entity> ignored = mockEntityRegistry();
        MockedStatic<AppScheduler> schedulerMock = mockStatic(AppScheduler.class)) {
      schedulerMock.when(AppScheduler::getInstance).thenReturn(scheduler);

      assertThrows(
          AuthorizationException.class,
          () -> appResource.createOrUpdate(uriInfo, securityContext, new CreateApp()));

      verify(scheduler, never()).deleteScheduledApplication(any());
    }
  }

  @Test
  void patchApplication_deniedRequestNeverUnschedulesTheApp() throws Exception {
    UUID appId = UUID.randomUUID();
    App app = new App().withId(appId).withName("DataInsightsApplication").withSystem(false);
    when(repository.get(any(), eq(appId), any())).thenReturn(app);
    when(repository.getFields(eq("bot,pipelines"))).thenReturn(null);
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    JsonArray operations =
        Json.createArrayBuilder()
            .add(
                Json.createObjectBuilder()
                    .add("op", "replace")
                    .add("path", "/description")
                    .add("value", "x"))
            .build();
    JsonPatch patch = Json.createPatch(operations);

    AppScheduler scheduler = mock(AppScheduler.class);
    try (MockedStatic<Entity> ignored = mockEntityRegistry();
        MockedStatic<AppScheduler> schedulerMock = mockStatic(AppScheduler.class)) {
      schedulerMock.when(AppScheduler::getInstance).thenReturn(scheduler);

      assertThrows(
          AuthorizationException.class,
          () -> appResource.patchApplication(uriInfo, securityContext, appId, patch));
    }

    verify(scheduler, never()).deleteScheduledApplication(any());
  }
}
